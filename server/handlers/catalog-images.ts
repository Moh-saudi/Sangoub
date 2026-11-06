import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireAdmin } from "../adminRequest.ts";
import { mobileCors } from "../mobileCors.ts";
import { r2Services, imageUploadSpec, validImageKey } from "../r2.ts";
import { supabaseAdminClient } from "../supabaseAdmin.ts";

async function writeImageAudit(actor: any, action: string, key: string, before: any, after: any, status = 'success') {
  try {
    const { data, error } = await supabaseAdminClient().from('audit_logs').insert({
      actor_id: actor?.uid || null, actor_email: actor?.email || '', action, entity_type: 'images', entity_id: key,
      before_state: before, after_state: after, source: 'catalog-images-api', status,
    }).select('id').maybeSingle();
    if (error) {
      console.warn('Image audit log insert warning:', error.message);
      return null;
    }
    return (data?.id as string) || null;
  } catch (err: any) {
    console.warn('Image audit log exception:', err?.message);
    return null;
  }
}

export default async function handler(req: any, res: any) {
  if (mobileCors(req, res)) return;

  // 1. GET: Stream/serve stored images to web/mobile clients
  if (req.method === "GET" || req.method === "HEAD") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    
    let key = req.query?.key;
    if (!key && req.url) {
      try {
        const u = new URL(req.url, 'http://localhost');
        key = u.searchParams.get('key');
      } catch {}
    }

    if (!key || typeof key !== "string") {
      return res.status(400).json({ error: "Missing image key" });
    }

    // Clean key if a full URL or leading slash was passed
    if (key.includes('/catalog/')) {
      key = key.substring(key.indexOf('catalog/'));
    }
    key = key.replace(/^\/+/, '');

    try {
      const { client, bucket } = r2Services();
      const data = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      res.setHeader("Content-Type", data.ContentType || "image/png");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      if (req.method === "HEAD") return res.status(200).end();
      if (data.ContentLength) {
        res.setHeader("Content-Length", data.ContentLength.toString());
      }
      return (data.Body as any).pipe(res);
    } catch (err: any) {
      console.warn("R2 image fetch error for key:", key, err?.message || err);
      // Seamless fallback: redirect to default brand placeholder so UI never displays broken image box
      return res.redirect(302, '/brand/sangoub-market-logo.jpg');
    }
  }

  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { actor: identity } = await requireAdmin(req);
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
      const logId = await writeImageAudit(identity,"images.delete",input.key,{key:input.key},null,'pending');
      try {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: input.key }));
        if (logId) {
          await supabaseAdminClient().from('audit_logs').update({status:'success'}).eq('id',logId);
        }
      } catch(error) {
        if (logId) {
          await supabaseAdminClient().from('audit_logs').update({status:'partial',after_state:{key:input.key},reason:'r2-delete-review'}).eq('id',logId);
        }
        throw error;
      }
      return res.status(200).json({ ok: true });
    }
    const uploadUrl = await getSignedUrl(client, new PutObjectCommand({
      Bucket: bucket, Key: spec!.key, ContentType: spec!.contentType,
      ContentLength: spec!.size, CacheControl: "public, max-age=31536000, immutable",
    }), { expiresIn: 120, signableHeaders: new Set(["content-type", "content-length", "cache-control"]) });
    await writeImageAudit(identity,"images.upload.authorized",spec!.key,null,{key:spec!.key,size:spec!.size,contentType:spec!.contentType});
    
    // Return reliable streaming URL that works anywhere, without relying on Cloudflare public r2.dev subdomain
    const streamingUrl = `/api/catalog-images?key=${encodeURIComponent(spec!.key)}`;
    return res.status(200).json({ key: spec!.key, uploadUrl, publicUrl: streamingUrl });
  } catch (err: any) {
    console.error("Catalog images upload error:", err);
    return res.status(503).json({ error: err?.message || "رفع الصور غير متاح حاليًا. يرجى المحاولة لاحقًا." });
  }
}
