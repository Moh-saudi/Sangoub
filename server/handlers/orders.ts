import { productCandidateIds } from '../productIdentity.ts';
import { auditInTransaction, attachAuditContext } from "../audit.ts";
import { FieldValue } from "firebase-admin/firestore";
import { randomInt } from "node:crypto";
import { adminServices } from "../firebaseAdmin.ts";
import { buildOrder } from "../orderBuilder.ts";
import { rolloutReady, writeTickets } from "../operations.ts";
import { mobileCors } from "../mobileCors.ts";
import { GeideaGateway, ChatAmanGateway } from "../integrations.ts";
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (mobileCors(req, res)) return;
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!bearer) return res.status(401).json({ error: "يرجى تسجيل الدخول." });
  try {
    const { auth, db } = adminServices();
    let identity;
    try {
      identity = await auth.verifyIdToken(bearer, true);
    } catch {
      return res
        .status(401)
        .json({ error: "جلسة الدخول غير صالحة. سجّل الدخول مجددًا." });
    }
    const access=(await db.doc('accountAccess/'+identity.uid).get()).data();
    if(access?.disabled||access?.operationLocked||identity.auth_time<=(access?.revokedBefore||0))return res.status(401).json({error:'أُلغيت هذه الجلسة أو عُلّق الحساب. سجل الدخول من جديد.'});
    attachAuditContext(req,identity);
    if (!identity.email_verified && !identity.phone_number) {
      const userDoc = await db.collection("users").doc(identity.uid).get();
      if (!userDoc.exists) {
        return res.status(403).json({ error: "يرجى تأكيد البريد أو الهاتف." });
      }
    }
    const input = req.body;
    if (
      !input ||
      typeof input.id !== "string" ||
      !/^ord-[a-f0-9-]{36}$/.test(input.id) ||
      !Array.isArray(input.items) ||
      input.items.length > 50 ||
      !input.items.length
    )
      return res.status(400).json({ error: "بيانات الطلب غير صالحة." });
    if (
      input.items.some(
        (i: any) =>
          typeof i?.product?.id !== "string" ||
          !/^[\w-]{1,128}$/.test(i.product.id),
      ) ||
      (input.couponCode && !/^[\w-]{1,40}$/.test(input.couponCode))
    )
      return res.status(400).json({ error: "معرّف صنف أو خصم غير صالح." });
    const ref = db.collection("orders").doc(`${identity.uid}_${input.id}`);
    const result = await db.runTransaction<Record<string, any>>(async (tx) => {
      const existing = await tx.get(ref);
      if (existing.exists) return existing.data()!;
      const operationsConfig = await tx.get(db.doc("appConfig/operations"));
      const useFulfillments = rolloutReady() && operationsConfig.data()?.enabled === true;
      const quotaRef = db.collection("orderLimits").doc(identity.uid);
      const quota = await tx.get(quotaRef);
      const windowStart = Date.now() - 24 * 60 * 60 * 1000;
      const recent = quota.data()?.startedAt > windowStart;
      if (recent && quota.data()!.count >= 30)
        throw new Error("ORDER_RATE_LIMIT");
      const profile = await tx.get(db.collection("users").doc(identity.uid));
      if (!profile.exists) throw new Error("أكمل بيانات الحساب أولًا.");
      const productIds = [
        ...new Set<string>(
          input.items.map((i: any) => i.product.id),
        ),
      ];
      const productDocs = await tx.getAll(...productIds.map(id => db.collection("products").doc(id)));
      // Read exact IDs once; legacy suffix lookups are only needed for missing products.
      const fallbackIds=[...new Set(productDocs.filter(doc=>!doc.exists).flatMap(doc=>productCandidateIds(doc.id).slice(1)))].filter(id=>!productIds.includes(id));
      if(fallbackIds.length) productDocs.push(...await tx.getAll(...fallbackIds.map(id=>db.collection('products').doc(id))));
      const products = new Map(
        productDocs
          .filter((d) => d.exists)
          .map((d) => [d.id, { ...d.data(), id: d.id } as any]),
      );
      const storeIds = [
        ...new Set<string>(Array.from(products.values()).map((p) => p.storeId)),
      ];
      const storeDocs = storeIds.length ? await tx.getAll(...storeIds.map(id => db.collection("stores").doc(id))) : [];
      const stores = new Map(
        storeDocs
          .filter((d) => d.exists)
          .map((d) => [d.id, { ...d.data(), id: d.id } as any]),
      );
      const coupon = input.couponCode
        ? (await tx.get(db.collection("coupons").doc(input.couponCode))).data()
        : undefined;
      const order = buildOrder(
        input,
        identity.uid,
        products,
        stores,
        coupon as any,
      );
      order.id = ref.id;
      if (useFulfillments) {
        Object.assign(order, { fulfillmentVersion: 2, paymentStatus: order.paymentMethod === "cash" ? "cash_on_delivery" : "pending" });
        writeTickets(db, tx, order, stores);
      }
      tx.set(quotaRef, {
        startedAt: recent ? quota.data()!.startedAt : Date.now(),
        count: recent ? quota.data()!.count + 1 : 1,
      });
      tx.create(ref, {
        ...order,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.create(db.collection("orderSecrets").doc(ref.id), {
        otpCode: randomInt(1000, 10000).toString(), attempts: 0,
      });
      auditInTransaction(db, tx, identity, "orders.create", "orders", ref.id, null, order, "", "orders-api");
      return order;
    });
    // إذا كانت طريقة الدفع إلكترونية عبر Geidea
    let paymentResult: any = null;
    if (result.paymentMethod === "geidea" && !process.env.FIRESTORE_EMULATOR_HOST) {
      try {
        paymentResult = await GeideaGateway.createOrderPayment({
          orderId: ref.id,
          amount: result.total,
          currency: "EGP",
          customerEmail: identity.email || "customer@capital-talabat.eg",
          customerName: input.profileName || "عميل العاصمة",
          returnUrl: `${process.env.APP_URL || "https://capital-talabat.vercel.app"}/checkout/success?orderId=${ref.id}`,
        });
      } catch (payErr) {
        console.error("Geidea order session error:", payErr);
      }
    }

    // إرسال رسالة تأكيد الطلب الفورية عبر واتساب شات أمان
    if (input.phone && !process.env.FIRESTORE_EMULATOR_HOST) {
      ChatAmanGateway.sendOrderConfirmation({
        phone: input.phone,
        customerName: input.profileName || "عميل العاصمة",
        orderNumber: ref.id.slice(0, 10),
        totalAmount: result.total,
        currency: "ج.م",
        deliveryAddress: `${input.ministry || "الحي الحكومي"} - دور ${input.floorNumber || ""} - مكتب ${input.roomNumber || ""}`,
      }).catch((waErr) => console.warn("ChatAman confirmation warning:", waErr));
    }

    return res.status(200).json({
      order: {
        ...result,
        createdAt: result?.createdAt?.toDate
          ? result.createdAt.toDate().toISOString()
          : result?.createdAt,
      },
      requiresPaymentRedirect: !!paymentResult?.redirectUrl,
      redirectUrl: paymentResult?.redirectUrl || null,
      sessionId: paymentResult?.sessionId || null,
    });
  } catch (error: any) {
    if (error.message === "ORDER_RATE_LIMIT")
      return res
        .status(429)
        .json({ error: "تجاوزت عدد الطلبات اليومي. تواصل مع الدعم." });
    const infrastructure =
      /credential|permission|PERMISSION_DENIED|UNAUTHENTICATED|default credentials|ENOTFOUND|project.*not found|NOT_FOUND|network/i.test(
        error.message || "",
      );
    if (infrastructure) {
      console.error(
        "Order infrastructure failure:",
        error.code || "unavailable",
      );
      return res
        .status(503)
        .json({
          error: "خدمة الطلبات غير متاحة حاليًا. يرجى المحاولة لاحقًا.",
        });
    }
    return res.status(400).json({ error: error.message || "تعذر حفظ الطلب." });
  }
}
