import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../core/constants/colors.dart';
import '../core/utils/distance_helper.dart';
import 'ministry_model.dart';

enum OrderStatus {
  received,     // استلم الخادم الطلب
  preparing,    // جاري التحضير في المطبخ
  ready,        // الطلب جاهز للتسليم
  withCourier,  // تم تكليف المندوب وهو في الطريق
  delivered,    // تم التسليم للعميل
  cancelled;    // ملغي

  static OrderStatus get pendingChef => OrderStatus.received;
  static OrderStatus get cooking => OrderStatus.preparing;
  static OrderStatus get readyForPickup => OrderStatus.ready;
  static OrderStatus get outForDelivery => OrderStatus.withCourier;
}

extension OrderStatusExtension on OrderStatus {
  String get rawValue {
    switch (this) {
      case OrderStatus.received:
        return 'received';
      case OrderStatus.preparing:
        return 'preparing';
      case OrderStatus.ready:
        return 'ready';
      case OrderStatus.withCourier:
        return 'with_courier';
      case OrderStatus.delivered:
        return 'delivered';
      case OrderStatus.cancelled:
        return 'cancelled';
    }
  }

  String get arabicLabel {
    switch (this) {
      case OrderStatus.received:
        return 'تم استلام الطلب ⏳';
      case OrderStatus.preparing:
        return 'جاري التحضير في المطبخ 👨‍🍳';
      case OrderStatus.ready:
        return 'جاهز لاستلام المندوب 🛍️';
      case OrderStatus.withCourier:
        return 'المندوب في الطريق لمكتبك 🛵';
      case OrderStatus.delivered:
        return 'تم التسليم بنجاح ✅';
      case OrderStatus.cancelled:
        return 'تم الإلغاء ❌';
    }
  }

  Color get color {
    switch (this) {
      case OrderStatus.received:
        return AppColors.statusPending;
      case OrderStatus.preparing:
        return AppColors.statusCooking;
      case OrderStatus.ready:
        return AppColors.statusReady;
      case OrderStatus.withCourier:
        return AppColors.statusOnTheWay;
      case OrderStatus.delivered:
        return AppColors.statusDelivered;
      case OrderStatus.cancelled:
        return AppColors.statusCancelled;
    }
  }

  IconData get icon {
    switch (this) {
      case OrderStatus.received:
        return Icons.receipt_long_outlined;
      case OrderStatus.preparing:
        return Icons.restaurant;
      case OrderStatus.ready:
        return Icons.shopping_bag_outlined;
      case OrderStatus.withCourier:
        return Icons.two_wheeler;
      case OrderStatus.delivered:
        return Icons.check_circle_outline;
      case OrderStatus.cancelled:
        return Icons.cancel_outlined;
    }
  }

  static OrderStatus fromString(String? raw) {
    switch (raw) {
      case 'preparing':
      case 'cooking':
        return OrderStatus.preparing;
      case 'ready':
      case 'readyForPickup':
        return OrderStatus.ready;
      case 'with_courier':
      case 'outForDelivery':
        return OrderStatus.withCourier;
      case 'delivered':
        return OrderStatus.delivered;
      case 'cancelled':
        return OrderStatus.cancelled;
      case 'received':
      case 'pendingChef':
      default:
        return OrderStatus.received;
    }
  }
}

class OrderItem {
  final String id;
  final String productId;
  final String storeId;
  final String name;
  final double price;
  final int quantity;
  final double extraPrice;
  final Map<String, String> selectedOptions;
  final String? notes;

  const OrderItem({
    required this.id,
    required this.productId,
    this.storeId = '',
    required this.name,
    required this.price,
    required this.quantity,
    this.extraPrice = 0.0,
    this.selectedOptions = const {},
    this.notes,
  });

