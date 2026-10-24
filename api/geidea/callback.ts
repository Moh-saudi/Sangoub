import { FieldValue } from "firebase-admin/firestore";
import { adminServices } from "../../server/firebaseAdmin.ts";
import { GeideaGateway, ChatAmanGateway } from "../../server/integrations.ts";

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = req.method === "POST" ? req.body : req.query;
    const verification = GeideaGateway.verifyCallback(payload);

    const { db } = adminServices();

    // استخراج معرف الطلب من metadata أو merchantReferenceId
    let orderId = payload.metadata?.orderId;
    if (!orderId && verification.referenceId) {
      // referenceId starts with ASIMA_
      const cleanRef = verification.referenceId.replace(/^ASIMA_/, "");
      // ابحث عن الطلب في orders
      const snapshot = await db
        .collection("orders")
        .where("id", "==", cleanRef)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        orderId = snapshot.docs[0].id;
      }
    }

    if (!orderId) {
      return res.status(400).json({
        error: "ORDER_NOT_FOUND",
        details: "لم يتم العثور على معرف الطلب في إشعار جيديا",
      });
    }

    const orderRef = db.collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return res.status(404).json({ error: "الطلب غير موجود" });
    }

    const orderData = orderDoc.data()!;

    // V2 must not trust a browser-supplied success status. Provider verification
    // must establish paymentConfirmedAt before operational fulfillment can begin.
    if (orderData.fulfillmentVersion === 2) {
      return res.status(409).json({ error: "PAYMENT_VERIFICATION_REQUIRED", message: "يلزم تأكيد السداد من مزود الدفع قبل بدء التحضير." });
    }
    if (verification.isPaid) {
      await orderRef.update({
        paymentStatus: "paid",
        paidAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        geideaTransaction: {
          orderId: verification.orderId,
          amount: verification.amount,
          currency: verification.currency,
          paidAt: new Date().toISOString(),
        },
      });

      // إرسال إشعار تأكيد الدفع عبر واتساب
      if (orderData.phone) {
        try {
          await ChatAmanGateway.sendDirectMessage(
            orderData.phone,
            `تم سداد طلبك رقم #${orderId.slice(0, 8)} بنجاح بقيمة ${verification.amount} ${verification.currency} عبر بوابة جيديا ✅\nجاري تجهيز وجبتك وتوصيلها لمكتبك بالحي الحكومي 🛵`,
          );
        } catch (err) {
          console.warn("ChatAman notification warning:", err);
        }
      }

      return res.status(200).json({
        success: true,
        message: "تم تحديث حالة السداد بنجاح",
        isPaid: true,
      });
    } else {
      await orderRef.update({
        paymentStatus: "failed",
        updatedAt: FieldValue.serverTimestamp(),
      });

      return res.status(200).json({
        success: false,
        message: "فشلت عملية السداد عبر جيديا",
        isPaid: false,
      });
    }
  } catch (error: any) {
    console.error("Geidea callback error:", error);
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: error.message || "حدث خطأ أثناء معالجة إشعار الدفع",
    });
  }
}
