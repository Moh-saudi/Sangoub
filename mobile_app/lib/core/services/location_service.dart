import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../../models/ministry_model.dart';

/// ─── خدمة الموقع والخرائط والمسافات الحقيقية ──────────────────────────────
/// تحسب المسافة الحقيقية بدقة جغرافية بمعادلة Haversine
/// وتربط الموقع المختار مباشرة بحسابات الفاتورة المالية ورسوم التوصيل
class LocationService {
  LocationService._();
  static final LocationService instance = LocationService._();

  // ─── إحداثيات الفود كورت (نقطة انطلاق التوصيل المركزية) ─────────────────
  // مركز الحي الحكومي بالعاصمة الإدارية الجديدة
  static const double kFoodCourtLat = 30.0138;
  static const double kFoodCourtLng = 31.7055;

  // إحداثيات مدينة الشروق الافتراضية (سكن الموظفين)
  static const double kShoroukLat = 30.1320;
  static const double kShoroukLng = 31.6280;

  // ─── مناطق رسوم التوصيل والتعرفة المالية ───────────────────────────────
  // المنطقة 1: داخل الحي الحكومي والوزارات (0 - 2 كم) → 8 جنيه
  // المنطقة 2: الأحياء السكنية بالعاصمة R1-R7 والنهر الأخضر (2 - 7 كم) → 15 جنيه
  // المنطقة 3: حي المال والأعمال CBD والداون تاون (7 - 12 كم) → 22 جنيه
  // المنطقة 4: المدن المجاورة (الشروق، مدينتي، بدر، المستقبل 12 - 32 كم) → 30 جنيه
  // المنطقة 5: خارج النطاق (> 32 كم) → غير متاح
  static const List<DeliveryZone> deliveryZones = [
    DeliveryZone(
      id: 'zone_gov',
      nameAr: 'داخل الحي الحكومي والوزارات',
      maxKm: 2.0,
      feePerStore: 8.0,
      etaMinutes: '15-25',
      color: 0xFF10B981,
    ),
    DeliveryZone(
      id: 'zone_residential',
      nameAr: 'الأحياء السكنية بالعاصمة',
      maxKm: 7.0,
      feePerStore: 15.0,
      etaMinutes: '25-40',
      color: 0xFFF59E0B,
    ),
    DeliveryZone(
      id: 'zone_cbd',
      nameAr: 'حي المال والأعمال والداون تاون',
      maxKm: 12.0,
      feePerStore: 22.0,
      etaMinutes: '35-55',
      color: 0xFF6366F1,
    ),
    DeliveryZone(
      id: 'zone_surrounding',
      nameAr: 'المدن المجاورة (الشروق / مدينتي)',
      maxKm: 32.0,
      feePerStore: 30.0,
      etaMinutes: '45-75',
      color: 0xFF8B5CF6,
    ),
  ];

  /// حساب المسافة بين نقطتين بمعادلة Haversine (بالكيلومتر)
  static double haversineKm(
    double lat1, double lng1,
    double lat2, double lng2,
  ) {
    const earthRadius = 6371.0; // كم
    final dLat = _toRad(lat2 - lat1);
    final dLng = _toRad(lng2 - lng1);
    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(_toRad(lat1)) * cos(_toRad(lat2)) *
        sin(dLng / 2) * sin(dLng / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return earthRadius * c;
  }

  static double _toRad(double deg) => deg * pi / 180;

  /// فحص هل الإحداثيات داخل مصر (لتفادي إحداثيات محاكي أندرويد الافتراضية بكاليفورنيا)
  static bool isInEgypt(double lat, double lng) {
    return lat >= 21.5 && lat <= 32.5 && lng >= 24.5 && lng <= 37.0;
  }

  /// رسوم التوصيل الفعلية للوزارة/الموقع بناءً على المسافة
  static DeliveryInfo getDeliveryInfo(MinistryModel ministry, {int storeCount = 1}) {
    final km = haversineKm(
      kFoodCourtLat, kFoodCourtLng,
      ministry.latitude, ministry.longitude,
    );
    return getDeliveryInfoByDistance(km, storeCount: storeCount);
  }

  /// حساب رسوم التوصيل المالية بناءً على المسافة وعدد المتاجر
  static DeliveryInfo getDeliveryInfoByDistance(double km, {int storeCount = 1}) {
    DeliveryZone? zone;
    for (final z in deliveryZones) {
      if (km <= z.maxKm) {
        zone = z;
        break;
      }
    }

    if (zone == null) {
      return DeliveryInfo(
        distanceKm: km,
        feeTotal: 0,
        feePerStore: 0,
        etaMinutes: '—',
        zoneName: 'خارج نطاق التوصيل المباشر',
        zoneColor: 0xFF94A3B8,
        isAvailable: false,
      );
    }

    final sc = storeCount > 0 ? storeCount : 1;
    return DeliveryInfo(
      distanceKm: km,
      feeTotal: zone.feePerStore * sc,
      feePerStore: zone.feePerStore,
      etaMinutes: zone.etaMinutes,
      zoneName: zone.nameAr,
      zoneColor: zone.color,
      isAvailable: true,
    );
  }

  /// إيجاد أقرب وزارة أو معلم من إحداثيات المستخدم الحقيقية
  static MinistryModel findNearest(double userLat, double userLng) {
    // إذا كان في محاكي بإحداثيات أمريكا الافتراضية، التوجيه لمدينة الشروق تلقائياً
    if (!isInEgypt(userLat, userLng)) {
      return MinistryModel.allMinistries.firstWhere(
        (m) => m.id == 'shorouk_city',
        orElse: () => MinistryModel.allMinistries.first,
      );
    }

    MinistryModel nearest = MinistryModel.allMinistries.first;
    double minDist = double.infinity;
    for (final m in MinistryModel.allMinistries) {
      final d = haversineKm(userLat, userLng, m.latitude, m.longitude);
      if (d < minDist) {
        minDist = d;
        nearest = m;
      }
    }
    return nearest;
  }

  /// طلب صلاحية الموقع وجلب الإحداثيات الحقيقية للجهاز
  Future<Position?> getCurrentPosition() async {
    try {
      LocationPermission perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.deniedForever) return null;

      Position? pos;
      try {
        pos = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            timeLimit: Duration(seconds: 5),
          ),
        );
      } catch (_) {
        pos = await Geolocator.getLastKnownPosition();
      }