  factory OrderItem.fromMap(Map<String, dynamic> map) {
    final prod = map['product'] as Map<String, dynamic>?;
    return OrderItem(
      id: map['id'] as String? ?? '',
      productId: prod?['id'] as String? ?? (map['id'] as String? ?? ''),
      storeId: prod?['storeId'] as String? ?? '',
      name: prod?['name'] as String? ?? (map['name'] as String? ?? ''),
      price: (prod?['price'] as num?)?.toDouble() ??
          ((map['price'] as num?)?.toDouble() ?? 0.0),
      quantity: (map['quantity'] as num?)?.toInt() ?? 1,
      extraPrice: (map['extraPrice'] as num?)?.toDouble() ?? 0.0,
      selectedOptions: (map['selectedOptions'] as Map?)?.map(
            (k, v) => MapEntry(k.toString(), v.toString()),
          ) ??
          {},
      notes: map['notes'] as String?,
    );
  }
}

class OrderModel {
  final String id; // معرف المستند في Firestore (uid_ord-uuid)
  final String orderNumber; // كود العرض (CAP-XXXX)
  final String profileId;
  final String customerName;
  final String customerPhone;
  final String ministryName;
  final String floor;
  final String officeNumber;
  final List<OrderItem> items;
  final List<String> storeIds;
  final Map<String, String> kitchenStatus;
  final String restaurantName;
  final String itemsSummary;
  final double subtotal;
  final double deliveryFee;
  final double discount;
  final double tip;
  final double total;
  final String paymentMethod;
  final String paymentStatus;
  final OrderStatus status;
  final String? courierId;
  final String? courierName;
  final String? courierPhone;
  final Map<String, dynamic>? courierChecklist;
  final String? otpCode; // يتم جلبه حصرياً عبر /api/order-delivery للعميل
  final DateTime createdAt;
  final DateTime? readyAt;
  final DateTime? deliveredAt;
  final String estimatedDelivery;
  final double? customerLat;
  final double? customerLng;
  final double? storeLat;
  final double? storeLng;
  final double? courierLat;
  final double? courierLng;

  const OrderModel({
    required this.id,
    required this.orderNumber,
    required this.profileId,
    required this.customerName,
    required this.customerPhone,
    required this.ministryName,
    required this.floor,
    required this.officeNumber,
    required this.items,
    required this.storeIds,
    required this.kitchenStatus,
    required this.restaurantName,
    required this.itemsSummary,
    required this.subtotal,
    required this.deliveryFee,
    required this.discount,
    this.tip = 0.0,
    required this.total,
    this.paymentMethod = 'cash',
    this.paymentStatus = 'cash_on_delivery',
    required this.status,
    this.courierId,
    this.courierName,
    this.courierPhone,
    this.courierChecklist,
    this.otpCode,
    required this.createdAt,
    this.readyAt,
    this.deliveredAt,
    this.estimatedDelivery = '15-25 دقيقة',
    this.customerLat,
    this.customerLng,
    this.storeLat,
    this.storeLng,
    this.courierLat,
    this.courierLng,
  });

  String get buildingNumber => 'مبنى الوزارة C2';
  String get floorNumber => floor;
  String get roomNumber => officeNumber;

  /// إحداثيات العميل الحقيقية الفعالة (GPS أو من اسم الوزارة/الحي أو العاصمة الافتراضية)
  double get effectiveCustomerLat {
    if (customerLat != null && customerLat != 0.0) return customerLat!;
    for (final loc in MinistryModel.allCapitalLocations) {
      if (ministryName.contains(loc.nameArabic) || loc.nameArabic.contains(ministryName)) {
        return loc.latitude;
      }
    }
    if (ministryName.contains('شروق') || ministryName.contains('الشروق')) {
      return DistanceHelper.shoroukLat;
    }
    if (ministryName.contains('بدر') || ministryName.contains('زهرة العاصمة')) {
      return DistanceHelper.badrLat;
    }
    if (ministryName.contains('مدينتي')) {
      return DistanceHelper.madinatyLat;
    }
    return DistanceHelper.capitalLat;
  }

