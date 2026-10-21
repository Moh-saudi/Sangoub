/**
 * Cloudflare R2 Object Storage Service - طلبات الحي الحكومي بالعاصمة الإدارية
 * Bucket: capitaltalabat
 * Account ID: 14521cdfec73fa908fbf7e760fae362a
 * S3 API Endpoint: https://14521cdfec73fa908fbf7e760fae362a.r2.cloudflarestorage.com/capitaltalabat
 */

export const R2_CONFIG = {
  bucketName: 'capitaltalabat',
  accountId: '14521cdfec73fa908fbf7e760fae362a',
  region: 'EEUR',
  s3Endpoint: 'https://14521cdfec73fa908fbf7e760fae362a.r2.cloudflarestorage.com/capitaltalabat',
  publicBaseUrl: 'https://pub-14521cdfec73fa908fbf7e760fae362a.r2.dev',
};

/**
 * تحويل أي مسار أو مفتاح في Cloudflare R2 إلى رابط مباشر كامل
 */
export function getR2MediaUrl(objectKey: string): string {
  if (!objectKey) return '';
  if (objectKey.startsWith('http://') || objectKey.startsWith('https://')) {
    return objectKey;
  }
  const cleanKey = objectKey.startsWith('/') ? objectKey.substring(1) : objectKey;
  return `${R2_CONFIG.publicBaseUrl}/${cleanKey}`;
}

/**
 * رابط صورة الوجبة
 */
export function getR2MealImageUrl(mealId: string, ext = 'png'): string {
  return getR2MediaUrl(`meals/${mealId}.${ext}`);
}

/**
 * رابط شعار المطعم
 */
export function getR2RestaurantLogoUrl(restaurantId: string, ext = 'png'): string {
  return getR2MediaUrl(`restaurants/${restaurantId}.${ext}`);
}

/**
 * رفع صورة مباشرة إلى Cloudflare R2 عبر الـ API
 */
export async function uploadImageToR2(
  file: File | Blob,
  folder: 'meals' | 'restaurants' | 'avatars' | 'invoices' = 'meals',
  customFileName?: string
): Promise<{ success: boolean; url: string; key: string }> {
  try {
    const ext = file instanceof File ? file.name.split('.').pop() || 'png' : 'png';
    const fileName = customFileName || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;
    const objectKey = `${folder}/${fileName}`;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('key', objectKey);
    formData.append('bucket', R2_CONFIG.bucketName);

    const response = await fetch('/api/r2/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`R2 Upload HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      url: data.url || getR2MediaUrl(objectKey),
      key: objectKey,
    };
  } catch (error) {
    console.warn('R2 upload notice (fallback active):', error);
    // إرجاع رابط محلي مؤقت إن تعذر الاتصال المباشر
    const fallbackUrl = file instanceof File ? URL.createObjectURL(file) : '';
    return {
      success: false,
      url: fallbackUrl,
      key: `local-${Date.now()}`,
    };
  }
}
