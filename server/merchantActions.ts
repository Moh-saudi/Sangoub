import {readQuery} from './data/firestoreQueries.ts';
import {queryPlans} from '../src/data/queryPlans.ts';
import {merchantReadModel} from './merchantReadModels.ts';
import { sharedCatalogPage, linkCatalogProduct } from './sharedCatalog.ts';
import { merchantOrderView } from './portalOrders.ts';
import { writeOrderSignals } from './orderSignals.ts';
import { FieldValue } from "firebase-admin/firestore";
import { AdminError, validId } from "./adminRequest.ts";
import { auditInTransaction } from "./audit.ts";
import { paymentReady, type OperationIdentity } from "./operations.ts";
export const merchantActions = [
  "store-dashboard",
  "store-products",
  "shared-catalog",
  "store-customers",
  "store-payments",
  "link-catalog-product",
  "set-product-archived",
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
  if(['store-customers','store-payments'].includes(input.action))return merchantReadModel(input,context);
  if(input.action==='shared-catalog')return sharedCatalogPage(db,input.cursor,input.query||'');
  if(input.action==='link-catalog-product')return linkCatalogProduct(input,context);
  const storeRef = db.doc("stores/" + storeId);
  const productPage=async(cursor?:string)=>{
    if(cursor!==undefined)validId(cursor);
    const snapshot=await readQuery(db,queryPlans.merchantProducts(storeId),cursor);const docs=snapshot.docs.slice(0,100);
    return {products:docs.map(d=>({...d.data(),id:d.id})),productsNextCursor:snapshot.docs.length>100?docs.at(-1)!.id:null};
  };
  if(input.action==='store-products')return productPage(input.cursor);
  if (input.action === "store-dashboard") {
    const [store, products, orders, contract] = await Promise.all([
      storeRef.get(),
      productPage(),
      input.includeOrders===false ? Promise.resolve({docs:[]}) : db
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
      ...products,
      orders: orders.docs
        .filter((d) => d.data().fulfillmentVersion !== 2)
        .map((d) => {
          return merchantOrderView(d.id, d.data(), storeId);
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
      writeOrderSignals(db, tx, {...before, ...after, id}, {...before, id});
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
    } else if (input.action === "set-product-archived") {
      if(!before||typeof input.archived!=='boolean')throw new AdminError(400,'حالة الأرشفة غير صالحة.');
      patch={archived:input.archived,inStock:false};
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
      throw new AdminError(409,'اختر المنتج من الكتالوج العام بدل إنشاء نسخة جديدة.');
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
