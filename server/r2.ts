import { S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

export const maxImageBytes = 5 * 1024 * 1024;
export function imageUploadSpec(input: any) {
  const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  if (!input || !["stores", "products", "banners", "campaigns"].includes(input.collection) ||
      typeof input.id !== "string" || !/^[\w-]{1,128}$/.test(input.id) ||
      !Object.hasOwn(extensions, input.contentType) ||
      !Number.isInteger(input.size) || input.size <= 0 || input.size > maxImageBytes)
    throw new Error("INVALID_IMAGE");
  return {
    key: `catalog/${input.collection}/${input.id}/${randomUUID()}.${extensions[input.contentType]}`,
    contentType: input.contentType as string,
    size: input.size as number,
  };
}
export function validImageKey(key: unknown): key is string {
  return typeof key === "string" && /^catalog\/(stores|products|banners|campaigns)\/[\w-]{1,128}\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(key);
}
export function r2Services() {
  const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL || "https://pub-39e754c2871845ba91c1ec271a0400e8.r2.dev";
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_PUBLIC_URL) throw new Error("R2_NOT_CONFIGURED");
  const publicUrl = new URL(R2_PUBLIC_URL);
  if (publicUrl.protocol !== "https:" || publicUrl.username || publicUrl.password || publicUrl.search || publicUrl.hash)
    throw new Error("R2_NOT_CONFIGURED");
  return {
    client: new S3Client({ region: "auto", forcePathStyle: true,
      endpoint: "https://14521cdfec73fa908fbf7e760fae362a.r2.cloudflarestorage.com",
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
      requestChecksumCalculation: "WHEN_REQUIRED",
    }),
    bucket: process.env.CLOUDFLARE_R2_BUCKET || process.env.R2_BUCKET || "sangoub",
    publicUrl: publicUrl.href.replace(/\/$/, ""),
  };
}
