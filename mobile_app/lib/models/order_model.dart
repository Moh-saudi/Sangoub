import 'package:flutter/material.dart';
import '../core/constants/colors.dart';

enum OrderStatus {
  pendingChef,    // بانتظار موافقة الشيف
  cooking,        // جاري تحضير الوجبة في المطبخ
  readyForPickup, // جاهز لاستلام المندوب
  outForDelivery, // في الطريق إلى الوزارة
  delivered,      // تم التسليم للموظف
  cancelled,      // ملغي
}

extension OrderStatusExtension on OrderStatus {
  String get arabicLabel {
    switch (this) {
      case OrderStatus.pendingChef:
        return 'بانتظار تأكيد الشيف';
      case OrderStatus.cooking:
        return 'جاري التحضير في المطبخ 👨‍🍳';
      case OrderStatus.readyForPickup:
        return 'جاهز للاستلام بالمطعم';
      case OrderStatus.outForDelivery:
        return 'المندوب في الطريق لمكتبك 🛵';
      case OrderStatus.delivered:
        return 'تم التسليم بنجاح ✅';
      case OrderStatus.cancelled:
        return 'تم الإلغاء ❌';
    }
  }

  Color get color {
    switch (this) {
      case OrderStatus.pendingChef:
        return AppColors.statusPending;
      case OrderStatus.cooking:
        return AppColors.statusCooking;
      case OrderStatus.readyForPickup:
        return AppColors.statusReady;
      case OrderStatus.outForDelivery:
        return AppColors.statusOnTheWay;
      case OrderStatus.delivered:
        return AppColors.statusDelivered;
      case OrderStatus.cancelled:
        return AppColors.statusCancelled;
    }
  }

  IconData get icon {
    switch (this) {
      case OrderStatus.pendingChef:
        return Icons.timer_outlined;
      case OrderStatus.cooking:
        return Icons.restaurant;
      case OrderStatus.readyForPickup:
        return Icons.shopping_bag_outlined;
      case OrderStatus.outForDelivery:
        return Icons.two_wheeler;
      case OrderStatus.delivered:
        return Icons.check_circle_outline;
      case OrderStatus.cancelled:
        return Icons.cancel_outlined;
    }
  }
}

class OrderItem {
  final String id;
  final String name;
  final double price;
  final int quantity;
  final String? notes;

  const OrderItem({
    required this.id,
    required this.name,
    required this.price,
    required this.quantity,
    this.notes,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'price': price,
      'quantity': quantity,
      'notes': notes,
    };
  }

  factory OrderItem.fromMap(Map<String, dynamic> map) {
    return OrderItem(
      id: map['id'] ?? '',
      name: map['name'] ?? '',
      price: (map['price'] as num?)?.toDouble() ?? 0.0,
      quantity: (map['quantity'] as num?)?.toInt() ?? 1,
      notes: map['notes'],
    );
  }
}

class OrderModel {
  final String id;
  final String customerName;
  final String customerPhone;
  final String ministryName;
  final String buildingNumber;
  final String floor;
  final String officeNumber;
  final String restaurantName;
  final List<OrderItem> items;
  final double subtotal;
  final double deliveryFee;
  final double discount;
  final double total;
  final OrderStatus status;
  final String otpCode; // رمز الاستلام السري
  final DateTime createdAt;
  final int estimatedDeliveryMinutes;
  final String? courierName;
  final String? courierPhone;

  OrderModel({
    required this.id,
    required this.customerName,
    required this.customerPhone,
    required this.ministryName,
    this.buildingNumber = 'مبنى 07',
    required this.floor,
    required this.officeNumber,
    required this.restaurantName,
    required this.items,
    required this.subtotal,
    required this.deliveryFee,
    required this.discount,
    required this.total,
    required this.status,
    required this.otpCode,
    required this.createdAt,
    this.estimatedDeliveryMinutes = 25,
    this.courierName,
    this.courierPhone,
  });

  OrderModel copyWith({
    OrderStatus? status,
    String? courierName,
    String? courierPhone,
    int? estimatedDeliveryMinutes,
  }) {
    return OrderModel(
      id: id,
      customerName: customerName,
      customerPhone: customerPhone,
      ministryName: ministryName,
      buildingNumber: buildingNumber,
      floor: floor,
      officeNumber: officeNumber,
      restaurantName: restaurantName,
      items: items,
      subtotal: subtotal,
      deliveryFee: deliveryFee,
      discount: discount,
      total: total,
      status: status ?? this.status,
      otpCode: otpCode,
      createdAt: createdAt,
      estimatedDeliveryMinutes: estimatedDeliveryMinutes ?? this.estimatedDeliveryMinutes,
      courierName: courierName ?? this.courierName,
      courierPhone: courierPhone ?? this.courierPhone,
    );
  }
}
