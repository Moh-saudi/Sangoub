// Compatibility facade for the mobile branch's web helper. Uploads use the
// authenticated, scoped catalog endpoint; never return temporary blob URLs.
import { uploadCatalogImage } from "./catalogImages";
export const R2_CONFIG = {
  bucketName: "capitaltalabat",
  accountId: "14521cdfec73fa908fbf7e760fae362a",
  region: "EEUR",
  s3Endpoint: "https://14521cdfec73fa908fbf7e760fae362a.r2.cloudflarestorage.com/capitaltalabat",
  publicBaseUrl: import.meta.env.VITE_R2_PUBLIC_URL || "",
};
export function getR2MediaUrl(objectKey: string): string {
  if (!objectKey) return "";
  if (objectKey.startsWith("https://")) return objectKey;
  if (!R2_CONFIG.publicBaseUrl) return "";
  const base = new URL(R2_CONFIG.publicBaseUrl);
  if (base.protocol !== "https:") return "";
  const result = new URL(objectKey.replace(/^\/+/, ""), base.href.replace(/\/$/, "") + "/");
  return result.protocol === "https:" ? result.href : "";
}
export const getR2MealImageUrl = (id: string, ext = "png") => getR2MediaUrl(`meals/${id}.${ext}`);
export const getR2RestaurantLogoUrl = (id: string, ext = "png") => getR2MediaUrl(`restaurants/${id}.${ext}`);
export async function uploadImageToR2(file: File | Blob, folder: "meals" | "restaurants" | "avatars" | "invoices" = "meals", customFileName?: string) {
  if (folder !== "meals" && folder !== "restaurants") throw new Error("هذا المسار مخصص لصور الكتالوج العامة فقط.");
  const id = customFileName?.replace(/\.[^.]+$/, "") || crypto.randomUUID();
  if (!/^[\w-]{1,128}$/.test(id)) throw new Error("معرف صورة غير صالح.");
  const image = file instanceof File ? file : new File([file], "image", { type: file.type });
  const result = await uploadCatalogImage(folder === "meals" ? "products" : "stores", id, image);
  return { success: true, url: result.url, key: result.key };
}
