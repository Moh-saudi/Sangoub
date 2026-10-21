import 'package:cloud_firestore/cloud_firestore.dart';

class StoreModel {
  final String id;
  final String name;
  final String nameEn;
  final String type;
  final String category; // 'breakfast' | 'sandwiches' | 'supermarket' | 'cafe' | 'desserts'
  final String status; // 'open' | 'closed' | 'busy'
  final double minOrder;
  final double deliveryFee;
  final String locationInDistrict;
  final String deliveryTime;
  final String? imageUrl;
  final String? bannerUrl;
  final String? logoUrl;
  final double rating;
  final int ratingCount;
  final DateTime? updatedAt;

  const StoreModel({
    required this.id,
    required this.name,
    this.nameEn = '',
    this.type = 'مطعم الحي الحكومي',
    this.category = 'breakfast',
    this.status = 'open',
    this.minOrder = 0.0,
    this.deliveryFee = 15.0,
    this.locationInDistrict = 'فود كورت الحي الحكومي - مبنى C2',
    this.deliveryTime = '15-20 دقيقة',
    this.imageUrl,
    this.bannerUrl,
    this.logoUrl,
    this.rating = 4.8,
    this.ratingCount = 120,
    this.updatedAt,
  });

  bool get isOpen => status == 'open';
  bool get isBusy => status == 'busy';
  bool get isClosed => status == 'closed';

  String get effectiveBanner =>
      imageUrl ?? bannerUrl ?? 'https://pub-14521cdfec73fa908fbf7e760fae362a.r2.dev/restaurants/$id.png';

  String get effectiveLogo =>
      logoUrl ?? 'https://pub-14521cdfec73fa908fbf7e760fae362a.r2.dev/restaurants/$id-logo.png';

  factory StoreModel.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};

    DateTime? parseDate(dynamic val) {
      if (val is Timestamp) return val.toDate();
      if (val is String) return DateTime.tryParse(val);
      return null;
    }

    return StoreModel(
      id: doc.id,
      name: data['name'] as String? ?? 'متجر العاصمة',
      nameEn: data['nameEn'] as String? ?? '',
      type: data['type'] as String? ?? 'فود كورت الحي الحكومي',
      category: data['category'] as String? ?? 'breakfast',
      status: data['status'] as String? ?? 'open',
      minOrder: (data['minOrder'] as num?)?.toDouble() ?? 0.0,
      deliveryFee: (data['deliveryFee'] as num?)?.toDouble() ?? 15.0,
      locationInDistrict: data['locationInDistrict'] as String? ?? 'مجمع الفود كورت المركزي',
      deliveryTime: data['deliveryTime'] as String? ?? '15-25 دقيقة',
      imageUrl: data['imageUrl'] as String?,
      bannerUrl: data['bannerUrl'] as String?,
      logoUrl: data['logoUrl'] as String?,
      rating: (data['rating'] as num?)?.toDouble() ?? 4.8,
      ratingCount: (data['ratingCount'] as num?)?.toInt() ?? 85,
      updatedAt: parseDate(data['updatedAt']),
    );
  }
}
