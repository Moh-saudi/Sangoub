import { auth, saveRecord } from "./firebase";
import { apiUrl } from "./apiUrl";

async function imageRequest(body: object) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("يرجى تسجيل الدخول.");
  const response = await fetch(apiUrl("/api/catalog-images"), {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({ error: "خدمة الصور غير متاحة." }));
  if (!response.ok) throw new Error(result.error || "تعذر رفع الصورة.");
  return result;
}

export function validateCatalogImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("اختر صورة JPG أو PNG أو WebP.");
  if (file.size <= 0 || file.size > 5 * 1024 * 1024)
    throw new Error("حجم الصورة يجب ألا يتجاوز 5 ميجابايت.");
}

export async function uploadCatalogImage(collection: "stores" | "products", id: string, file: File) {
  validateCatalogImage(file);
  const target = await imageRequest({ action: "upload", collection, id, contentType: file.type, size: file.size });
  try {
    const response = await fetch(target.uploadUrl, { method: "PUT", body: file, headers: {
      "Content-Type": file.type, "Cache-Control": "public, max-age=31536000, immutable",
    }});
    if (!response.ok) throw new Error("تعذر رفع الصورة إلى R2. راجع إعداد CORS للحاوية.");
    return { key: target.key as string, url: target.publicUrl as string };
  } catch (error) {
    await imageRequest({ action: "delete", key: target.key }).catch(() => {});
    throw error;
  }
}

export async function saveCatalogWithImages(
  collection: "stores" | "products",
  id: string,
  data: Record<string, unknown>,
  images: { field: string; file: File | null }[],
) {
  const selected = images.filter((image) => image.file && image.file.size > 0);
  for (const image of selected) validateCatalogImage(image.file!);
  const uploaded: string[] = [];
  try {
    for (const image of selected) {
      const file = image.file!;
      const target = await uploadCatalogImage(collection, id, file);
      uploaded.push(target.key);
      data[image.field] = target.url;
      if (collection === "stores" && image.field === "bannerUrl") data.imageUrl = target.url;
    }
    await saveRecord(collection, id, data);
  } catch (error) {
    await Promise.allSettled(uploaded.map((key) => imageRequest({ action: "delete", key })));
    throw error;
  }
}
