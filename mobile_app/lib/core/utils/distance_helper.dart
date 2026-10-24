import 'package:geolocator/geolocator.dart';

/// مساعد حساب المسافات وأوقات التوصيل ورسوم الانتقال للمناديب بناءً على الإحداثيات الحقيقية X و Y
/// يدعم التوصيل الذكي متعدد النطاقات (مدينة الشروق، العاصمة الإدارية، مدينة بدر، مدينتي)
class DistanceHelper {
  // المراكز المرجعية لمناطق التغطية والخدمات
  static const double capitalLat = 30.0150;
  static const double capitalLng = 31.7020;

  static const double shoroukLat = 30.1375;
  static const double shoroukLng = 31.6215;

  static const double badrLat = 30.1350;
  static const double badrLng = 31.7300;

  static const double madinatyLat = 30.0980;
  static const double madinatyLng = 31.6450;

  static const double defaultCapitalLat = capitalLat;
  static const double defaultCapitalLng = capitalLng;

  /// المراكز الخدمية الرئيسية
  static const List<Map<String, dynamic>> hubs = [
    {
      'name': 'مدينة الشروق ومحيطها',
      'shortName': 'مدينة الشروق',
      'lat': shoroukLat,
      'lng': shoroukLng,
    },
    {
      'name': 'العاصمة الإدارية (الحي الحكومي والسكني)',
      'shortName': 'العاصمة الإدارية',
      'lat': capitalLat,
      'lng': capitalLng,
    },
    {
      'name': 'مدينة بدر وزهراء العاصمة',
      'shortName': 'مدينة بدر',
      'lat': badrLat,
      'lng': badrLng,
    },
    {
      'name': 'مدينتي',
      'shortName': 'مدينتي',
      'lat': madinatyLat,
      'lng': madinatyLng,
    },
  ];

  /// حساب المسافة الدقيقة بالكيلومتر بين نقطتين على الخريطة
  static double calculateDistanceKm({
    required double startLat,
    required double startLng,
    required double endLat,
    required double endLng,
  }) {
    final meters = Geolocator.distanceBetween(startLat, startLng, endLat, endLng);
    return meters / 1000.0;
  }

  /// تحديد أقرب مركز خدمة/متاجر لموقع العميل
  static Map<String, dynamic> getNearestHub({
    required double customerLat,
    required double customerLng,
  }) {
    Map<String, dynamic> nearest = hubs.first;
    double minDistance = double.infinity;

    for (final hub in hubs) {
      final dist = calculateDistanceKm(
        startLat: hub['lat'] as double,
        startLng: hub['lng'] as double,
        endLat: customerLat,
        endLng: customerLng,
      );
      if (dist < minDistance) {
        minDistance = dist;
        nearest = hub;
      }
    }
    return nearest;
  }

  /// تحديد اسم نطاق التغطية لموقع العميل
  static String getZoneName({
    required double customerLat,
    required double customerLng,
    String? addressHint,
  }) {
    if (addressHint != null && addressHint.trim().isNotEmpty && addressHint != 'الموقع المحدد على الخريطة') {
      return addressHint.trim();
    }

    final hub = getNearestHub(customerLat: customerLat, customerLng: customerLng);
    return hub['shortName'] as String;
  }

  /// حساب المسافة بين متجر/مطعم وإحداثيات العميل
  /// في حال عدم تحديد إحداثيات متجر معين، يقيس المسافة لأقرب مركز خدمة ومتاجر محلية
  static double distanceToCustomer({
    double? storeLat,
    double? storeLng,
    required double customerLat,
    required double customerLng,
  }) {
    if (storeLat != null && storeLng != null) {
      return calculateDistanceKm(
        startLat: storeLat,
        startLng: storeLng,
        endLat: customerLat,
        endLng: customerLng,
      );
    }

    // قياس المسافة بالنسبة لأقرب مركز للمتاجر التابعة لنطاق العميل
    final hub = getNearestHub(customerLat: customerLat, customerLng: customerLng);
    final hubDistance = calculateDistanceKm(
      startLat: hub['lat'] as double,
      startLng: hub['lng'] as double,
      endLat: customerLat,
      endLng: customerLng,
    );

    // إذا كان العميل داخل نطاق المدينة (أقل من 6 كم)، تعتبر مسافة التوصيل المحلية بين 1 إلى 3.5 كم
    if (hubDistance <= 6.0) {
      return (hubDistance * 0.7 + 0.8).clamp(1.0, 4.0);
    }

    return hubDistance;
  }

  /// حساب الوقت التقديري لتوصيل الطلب (دقيقة) بناءً على مسافة الانتقال
  static int estimateDeliveryMinutes(double distanceKm) {
    if (distanceKm <= 3.5) {
      return 20; // 15 دقيقة تحضير وتجهيز + 5 دقائق انتقال محلي
    }
    if (distanceKm <= 7.0) {
      return 30;
    }
    final transit = (distanceKm * 2.0).round();
    return 15 + transit;
  }

  /// نص وقت التوصيل المعروض للعميل
  static String formatDeliveryTime(double distanceKm) {
    if (distanceKm <= 3.5) {
      return '15-25 دقيقة (توصيل محلي سريع)';
    }
    final min = estimateDeliveryMinutes(distanceKm);
    final max = min + 8;
    return '$min-$max دقيقة';
  }

  /// حساب رسوم التوصيل الدقيقة بناءً على المسافة الحقيقية
  static double calculateDeliveryFee(double distanceKm) {
    if (distanceKm <= 3.5) {
      return 15.0; // تسعيرة أساسية للمسافات القريبة داخل النطاق
    }
    if (distanceKm <= 7.0) {
      return 20.0;
    }
    if (distanceKm <= 12.0) {
      return 25.0;
    }
    // 25 جنيه أساسي + 2.0 جنيه لكل كم إضافي
    final fee = 25.0 + ((distanceKm - 12.0) * 2.0);
    return double.parse(fee.toStringAsFixed(1));
  }

  /// تنسيق المسافة لعرضها في البطاقات (مثلاً: 1.8 كم أو 650 م)
  static String formatDistance(double distanceKm) {
    if (distanceKm < 1.0) {
      final meters = (distanceKm * 1000).round();
      return '$meters م';
    }
    return '${distanceKm.toStringAsFixed(1)} كم';
  }
}
