import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

/// بروفايدر إدارة تهيئة السوق وعناوين الأقسام الديناميكية والعروض الترويجية
/// يتيح تغيير العناوين مستقبلاً بسهولة ودون الحاجة لتعديل الكود أو عند التوسع لأسواق متعددة
class AppConfigProvider with ChangeNotifier {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  StreamSubscription<DocumentSnapshot<Map<String, dynamic>>>? _configSub;

  String _marketName = 'العاصمة والمناطق المجاورة';
  String _popularSectionTitle = 'الأكثر طلباً اليوم 🔥';
  String _storesSectionTitle = 'أشهر المطاعم والمتاجر';
  String _mealsSectionTitle = 'أشهى الوجبات والقوائم المتاحة';
  String _offersSectionTitle = 'أقوى العروض والخصومات 🎁';
  bool _hasCustomFirestoreTitle = false;

  List<Map<String, dynamic>> _offersBanners = [];

  String get marketName => _marketName;
  String get popularSectionTitle => _popularSectionTitle;
  String get storesSectionTitle => _storesSectionTitle;
  String get mealsSectionTitle => _mealsSectionTitle;
  String get offersSectionTitle => _offersSectionTitle;
  List<Map<String, dynamic>> get offersBanners => _offersBanners;

  AppConfigProvider() {
    _initDefaultBanners();
    _listenToMarketConfig();
  }

  void _initDefaultBanners() {
    _offersBanners = [
      {
        'image': 'assets/images/slide_1.png',
        'title': 'قسيمة شراء 100 جنيه 🎁',
        'subtitle': 'كود: CAPITAL100 لجميع العملاء والموظفين',
        'tag': 'عرض ترحيبي حصري',
        'gradient': const [Color(0xFFFF5A00), Color(0xFFFF8A00)],
        'icon': Icons.card_giftcard_rounded,
      },
      {
        'image': 'assets/images/slide_2.png',
        'title': 'خصم 40% على الفود كورت 🍔',
        'subtitle': 'على وجبات الغداء والمطاعم المميزة يومياً',
        'tag': 'وجبات الغداء وساعات التوفير',
        'gradient': const [Color(0xFF1B2538), Color(0xFF2C3E5D)],
        'icon': Icons.lunch_dining_rounded,
      },
      {
        'image': 'assets/images/slide_3.png',
        'title': 'توصيل مجاني فوري 🛵',
        'subtitle': 'توصيل سريع ومباشر لموقعك بدقة الـ GPS',
        'tag': 'خدمة سريعة VIP',
        'gradient': const [Color(0xFF0F766E), Color(0xFF14B8A6)],
        'icon': Icons.electric_moped_rounded,
      },
      {
        'image': 'assets/images/slide_4.png',
        'title': 'قهوة الصباح وفطور طازج ☕',
        'subtitle': 'خصم 25% مع كل طلب إفطار قبل الساعة 10 صباحاً',
        'tag': 'إفطار الصباح الذكي',
        'gradient': const [Color(0xFF7C2D12), Color(0xFFB45309)],
        'icon': Icons.local_cafe_rounded,
      },
    ];
  }

  /// الاستماع اللحظي لإعدادات السوق وعناوين الأقسام من Firestore (/app_config/home_sections)
  void _listenToMarketConfig() {
    try {
      _configSub = _firestore
          .collection('app_config')
          .doc('home_sections')
          .snapshots()
          .listen((snapshot) {
        if (snapshot.exists && snapshot.data() != null) {
          final data = snapshot.data()!;
          _marketName = (data['marketName'] as String?) ?? _marketName;
          
          if (data['popularSectionTitle'] is String && (data['popularSectionTitle'] as String).isNotEmpty) {
            _popularSectionTitle = data['popularSectionTitle'];
            _hasCustomFirestoreTitle = true;
          }
          if (data['storesSectionTitle'] is String && (data['storesSectionTitle'] as String).isNotEmpty) {
            _storesSectionTitle = data['storesSectionTitle'];
          }
          if (data['mealsSectionTitle'] is String && (data['mealsSectionTitle'] as String).isNotEmpty) {
            _mealsSectionTitle = data['mealsSectionTitle'];
          }
          if (data['offersSectionTitle'] is String && (data['offersSectionTitle'] as String).isNotEmpty) {
            _offersSectionTitle = data['offersSectionTitle'];
          }

          if (data['offersBanners'] is List && (data['offersBanners'] as List).isNotEmpty) {
            _offersBanners = (data['offersBanners'] as List)
                .map((b) => Map<String, dynamic>.from(b as Map))
                .toList();
          }

          notifyListeners();
        }
      }, onError: (err) {
        debugPrint('AppConfigProvider stream error (using defaults): $err');
      });
    } catch (e) {
      debugPrint('Error attaching app_config stream: $e');
    }
  }

  /// الحصول على عنوان قسم الأكثر طلباً بمرونة وملاءمة للمطاعم والسوبر ماركت
  String getDynamicPopularTitle({String? userAddressTitle}) {
    // إذا كان هناك عنوان مخصص قادم من السيرفر/Firestore له الأولوية
    if (_hasCustomFirestoreTitle) return _popularSectionTitle;

    // تكيف بناءً على موقع العميل
    if (userAddressTitle != null && userAddressTitle.trim().isNotEmpty) {
      final loc = userAddressTitle.toLowerCase();
      if (loc.contains('شروق')) {
        return 'الأكثر طلباً في مدينة الشروق';
      }
      if (loc.contains('مدينتي') || loc.contains('بدر') || loc.contains('r3') || loc.contains('r5') || loc.contains('r7') || loc.contains('عاصمة')) {
        return 'الأكثر طلباً في منطقتك';
      }
    }

    return 'الأصناف الأكثر طلباً ومبيعاً';
  }

  /// تحديث العناوين في Firestore بسهولة عند إضافة سوق جديد
  Future<void> updateMarketTitles({
    String? marketName,
    String? popularTitle,
    String? storesTitle,
    String? mealsTitle,
    String? offersTitle,
  }) async {
    try {
      await _firestore.collection('app_config').doc('home_sections').set({
        if (marketName != null) 'marketName': marketName,
        if (popularTitle != null) 'popularSectionTitle': popularTitle,
        if (storesTitle != null) 'storesSectionTitle': storesTitle,
        if (mealsTitle != null) 'mealsSectionTitle': mealsTitle,
        if (offersTitle != null) 'offersSectionTitle': offersTitle,
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
    } catch (e) {
      debugPrint('Error updating market titles: $e');
    }
  }

  @override
  void dispose() {
    _configSub?.cancel();
    super.dispose();
  }
}