      // إذا كانت إحداثيات المحاكي الافتراضية خارج مصر، صححها للشروق
      if (pos != null && !isInEgypt(pos.latitude, pos.longitude)) {
        debugPrint('⚠️ تم رصد إحداثيات محاكي خارج مصر (${pos.latitude}, ${pos.longitude})، ضبط على مدينة الشروق');
        return Position(
          latitude: kShoroukLat,
          longitude: kShoroukLng,
          timestamp: DateTime.now(),
          accuracy: 10.0,
          altitude: 0.0,
          altitudeAccuracy: 0.0,
          heading: 0.0,
          headingAccuracy: 0.0,
          speed: 0.0,
          speedAccuracy: 0.0,
        );
      }

      return pos;
    } catch (e) {
      debugPrint('⚠️ تعذر جلب موقع GPS: $e');
      return null;
    }
  }

  /// جلب اسم العنوان الحقيقي بالعربية (عبر خوادم OpenStreetMap Nominatim الرسمية)
  Future<String?> reverseGeocode(double lat, double lng) async {
    try {
      final uri = Uri.parse(
        'https://nominatim.openstreetmap.org/reverse?format=json&lat=$lat&lon=$lng&accept-language=ar',
      );
      final resp = await http.get(uri, headers: {
        'User-Agent': 'CapitalTalabatApp/1.0 (mo.saudi19@gmail.com)',
      }).timeout(const Duration(seconds: 4));

      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body) as Map<String, dynamic>;
        final address = data['address'] as Map<String, dynamic>?;
        if (address != null) {
          final suburb = address['suburb'] ?? address['neighbourhood'] ?? address['city_district'];
          final city = address['city'] ?? address['town'] ?? address['village'] ?? address['state'];
          final road = address['road'];

          if (suburb != null && city != null) {
            return '$suburb، $city';
          }
          if (suburb != null) return suburb.toString();
          if (city != null) return city.toString();
          if (road != null) return road.toString();
        }
        final displayName = data['display_name'] as String?;
        if (displayName != null && displayName.isNotEmpty) {
          final parts = displayName.split(',');
          return parts.take(2).join('، ');
        }
      }
    } catch (e) {
      debugPrint('⚠️ فشل جلب اسم العنوان من الخريطة: $e');
    }
    return null;
  }

  // ─── حفظ واسترجاع آخر موقع تم اختياره ──────────────────────────────
  static const String _kKeyLocName = 'last_selected_loc_name';
  static const String _kKeyLocLat = 'last_selected_loc_lat';
  static const String _kKeyLocLng = 'last_selected_loc_lng';

  Future<void> saveSelectedLocation({
    required String name,
    required double lat,
    required double lng,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kKeyLocName, name);
      await prefs.setDouble(_kKeyLocLat, lat);
      await prefs.setDouble(_kKeyLocLng, lng);
    } catch (_) {}
  }

  Future<Map<String, dynamic>?> getSavedLocation() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final name = prefs.getString(_kKeyLocName);
      final lat = prefs.getDouble(_kKeyLocLat);
      final lng = prefs.getDouble(_kKeyLocLng);
      if (name != null && lat != null && lng != null) {
        return {'name': name, 'lat': lat, 'lng': lng};
      }
    } catch (_) {}
    return null;
  }
}

// ─── نموذج منطقة التوصيل ───────────────────────────────────────────────────
class DeliveryZone {
  final String id;
  final String nameAr;
  final double maxKm;
  final double feePerStore;
  final String etaMinutes;
  final int color;

  const DeliveryZone({
    required this.id,
    required this.nameAr,
    required this.maxKm,
    required this.feePerStore,
    required this.etaMinutes,
    required this.color,
  });
}

// ─── نتيجة حساب التوصيل ────────────────────────────────────────────────────
class DeliveryInfo {
  final double distanceKm;
  final double feeTotal;
  final double feePerStore;
  final String etaMinutes;
  final String zoneName;
  final int zoneColor;
  final bool isAvailable;

  const DeliveryInfo({
    required this.distanceKm,
    required this.feeTotal,
    this.feePerStore = 0,
    required this.etaMinutes,
    required this.zoneName,
    required this.zoneColor,
    required this.isAvailable,
  });

  String get distanceLabel {
    if (distanceKm < 1.0) return '${(distanceKm * 1000).round()} م';
    return '${distanceKm.toStringAsFixed(1)} كم';
  }

  String get feeLabel => feeTotal > 0 ? '${feeTotal.toStringAsFixed(0)} جنيه' : 'مجاني';
}
