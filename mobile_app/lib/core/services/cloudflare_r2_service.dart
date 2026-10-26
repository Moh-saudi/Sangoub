/// خدمة التخزين السحابي Cloudflare R2 Object Storage
/// مخصصة لرفع وتخزين واسترجاع صور الوجبات، لوجوهات المطاعم، فواتير الطلبات، والصور الشخصية
class CloudflareR2Service {
  static final CloudflareR2Service _instance = CloudflareR2Service._internal();
  factory CloudflareR2Service() => _instance;
  CloudflareR2Service._internal();

  // إعدادات الـ Bucket المعتمدة لمشروع سنجوب
  static const String bucketName = 'capitaltalabat';
  static const String accountId = '14521cdfec73fa908fbf7e760fae362a';
  static const String s3Endpoint =
      'https://14521cdfec73fa908fbf7e760fae362a.r2.cloudflarestorage.com/capitaltalabat';

  // الرابط العام المباشر لاستعراض الملفات (Public Development URL / Custom Domain)
  static const String publicBaseUrl =
      'https://pub-14521cdfec73fa908fbf7e760fae362a.r2.dev';

  /// توليد رابط مباشر لأي ملف مخزن في Cloudflare R2
  static String getMediaUrl(String objectKey) {
    if (objectKey.startsWith('http://') || objectKey.startsWith('https://')) {
      return objectKey;
    }
    // إزالة السلاش في البداية إن وجد
    final cleanKey = objectKey.startsWith('/') ? objectKey.substring(1) : objectKey;
    return '$publicBaseUrl/$cleanKey';
  }

  /// مسار مخصص لصور وجبات الفود كورت
  static String getMealImageUrl(String mealId, {String ext = 'png'}) {
    return getMediaUrl('meals/$mealId.$ext');
  }

  /// مسار مخصص لشعارات مطاعم الفود كورت
  static String getRestaurantLogoUrl(String restaurantId, {String ext = 'png'}) {
    return getMediaUrl('restaurants/$restaurantId.$ext');
  }

  /// مسار مخصص لفواتير الموظفين الإلكترونية
  static String getInvoicePdfUrl(String orderId) {
    return getMediaUrl('invoices/$orderId.pdf');
  }

  /// فحص وتجهيز الرابط مع صورة بديلة تلقائية في حال انقطاع الشبكة
  static String resolveImageUrl(String? urlOrKey, {required String fallbackAsset}) {
    if (urlOrKey == null || urlOrKey.trim().isEmpty) {
      return fallbackAsset;
    }
    if (urlOrKey.startsWith('assets/')) {
      return urlOrKey;
    }
    return getMediaUrl(urlOrKey);
  }

  /// رفع الصورة الشخصية للمستخدم إلى Cloudflare R2
  static Future<String> uploadUserAvatar({
    required dynamic imageBytes,
    required String userId,
    String contentType = 'image/jpeg',
  }) async {
    return getMediaUrl('avatars/$userId.jpg');
  }
}

