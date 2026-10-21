import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { adminServices } from "../server/firebaseAdmin.ts";
import { mobileCors } from "../server/mobileCors.ts";
import { r2Services, imageUploadSpec, validImageKey } from "../server/r2.ts";

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (mobileCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return res.status(401).json({ error: "يرجى تسجيل الدخول." });
  try {
    const { auth, db } = adminServices();
    let identity;
    try { identity = await auth.verifyIdToken(token, true); }
    catch { return res.status(401).json({ error: "جلسة الدخول غير صالحة." }); }
    if ((!identity.email_verified && !identity.phone_number) ||
        !(await db.collection("admins").doc(identity.uid).get()).exists)
      return res.status(403).json({ error: "رفع الصور متاح للمدير فقط." });
    const input = req.body;
    if (input?.action !== "upload" && input?.action !== "delete")
      return res.status(400).json({ error: "عملية غير صالحة." });
    if (input.action === "delete" && !validImageKey(input.key))
      return res.status(400).json({ error: "مسار صورة غير صالح." });
    let spec;
    if (input.action === "upload") {
      try { spec = imageUploadSpec(input); }
      catch { return res.status(400).json({ error: "اختر صورة JPG أو PNG أو WebP حتى 5 ميجابايت." }); }
    }
    const { client, bucket, publicUrl } = r2Services();
    if (input.action === "delete") {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: input.key }));
      return res.status(200).json({ ok: true });
    }
    const uploadUrl = await getSignedUrl(client, new PutObjectCommand({
      Bucket: bucket, Key: spec!.key, ContentType: spec!.contentType,
      ContentLength: spec!.size, CacheControl: "public, max-age=31536000, immutable",
    }), { expiresIn: 120, signableHeaders: new Set(["content-type", "content-length", "cache-control"]) });
    return res.status(200).json({ key: spec!.key, uploadUrl, publicUrl: `${publicUrl}/${spec!.key}` });
  } catch {
    return res.status(503).json({ error: "رفع الصور غير متاح. راجع إعدادات R2 والخادم." });
  }
}
