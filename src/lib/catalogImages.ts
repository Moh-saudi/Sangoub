import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage, saveRecord } from "./firebase";

export function validateCatalogImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("اختر صورة JPG أو PNG أو WebP.");
  if (file.size <= 0 || file.size > 5 * 1024 * 1024)
    throw new Error("حجم الصورة يجب ألا يتجاوز 5 ميجابايت.");
}

export async function saveCatalogWithImages(
  collection: "stores" | "products",
  id: string,
  data: Record<string, unknown>,
  images: { field: string; file: File | null }[],
) {
  const selected = images.filter((image) => image.file && image.file.size > 0);
  for (const image of selected) validateCatalogImage(image.file!);
  const uploaded: ReturnType<typeof ref>[] = [];
  try {
    for (const image of selected) {
      const file = image.file!;
      const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type];
      const target = ref(storage, `catalog/${collection}/${id}/${crypto.randomUUID()}.${extension}`);
      await uploadBytes(target, file, { contentType: file.type });
      uploaded.push(target);
      data[image.field] = await getDownloadURL(target);
    }
    await saveRecord(collection, id, data);
  } catch (error) {
    await Promise.allSettled(uploaded.map((target) => deleteObject(target)));
    throw error;
  }
}
