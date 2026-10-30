import { supabase } from "./supabase";
import { authenticatedApi } from "./authenticatedApi";

export function validateCatalogImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("اختر صورة JPG أو PNG أو WebP.");
  if (file.size <= 0 || file.size > 5 * 1024 * 1024)
    throw new Error("حجم الصورة يجب ألا يتجاوز 5 ميجابايت.");
}

export async function uploadCatalogImage(
  collection: "stores" | "products",
  id: string,
  file: File
): Promise<{ key: string; url: string }> {
  validateCatalogImage(file);

  // 1. Try Cloudflare R2 first via /api/catalog-images
  try {
    const target = await authenticatedApi("/api/catalog-images", {
      action: "upload",
      collection,
      id,
      contentType: file.type,
      size: file.size,
    });

    if (target?.uploadUrl && target?.publicUrl) {
      const response = await fetch(target.uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });

      if (response.ok) {
        return { key: target.key as string, url: target.publicUrl as string };
      }
    }
  } catch (err) {
    console.warn("Cloudflare R2 not configured or unavailable, using Supabase Storage fallback:", err);
  }

  // 2. High-speed Fallback: Supabase Storage Bucket 'catalog-images'
  const fileExt = file.type.split("/")[1] || "jpg";
  const filePath = `catalog/${collection}/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from("catalog-images")
    .upload(filePath, file, {
      cacheControl: "31536000",
      upsert: true,
      contentType: file.type,
    });

  if (error) {
    console.error("Storage upload error:", error);
    throw new Error("تعذر رفع الصورة. تحقق من اتصال الإنترنت وحجم الملف.");
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("catalog-images").getPublicUrl(data.path);

  return { key: data.path, url: publicUrl };
}

export async function saveCatalogWithImages(
  collection: "stores" | "products",
  id: string,
  data: Record<string, unknown>,
  images: { field: string; file: File | null }[]
) {
  const selected = images.filter((image) => image.file && image.file.size > 0);
  for (const image of selected) validateCatalogImage(image.file!);

  const updates: Record<string, string> = {};
  for (const image of selected) {
    const target = await uploadCatalogImage(collection, id, image.file!);
    updates[image.field] = target.url;
  }

  return { ...data, ...updates };
}
