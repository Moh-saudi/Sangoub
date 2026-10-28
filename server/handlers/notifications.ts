import {operationIdentity} from '../operations.ts';
import { Timestamp } from "firebase-admin/firestore";
import { requireAdmin, AdminError, adminError } from "../adminRequest.ts";
import { mobileCors } from "../mobileCors.ts";
import { auditRecord } from "../audit.ts";

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (mobileCors(req, res)) return;

  let context: Awaited<ReturnType<typeof requireAdmin>> | undefined;

  try {
    if(req.method==='POST'&&req.body?.action==='register-token'){
      const {db,actor,verified}=await operationIdentity(req);const {token,platform}=req.body;
      if(!verified||typeof token!=='string'||token.length<20||token.length>2048||!['android','ios','web'].includes(platform))throw new AdminError(400,'بيانات جهاز غير صالحة.');
      const ref=db.doc('users/'+actor.uid);if(!(await ref.get()).exists)throw new AdminError(409,'أكمل ملف الحساب أولًا.');
      await ref.update({fcmToken:token,fcmPlatform:platform,fcmUpdatedAt:Timestamp.now()});return res.status(200).json({ok:true});
    }
    context = await requireAdmin(req);
    const { db, messaging, actor } = context;

    if (req.method === "GET" || (req.method === "POST" && req.body?.action === "list")) {
      // جلب سجل الإشعارات السابقة
      const snapshot = await db
        .collection("notifications")
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();

      const notifications = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate().toISOString() : doc.data().createdAt,
      }));

      return res.status(200).json({ ok: true, notifications });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const {
      title,
      body,
      audience = "all",
      type = "general",
      targetScreen = "home",
      targetId,
      targetUid,
      imageUrl,
    } = req.body || {};

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      throw new AdminError(400, "عنوان الإشعار مطلوب.");
    }
    if (!body || typeof body !== "string" || body.trim().length === 0) {
      throw new AdminError(400, "نص الإشعار مطلوب.");
    }

    const cleanTitle = title.trim().slice(0, 120);
    const cleanBody = body.trim().slice(0, 500);
    const cleanType = ["promo", "operational", "alert", "general"].includes(type) ? type : "general";
    const cleanAudience = ["all", "clients", "couriers", "stores", "single"].includes(audience) ? audience : "all";

    // 1. تسجيل الإشعار في قاعدة بيانات Firestore
    const notificationDoc = {
      title: cleanTitle,
      body: cleanBody,
      audience: cleanAudience,
      type: cleanType,
      targetScreen: String(targetScreen || "home").slice(0, 60),
      ...(targetId ? { targetId: String(targetId).slice(0, 128) } : {}),
      ...(targetUid ? { targetUid: String(targetUid).slice(0, 128) } : {}),
      ...(imageUrl ? { imageUrl: String(imageUrl).slice(0, 500) } : {}),
      senderUid: actor.uid,
      senderEmail: actor.email || "admin@capital.talabat",
      createdAt: Timestamp.now(),
      status: "sent",
      fcmDeliveryStatus: "pending",
      recipientCount: 0,
    };

    const docRef = await db.collection("notifications").add(notificationDoc);

    // 2. إرسال الإشعار عبر Firebase Cloud Messaging (FCM)
    let fcmSuccess = false;
    let recipientCount = 0;
    let fcmError: string | null = null;

    try {
      const dataPayload: Record<string, string> = {
        notificationId: docRef.id,
        type: cleanType,
        screen: String(targetScreen || "home"),
        ...(targetId ? { targetId: String(targetId) } : {}),
      };

      if (cleanAudience === "single" && targetUid) {
        // إرسال لمستخدم محدد
        const userDoc = await db.collection("users").doc(targetUid).get();
        const fcmToken = userDoc.data()?.fcmToken;
        if (fcmToken) {
          await messaging.send({
            token: fcmToken,
            notification: {
              title: cleanTitle,
              body: cleanBody,
              ...(imageUrl ? { imageUrl } : {}),
            },
            data: dataPayload,
            android: {
              priority: "high",
              notification: {
                channelId: "capital_orders_channel",
                sound: "default",
                color: "#F59E0B",
              },
            },
          });
          recipientCount = 1;
          fcmSuccess = true;
        }
      } else {
        // إرسال عبر موضوع (Topic)
        const topicName =
          cleanAudience === "clients"
            ? "clients"
            : cleanAudience === "couriers"
            ? "couriers"
            : cleanAudience === "stores"
            ? "stores"
            : "all_users";

        await messaging.send({
          topic: topicName,
          notification: {
            title: cleanTitle,
            body: cleanBody,
            ...(imageUrl ? { imageUrl } : {}),
          },
          data: dataPayload,
          android: {
            priority: "high",
            notification: {
              channelId: "capital_orders_channel",
              sound: "default",
              color: "#F59E0B",
            },
          },
        });
        fcmSuccess = true;

        // إحصاء تقريبي للمستخدمين المستهدفين لتحديث العداد
        try {
          const countQuery =
            cleanAudience === "couriers"
              ? db.collection("users").where("role", "==", "courier")
              : cleanAudience === "stores"
              ? db.collection("staff")
              : db.collection("users");
          const countSnap = await countQuery.count().get();
          recipientCount = countSnap.data().count;
        } catch {
          recipientCount = 1;
        }
      }
    } catch (err: any) {
      console.warn("FCM push send warning:", err?.message || err);
      fcmError = err?.message || "تعذر إرسال تنبيه FCM، تم تسجيل الإشعار داخلياً.";
    }

    // 3. تحديث حالة التسليم في المستند
    await docRef.update({
      fcmDeliveryStatus: fcmSuccess ? "delivered" : fcmError ? "fcm_error" : "recorded_only",
      ...(fcmError ? { fcmError } : {}),
      recipientCount: recipientCount || 1,
    });

    // 4. تسجيل العملية في سجل التدقيق (Audit Log)
    try {
      await db.collection("auditLogs").add({
        ...auditRecord(actor, "admin.notification.broadcast", "notifications", docRef.id, null, {
          title: cleanTitle,
          audience: cleanAudience,
          type: cleanType,
          fcmSuccess,
        }),
        status: "success",
      });
    } catch {}

    return res.status(200).json({
      ok: true,
      id: docRef.id,
      title: cleanTitle,
      audience: cleanAudience,
      fcmSuccess,
      recipientCount,
      message: fcmSuccess ? "تم إرسال الإشعار بنجاح." : "تم تسجيل الإشعار وحفظه في السجل.",
    });
  } catch (error: any) {
    return adminError(res, error);
  }
}
