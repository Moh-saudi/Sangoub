import 'package:cloud_firestore/cloud_firestore.dart';

class ProductOptionItem {
  final String name;
  final double price;

  const ProductOptionItem({required this.name, required this.price});

  factory ProductOptionItem.fromMap(Map<String, dynamic> map) {
    return ProductOptionItem(
      name: map['name'] as String? ?? '',
      price: (map['price'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class ProductOptionGroup {
  final String id;
  final String title;
  final bool required;
  final List<ProductOptionItem> options;

  const ProductOptionGroup({
    required this.id,
    required this.title,
    this.required = false,
    this.options = const [],
  });

  factory ProductOptionGroup.fromMap(Map<String, dynamic> map) {
    final opts = (map['options'] as List<dynamic>?)
            ?.map((o) => ProductOptionItem.fromMap(Map<String, dynamic>.from(o as Map)))
            .toList() ??
        [];
    return ProductOptionGroup(
      id: map['id'] as String? ?? '',
      title: map['title'] as String? ?? '',
      required: map['required'] as bool? ?? false,
      options: opts,
    );
  }
}

class ProductOption {
  final String name;
  final double additionalPrice;
  final bool isDefault;

  const ProductOption({
    required this.name,
    this.additionalPrice = 0.0,
    this.isDefault = false,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ProductOption && runtimeType == other.runtimeType && name == other.name;

  @override
  int get hashCode => name.hashCode;
}

class ProductModel {
  final String id;
  final String storeId;
  final String storeName;
  final String name;
  final String description;
  final double price;
  final double? originalPrice;
  final String category;
  final String? imageUrl;
  final bool inStock;
  final bool archived;
  final bool isPopular;
  final String? badge;
  final List<ProductOptionGroup> optionGroups;
  final DateTime? updatedAt;

  const ProductModel({
    required this.id,
    required this.storeId,
    required this.storeName,
    required this.name,
    required this.description,
    required this.price,
    this.originalPrice,
    required this.category,
    this.imageUrl,
    this.inStock = true,
    this.archived = false,
    this.isPopular = false,
    this.badge,
    this.optionGroups = const [],
    this.updatedAt,
  });

  /// المنتج متاح للطلب فقط إذا كان متوفراً وغير مؤرشف
  bool get isAvailable => inStock && !archived;

  bool get hasDiscount => originalPrice != null && originalPrice! > price;

  int get discountPercentage {
    if (originalPrice == null || originalPrice! <= price || originalPrice! == 0) return 0;
    return (((originalPrice! - price) / originalPrice!) * 100).round();
  }

  String get effectiveImageUrl =>
      imageUrl ?? 'https://pub-14521cdfec73fa908fbf7e760fae362a.r2.dev/meals/$id.png';

  // للتوافق مع شاشات تفاصيل الوجبات
  String get image => effectiveImageUrl;
  String get restaurantName => storeName;
  int get calories => 380;
  String get preparationTime => '10-15 دقيقة';
  String get prepTime => preparationTime;
  double get rating => 4.8;
  int get reviewsCount => 95;

  List<ProductOption> get sizes {
    for (final group in optionGroups) {
      if (group.title.contains('حجم') || group.title.toLowerCase().contains('size')) {
        return group.options
            .map((o) => ProductOption(name: o.name, additionalPrice: o.price))
            .toList();
      }
    }
    return const [
      ProductOption(name: 'حجم عادي', additionalPrice: 0.0, isDefault: true),
      ProductOption(name: 'حجم كبير (كومبو)', additionalPrice: 25.0),
    ];
  }

  List<ProductOption> get addOns {
    for (final group in optionGroups) {
      if (!group.title.contains('حجم') && !group.title.toLowerCase().contains('size')) {
        return group.options
            .map((o) => ProductOption(name: o.name, additionalPrice: o.price))
            .toList();
      }
    }
    return const [
      ProductOption(name: 'إضافة جبنة شيدر مدخنة', additionalPrice: 15.0),
      ProductOption(name: 'بطاطس مقرمشة مع صوص خاص', additionalPrice: 20.0),
      ProductOption(name: 'مشروب غازي مثلج', additionalPrice: 15.0),
    ];
  }

  factory ProductModel.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};

    DateTime? parseDate(dynamic val) {
      if (val is Timestamp) return val.toDate();
      if (val is String) return DateTime.tryParse(val);
      return null;
    }

    final groups = (data['optionGroups'] as List<dynamic>?)
            ?.map((g) => ProductOptionGroup.fromMap(Map<String, dynamic>.from(g as Map)))
            .toList() ??
        [];

    final bool isArchived = data['archived'] == true;

    return ProductModel(
      id: doc.id,
      storeId: data['storeId'] as String? ?? '',
      storeName: data['storeName'] as String? ?? 'فود كورت العاصمة',
      name: data['name'] as String? ?? '',
      description: data['description'] as String? ?? '',
      price: (data['price'] as num?)?.toDouble() ?? 0.0,
      originalPrice: (data['originalPrice'] as num?)?.toDouble(),
      category: data['category'] as String? ?? 'وجبات',
      imageUrl: data['imageUrl'] as String?,
      inStock: data['inStock'] as bool? ?? true,
      archived: isArchived,
      isPopular: data['isPopular'] as bool? ?? false,
      badge: data['badge'] as String?,
      optionGroups: groups,
      updatedAt: parseDate(data['updatedAt']),
    );
  }
}
