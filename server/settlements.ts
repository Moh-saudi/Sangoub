import {readQuery} from './data/firestoreQueries.ts';
import {queryPlans} from '../src/data/queryPlans.ts';
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { AdminError, validId } from "./adminRequest.ts";
import { auditInTransaction } from "./audit.ts";
import type { Order } from "../src/types";
const round = (n: number) => Math.round(n * 100) / 100;
export function settlementAmounts(order: Order, storeId: string, rate: number) {
  if (
    order.orderStatus !== "delivered" ||
    order.paymentStatus !== "paid" ||
    !Number.isFinite(rate) ||
    rate < 0 ||
    rate > 100
  )
    throw new AdminError(
      409,
      "التسوية للطلبات المسلّمة والمدفوعة فقط وبنسبة تعاقد صحيحة.",
    );
  const items = order.items.filter((i) => i.product.storeId === storeId);
  if (!items.length) throw new AdminError(400, "الطلب لا يخص المتجر.");
  const snapshot = order.storeSnapshots?.find((s) => s.id === storeId);
  const itemTotal = items.reduce(
    (n, i) => n + (i.product.price + i.extraPrice) * i.quantity,
    0,
  );
  const discount =
    snapshot?.discount ??
    (order.subtotal > 0
      ? ((order.discount || 0) * itemTotal) / order.subtotal
      : 0);
  const netProducts = round((snapshot?.subtotal ?? itemTotal) - discount);
  const gross = round(netProducts + (snapshot?.additionalTax || 0));
  const basis = round(Math.max(0, netProducts - (snapshot?.includedTax || 0)));
  if (![gross, basis].every(Number.isFinite) || gross < 0)
    throw new AdminError(409, "بيانات مالية غير صالحة؛ راجع الطلب.");
  const commission = round((basis * rate) / 100);
  return {
    orderId: order.id,
    gross,
    basis,
    commission,
    net: round(gross - commission),
    rate,
  };
}
export async function settlementAction(input: any, context: any) {
  const { db, actor } = context;
  if (input.action === "settlement-list") {
    const records = await readQuery(db,queryPlans.adminSettlements());
    return {
      records: records.docs.map((d: any) => ({
        ...d.data(),
        id: d.id,
        createdAt: d.data().createdAt?.toDate?.().toISOString() || null,
      })),
    };
  }
  validId(input.storeId);
  if (
    !Array.isArray(input.orderIds) ||
    !input.orderIds.length ||
    input.orderIds.length > 100 ||
    new Set(input.orderIds).size !== input.orderIds.length
  )
    throw new AdminError(400, "اختر حتى 100 طلب مختلف للتسوية.");
  input.orderIds.forEach(validId);
  const save = input.action === "settlement-save";
  if (save) {
    validId(input.id);
    if (
      typeof input.reference !== "string" ||
      !input.reference.trim() ||
      input.reference.length > 200
    )
      throw new AdminError(400, "اكتب مرجع التحويل الفعلي.");
  }
  return db.runTransaction(async (tx: any) => {
    const storeRef = db.doc("stores/" + input.storeId),
      recordRef = save ? db.doc("merchantSettlements/" + input.id) : null;
    const [admin, access, store, existing, contract] = await Promise.all([
      tx.get(db.doc("admins/" + actor.uid)),
      tx.get(db.doc("accountAccess/" + actor.uid)),
      tx.get(storeRef),
      recordRef ? tx.get(recordRef) : null,
      tx.get(db.doc("merchantContracts/" + input.storeId)),
    ]);
    const a = access.data();
    if (
      !admin.exists ||
      a?.disabled ||
      a?.operationLocked ||
      actor.auth_time <= (a?.revokedBefore || 0)
    )
      throw new AdminError(403, "انتهت صلاحية الإدارة.");
    if (existing?.exists) {
      if (
        existing.data().storeId !== input.storeId ||
        existing.data().reference !== input.reference.trim() ||
        JSON.stringify([...existing.data().orderIds].sort()) !==
          JSON.stringify([...input.orderIds].sort())
      )
        throw new AdminError(409, "مرجع العملية مستخدم.");
      return { record: { ...existing.data(), id: existing.id } };
    }
    const rate = contract.data()?.commissionRate;
    if (!store.exists || !Number.isFinite(rate) || rate < 0 || rate > 100)
      throw new AdminError(
        409,
        "سجّل نسبة التعاقد الصحيحة من محرر المتجر قبل التسوية.",
      );
    const orders = await Promise.all(
      input.orderIds.map((id: string) => tx.get(db.doc("orders/" + id))),
    );
    const claims = input.orderIds.map((id: string) =>
      db.doc(
        "settlementClaims/" +
          createHash("sha256")
            .update(input.storeId + "|" + id)
            .digest("hex"),
      ),
    );
    const claimed = await Promise.all(claims.map((ref: any) => tx.get(ref)));
    if (claimed.some((d: any) => d.exists))
      throw new AdminError(
        409,
        "بعض الطلبات سُوّيت بالفعل. حدّث التقارير قبل المحاولة.",
      );
    const allocations = orders.map((d: any) => {
      if (!d.exists) throw new AdminError(404, "أحد الطلبات غير موجود.");
      return settlementAmounts({ ...d.data(), id: d.id }, input.storeId, rate);
    });
    const quote = {
      storeId: input.storeId,
      storeName: store.data().name,
      commissionRate: rate,
      allocations,
      gross: round(allocations.reduce((n: number, a: any) => n + a.gross, 0)),
      commission: round(
        allocations.reduce((n: number, a: any) => n + a.commission, 0),
      ),
      net: round(allocations.reduce((n: number, a: any) => n + a.net, 0)),
    };
    const quoteHash = createHash("sha256")
      .update(JSON.stringify(quote))
      .digest("hex");
    if (!save) return { quote, quoteHash };
    if (input.quoteHash !== quoteHash)
      throw new AdminError(409, "تغيرت بيانات التسوية. راجع المبلغ مجددًا.");
    const record = {
      ...quote,
      reference: input.reference.trim(),
      orderIds: input.orderIds,
      actorUid: actor.uid,
      createdAt: FieldValue.serverTimestamp(),
    };
    tx.create(recordRef, record);
    for (const ref of claims)
      tx.create(ref, {
        settlementId: input.id,
        storeId: input.storeId,
        createdAt: FieldValue.serverTimestamp(),
      });
    auditInTransaction(
      db,
      tx,
      actor,
      "settlement.recorded",
      "merchantSettlements",
      input.id,
      null,
      record,
    );
    return { record: { ...record, id: input.id } };
  });
}
