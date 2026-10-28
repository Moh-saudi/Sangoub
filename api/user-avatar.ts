import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { adminServices } from "../server/firebaseAdmin.ts";
import { mobileCors } from "../server/mobileCors.ts";
import { r2Services } from "../server/r2.ts";

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (mobileCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return res.status(401).json({ error: "يرجى تسجيل الدخول أولاً." });

  try {
    const { auth, db } = adminServices();
    let identity;
    try {
      identity = await auth.verifyIdToken(token, true);
    } catch {
      return res.status(401).json({ error: "جلسة الدخول غير صالحة." });
    }

    const access=(await db.doc('accountAccess/'+identity.uid).get()).data();
    if((!identity.email_verified&&!identity.phone_number)||access?.disabled||access?.operationLocked||identity.auth_time<=(access?.revokedBefore||0))return res.status(403).json({error:'أكد الحساب وراجع صلاحية الجلسة.'});
    const { contentType = "image/jpeg", size = 0 } = req.body || {};
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    if(!Object.hasOwn(extensions,contentType)||!Number.isInteger(size)||size<1||size>5*1024*1024)return res.status(400).json({error:'اختر صورة JPG أو PNG أو WebP حتى 5 ميجابايت.'});
    const ext = extensions[contentType];
    const key = `avatars/${identity.uid}.${ext}`;

    const { client, bucket, publicUrl } = r2Services();
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        ContentLength:size,
        CacheControl: "public, max-age=86400",
      }),
      { expiresIn: 300 }
    );

    const avatarPublicUrl = `${publicUrl}/${key}?t=${Date.now()}`;

    return res.status(200).json({
      key,
      uploadUrl,
      publicUrl: avatarPublicUrl,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message || "تعذر تجهيز رابط رفع الصورة الشخصية.",
    });
  }
}
