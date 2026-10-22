import { auditRecord, attachAuditContext } from "../audit.ts";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { adminServices } from "../firebaseAdmin.ts";
import { mobileCors } from "../mobileCors.ts";
import { r2Services, imageUploadSpec, validImageKey } from "../r2.ts";

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
    const access=(await db.doc('accountAccess/'+identity.uid).get()).data();
    if(access?.disabled||access?.operationLocked||identity.auth_time<=(access?.revokedBefore||0))return res.status(401).json({error:'أُلغيت هذه الجلسة أو عُلّق الحساب. سجل الدخول من جديد.'});
    attachAuditContext(req,identity);
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
      const log=db.collection("auditLogs").doc();
      await log.set({...auditRecord(identity,"images.delete","images",input.key,{key:input.key},null),status:"pending"});
      try { await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: input.key })); await log.update({status:"success"}); }
      catch(error) { await log.update({status:"partial",errorCode:"r2-delete-review"}); throw error; }
      return res.status(200).json({ ok: true });
    }
    const uploadUrl = await getSignedUrl(client, new PutObjectCommand({
      Bucket: bucket, Key: spec!.key, ContentType: spec!.contentType,
      ContentLength: spec!.size, CacheControl: "public, max-age=31536000, immutable",
    }), { expiresIn: 120, signableHeaders: new Set(["content-type", "content-length", "cache-control"]) });
    await db.collection("auditLogs").add(auditRecord(identity,"images.upload.authorized","images",spec!.key,null,{key:spec!.key,size:spec!.size,contentType:spec!.contentType}));
    return res.status(200).json({ key: spec!.key, uploadUrl, publicUrl: `${publicUrl}/${spec!.key}` });
  } catch {
    return res.status(503).json({ error: "رفع الصور غير متاح حاليًا. يرجى المحاولة لاحقًا." });
  }
}