  double get effectiveCustomerLng {
    if (customerLng != null && customerLng != 0.0) return customerLng!;
    for (final loc in MinistryModel.allCapitalLocations) {
      if (ministryName.contains(loc.nameArabic) || loc.nameArabic.contains(ministryName)) {
        return loc.longitude;
      }
    }
    if (ministryName.contains('شروق') || ministryName.contains('الشروق')) {
      return DistanceHelper.shoroukLng;
    }
    if (ministryName.contains('بدر') || ministryName.contains('زهرة العاصمة')) {
      return DistanceHelper.badrLng;
    }
    if (ministryName.contains('مدينتي')) {
      return DistanceHelper.madinatyLng;
    }
    return DistanceHelper.capitalLng;
  }

  /// إحداثيات المتجر أو المطبخ المركزي الفود كورت
  double get effectiveStoreLat => storeLat ?? 30.0165;
  double get effectiveStoreLng => storeLng ?? 31.7010;

  /// إحداثيات المندوب الحالية (إما حقيقية أو استقراء نسبي على المسار)
  double get effectiveCourierLat {
    if (courierLat != null && courierLat != 0.0) return courierLat!;
    if (status == OrderStatus.delivered) return effectiveCustomerLat;
    if (status == OrderStatus.withCourier) {
      // إذا كان في الطريق ولم يرسل الـ GPS بعد، نضعه في منتصف المسار باتجاه العميل
      return (effectiveStoreLat * 0.4) + (effectiveCustomerLat * 0.6);
    }
    return effectiveStoreLat;
  }

  double get effectiveCourierLng {
    if (courierLng != null && courierLng != 0.0) return courierLng!;
    if (status == OrderStatus.delivered) return effectiveCustomerLng;
    if (status == OrderStatus.withCourier) {
      return (effectiveStoreLng * 0.4) + (effectiveCustomerLng * 0.6);
    }
    return effectiveStoreLng;
  }

