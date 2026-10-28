import { FieldValue } from "firebase-admin/firestore";
import { AdminError, validId } from "./adminRequest.ts";
import { auditInTransaction } from "./audit.ts";
import { paymentReady, type OperationIdentity } from "./operations.ts";
const text = (v: unknown, max: number) =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;
export const merchantActions = [
  "store-dashboard",
  "save-product",
  "set-product-stock",
  "set-product-price",
  "set-store-status",
  "legacy-prepare",
];
export async function merchantAction(input: any, context: OperationIdentity) {
  const { db, actor, staff, role } = context;
  if (!context.verified || role !== "restaurant" || !staff?.storeId)
    throw new AdminError(403, "الحساب غير مرتبط بمتجر معتمد.");
  const storeId = staff.storeId;
  validId(storeId);
  const storeRef = db.doc("stores/" + storeId);
  if (input.action === "store-dashboard") {
    const [store, products, orders, contract] = await Promise.all([
      storeRef.get(),
      db
        .collection("products")
        .where("storeId", "==", storeId)
        .limit(100)
        .get(),
      db
        .collection("orders")
        .where("storeIds", "array-contains", storeId)
        .limit(100)
        .get(),
      db.doc("merchantContracts/" + storeId).get(),
    ]);
    if (!store.exists)
      throw new AdminError(409, "المتجر المرتبط بالحساب غير موجود.");
    return {
      stores: [
        {
          ...store.data(),
          id: store.id,
          ...(contract.exists
            ? { commissionRate: contract.data()?.commissionRate }
            : {}),
        },
      ],
      products: products.docs.map((d) => ({ ...d.data(), id: d.id })),
      orders: orders.docs
        .filter((d) => d.data().fulfillmentVersion !== 2)
        .map((d) => {
          const order = d.data(),
            items = (order.items || []).filter(
              (i: any) => i.product?.storeId === storeId,
            ),
            snapshot = order.storeSnapshots?.find((s: any) => s.id === storeId);
          const subtotal = items.reduce(
            (n: number, i: any) =>
              n + (i.product.price + (i.extraPrice || 0)) * i.quantity,
            0,
          );
          return {
            ...order,
            id: d.id,
            items,
            storeIds: [storeId],
            kitchenStatus: {
              [storeId]: order.kitchenStatus?.[storeId] || "received",
            },
            subtotal,
            total: snapshot?.total ?? subtotal,
            createdAt:
              order.createdAt?.toDate?.().toISOString() || order.createdAt,
          };
        }),
    };
  }
  const id = input.action === "set-store-status" ? storeId : input.id;
  validId(id);
  return db.runTransaction(async (tx) => {
    const ref = db.doc(
      (input.action === "legacy-prepare"
        ? "orders"
        : input.action === "set-store-status"
          ? "stores"
          : "products") +
        "/" +
        id,
    );
    const [membership, access, store, current] = await Promise.all([
      tx.get(db.doc("staff/" + actor.uid)),
      tx.get(db.doc("accountAccess/" + actor.uid)),
      tx.get(storeRef),
      tx.get(ref),
    ]);
    const m = membership.data(),
      a = access.data();
    if (
      m?.role !== "restaurant" ||
      m?.storeId !== storeId ||
      a?.disabled ||
      a?.operationLocked ||
      actor.auth_time <= (a?.revokedBefore || 0)
    )
      throw new AdminError(403, "تغيرت صلاحية الحساب.");
    if (!store.exists) throw new AdminError(409, "المتجر غير موجود.");
    const before = current.data() || null;
    if (input.action === "legacy-prepare") {
      if (
        !before ||
        !before.storeIds?.includes(storeId) ||
        before.fulfillmentVersion === 2
      )
        throw new AdminError(403, "الطلب غير متاح لهذا المسار.");
      if (
        !paymentReady(before) ||
        !["received", "preparing"].includes(before.orderStatus)
      )
        throw new AdminError(409, "الطلب غير متاح للتحضير.");
      const old = before.kitchenStatus?.[storeId] || "received",
        next = input.next;
      if (
        !(
          (old === "received" && next === "preparing") ||
          (old === "preparing" && next === "ready")
        )
      )
        throw new AdminError(409, "راجع مرحلة التحضير الحالية.");
      const kitchenStatus = { ...before.kitchenStatus, [storeId]: next },
        all = before.storeIds.every(
          (s: string) => kitchenStatus[s] === "ready",
        );
      const after = {
        kitchenStatus,
        orderStatus: all ? "ready" : "preparing",
        updatedAt: FieldValue.serverTimestamp(),
        ...(all ? { readyAt: FieldValue.serverTimestamp() } : {}),
      };
      tx.update(ref, after);
      auditInTransaction(
        db,
        tx,
        actor,
        "merchant.prepare",
        "orders",
        id,
        before,
        { ...before, ...after },
      );
      return { ok: true };
    }
    if ((m.duty || "manager") !== "manager")
      throw new AdminError(403, "تعديل المنيو والمتجر متاح لمدير المتجر فقط.");
    if (
      before &&
      input.action !== "set-store-status" &&
      before.storeId !== storeId
    )
      throw new AdminError(403, "المنتج يخص متجرًا آخر.");
    let patch: any;
    if (input.action === "set-store-status") {
      if (!["open", "closed", "busy"].includes(input.status))
        throw new AdminError(400, "حالة متجر غير صالحة.");
      patch = { status: input.status };
    } else if (input.action === "set-product-stock") {
      if (!before || typeof input.inStock !== "boolean" || before.archived)
        throw new AdminError(400, "المنتج غير متاح للتعديل.");
      patch = { inStock: input.inStock };
    } else if (input.action === "set-product-price") {
      if (
        !before ||
        !Number.isFinite(input.price) ||
        input.price < 0 ||
        input.price > 100000
      )
        throw new AdminError(400, "سعر غير صالح.");
      patch = { price: input.price };
      if (
        before.originalPrice !== undefined &&
        before.originalPrice < input.price
      )
        patch.originalPrice = FieldValue.delete();
    } else if (input.action === "save-product") {
      if (before) throw new AdminError(409, "معرف المنتج مستخدم بالفعل.");
      const p = input.product;
      if (
        !p ||
        !text(p.name, 120) ||
        !text(p.description, 1000) ||
        !text(p.category, 120) ||
        !Number.isFinite(p.price) ||
        p.price < 0 ||
        p.price > 100000
      )
        throw new AdminError(400, "راجع بيانات المنتج.");
      let imageUrl = "";
      if (p.imageUrl) {
        try {
          const u = new URL(p.imageUrl);
          if (u.protocol !== "https:" || u.username || u.password)
            throw Error();
          imageUrl = u.href;
        } catch {
          throw new AdminError(400, "رابط الصورة غير صالح.");
        }
      }
      patch = {
        id,
        storeId,
        storeName: store.data()!.name,
        name: p.name.trim(),
        description: p.description.trim(),
        category: p.category,
        price: p.price,
        inStock: true,
        archived: false,
        imageType: "foul",
        ...(imageUrl ? { imageUrl } : {}),
      };
    } else throw new AdminError(400, "عملية غير صالحة.");
    const after = { ...patch, updatedAt: FieldValue.serverTimestamp() };
    tx.set(ref, after, { merge: true });
    auditInTransaction(
      db,
      tx,
      actor,
      "merchant." + input.action,
      ref.parent.id,
      id,
      before,
      { ...before, ...patch },
    );
    return { ok: true };
  });
}
