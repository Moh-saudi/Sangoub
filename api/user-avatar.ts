import { PutObjectCommand } from "@aws-sdk/client-s3";
import { mobileCors } from "../server/mobileCors.ts";
import { r2Services } from "../server/r2.ts";
import { randomUUID } from "node:crypto";

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (mobileCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { imageBase64, contentType = "image/jpeg", userId } = req.body || {};
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({ error: "يرجى اختيار صورة للرفع." });
    }

    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };

    // Extract mime type if base64 data URI was sent
    let detectedContentType = contentType;
    let base64Clean = imageBase64;
    const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      detectedContentType = match[1];
      base64Clean = match[2];
    }

    const ext = extensions[detectedContentType] || "jpg";
    const imageBuffer = Buffer.from(base64Clean, "base64");

    if (imageBuffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: "حجم الصورة كبير جداً، الحد الأقصى 5 ميجابايت." });
    }

    const uid = userId && /^[\w-]{1,64}$/.test(userId) ? userId : randomUUID();
    const key = `avatars/${uid}.${ext}`;

    const { client, bucket } = r2Services();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: imageBuffer,
        ContentType: detectedContentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    const publicUrl = `/api/catalog-images?key=${encodeURIComponent(key)}`;

    return res.status(200).json({
      ok: true,
      success: true,
      key,
      url: publicUrl,
    });
  } catch (err: any) {
    console.error("R2 avatar upload error:", err);
    return res.status(500).json({
      error: err.message || "تعذر رفع الصورة الشخصية إلى Cloudflare R2.",
    });
  }
}