  factory OrderModel.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};

    DateTime parseDate(dynamic val) {
      if (val is Timestamp) return val.toDate();
      if (val is String) {
        final d = DateTime.tryParse(val);
        if (d != null) return d;
      }
      return DateTime.now();
    }

    DateTime? parseDateNullable(dynamic val) {
      if (val is Timestamp) return val.toDate();
      if (val is String) return DateTime.tryParse(val);
      return null;
    }

    final rawItems = (data['items'] as List<dynamic>?)
            ?.map((i) => OrderItem.fromMap(Map<String, dynamic>.from(i as Map)))
            .toList() ??
        [];

    final rawStoreIds = (data['storeIds'] as List<dynamic>?)
            ?.map((s) => s.toString())
            .toList() ??
        [];

    final rawKitchenStatus = (data['kitchenStatus'] as Map?)?.map(
          (k, v) => MapEntry(k.toString(), v.toString()),
        ) ??
        {};

    final coords = data['coordinates'] as Map<String, dynamic>?;
    final double? cLat = (coords?['latitude'] as num?)?.toDouble() ??
        (data['customerLat'] as num?)?.toDouble() ??
        (data['lat'] as num?)?.toDouble();
    final double? cLng = (coords?['longitude'] as num?)?.toDouble() ??
        (data['customerLng'] as num?)?.toDouble() ??
        (data['lng'] as num?)?.toDouble();

    final courierCoords = data['courierCoordinates'] as Map<String, dynamic>?;
    final double? courLat = (courierCoords?['latitude'] as num?)?.toDouble() ??
        (data['courierLat'] as num?)?.toDouble();
    final double? courLng = (courierCoords?['longitude'] as num?)?.toDouble() ??
        (data['courierLng'] as num?)?.toDouble();

    final storeCoords = data['storeCoordinates'] as Map<String, dynamic>?;
    final double? sLat = (storeCoords?['latitude'] as num?)?.toDouble() ??
        (data['storeLat'] as num?)?.toDouble();
    final double? sLng = (storeCoords?['longitude'] as num?)?.toDouble() ??
        (data['storeLng'] as num?)?.toDouble();

    return OrderModel(
      id: doc.id,
      orderNumber: data['orderNumber'] as String? ?? 'CAP-${doc.id.substring(0, doc.id.length > 6 ? 6 : doc.id.length).toUpperCase()}',
      profileId: data['profileId'] as String? ?? '',
      customerName: data['profileName'] as String? ?? 'موظف حكومي',
      customerPhone: data['phone'] as String? ?? '',
      ministryName: data['ministry'] as String? ?? 'الحي الحكومي',
      floor: data['floorNumber'] as String? ?? '',
      officeNumber: data['roomNumber'] as String? ?? '',
      items: rawItems,
      storeIds: rawStoreIds,
      kitchenStatus: rawKitchenStatus,
      restaurantName: data['restaurantName'] as String? ?? 'فود كورت العاصمة',
      itemsSummary: data['itemsSummary'] as String? ?? '',
      subtotal: (data['subtotal'] as num?)?.toDouble() ?? 0.0,
      deliveryFee: (data['deliveryFee'] as num?)?.toDouble() ?? 0.0,
      discount: (data['discount'] as num?)?.toDouble() ?? 0.0,
      tip: (data['tip'] as num?)?.toDouble() ?? 0.0,
      total: (data['total'] as num?)?.toDouble() ?? 0.0,
      paymentMethod: data['paymentMethod'] as String? ?? 'cash',
      paymentStatus: data['paymentStatus'] as String? ?? 'cash_on_delivery',
      status: OrderStatusExtension.fromString(data['orderStatus'] as String?),
      courierId: data['courierId'] as String?,
      courierName: data['courierName'] as String?,
      courierPhone: data['courierPhone'] as String?,
      courierChecklist: (data['courierChecklist'] as Map?)?.cast<String, dynamic>(),
      otpCode: data['otpCode'] as String?, // اختياري في حال وجد
      createdAt: parseDate(data['createdAt']),
      readyAt: parseDateNullable(data['readyAt']),
      deliveredAt: parseDateNullable(data['deliveredAt']),
      estimatedDelivery: data['estimatedDelivery'] as String? ?? '15-25 دقيقة',
      customerLat: cLat,
      customerLng: cLng,
      storeLat: sLat,
      storeLng: sLng,
      courierLat: courLat,
      courierLng: courLng,
    );
  }

  OrderModel copyWith({
    OrderStatus? status,
    String? otpCode,
    String? courierName,
    String? courierPhone,
    Map<String, String>? kitchenStatus,
    double? customerLat,
    double? customerLng,
    double? storeLat,
    double? storeLng,
    double? courierLat,
    double? courierLng,
  }) {
    return OrderModel(
      id: id,
      orderNumber: orderNumber,
      profileId: profileId,
      customerName: customerName,
      customerPhone: customerPhone,
      ministryName: ministryName,
      floor: floor,
      officeNumber: officeNumber,
      items: items,
      storeIds: storeIds,
      kitchenStatus: kitchenStatus ?? this.kitchenStatus,
      restaurantName: restaurantName,
      itemsSummary: itemsSummary,
      subtotal: subtotal,
      deliveryFee: deliveryFee,
      discount: discount,
      tip: tip,
      total: total,
      paymentMethod: paymentMethod,
      paymentStatus: paymentStatus,
      status: status ?? this.status,
      courierId: courierId,
      courierName: courierName ?? this.courierName,
      courierPhone: courierPhone ?? this.courierPhone,
      courierChecklist: courierChecklist,
      otpCode: otpCode ?? this.otpCode,
      createdAt: createdAt,
      readyAt: readyAt,
      deliveredAt: deliveredAt,
      estimatedDelivery: estimatedDelivery,
      customerLat: customerLat ?? this.customerLat,
      customerLng: customerLng ?? this.customerLng,
      storeLat: storeLat ?? this.storeLat,
      storeLng: storeLng ?? this.storeLng,
      courierLat: courierLat ?? this.courierLat,
      courierLng: courierLng ?? this.courierLng,
    );
  }
}

