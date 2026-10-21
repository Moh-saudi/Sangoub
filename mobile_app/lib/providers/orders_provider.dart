import 'dart:math';
import 'package:flutter/material.dart';
import '../core/services/firebase_service.dart';
import '../models/order_model.dart';

class OrdersProvider with ChangeNotifier {
  final List<OrderModel> _orders = [
    OrderModel(
      id: 'ORD-9421',
      customerName: 'م. كريم عادل',
      customerPhone: '01099887766',
      ministryName: 'وزارة الاتصالات وتكنولوجيا المعلومات',
      buildingNumber: 'مبنى 07',
      floor: 'الدور الرابع',
      officeNumber: 'مكتب 402',
      restaurantName: 'مطبخ العاصمة المركزي',
      items: const [
        OrderItem(id: 'item_1', name: 'وجبة فطور ملوكي (كرواسون + أومليت)', price: 120, quantity: 1),
        OrderItem(id: 'item_2', name: 'كافيه لاتيه مثلج', price: 65, quantity: 2),
      ],
      subtotal: 250,
      deliveryFee: 15,
      discount: 20,
      total: 245,
      status: OrderStatus.cooking,
      otpCode: '8492',
      createdAt: DateTime.now().subtract(const Duration(minutes: 12)),
      estimatedDeliveryMinutes: 18,
      courierName: 'كابتن محمود نبيل',
      courierPhone: '01122334455',
    ),
    OrderModel(
      id: 'ORD-9420',
      customerName: 'أ. سارة إبراهيم',
      customerPhone: '01234567890',
      ministryName: 'رئاسة مجلس الوزراء',
      buildingNumber: 'مبنى 01',
      floor: 'الدور الثاني',
      officeNumber: 'مكتب 215',
      restaurantName: 'ساندوتشات بريميوم العاصمة',
      items: const [
        OrderItem(id: 'item_3', name: 'ساندوتش تشيكن جريل شيدر', price: 110, quantity: 2),
        OrderItem(id: 'item_4', name: 'عصير برتقال طبيعي', price: 45, quantity: 1),
      ],
      subtotal: 265,
      deliveryFee: 15,
      discount: 0,
      total: 280,
      status: OrderStatus.readyForPickup,
      otpCode: '5173',
      createdAt: DateTime.now().subtract(const Duration(minutes: 25)),
      estimatedDeliveryMinutes: 10,
    ),
    OrderModel(
      id: 'ORD-9419',
      customerName: 'د. طارق مصطفى',
      customerPhone: '01511223344',
      ministryName: 'وزارة المالية',
      buildingNumber: 'مبنى 04',
      floor: 'الدور الثالث',
      officeNumber: 'مكتب 308',
      restaurantName: 'ماركت الحي الحكومي السريع',
      items: const [
        OrderItem(id: 'item_5', name: 'سلة فواكه طازجة وسناكس', price: 180, quantity: 1),
        OrderItem(id: 'item_6', name: 'زجاجة مياه معدنية 1.5 لتر', price: 15, quantity: 3),
      ],
      subtotal: 225,
      deliveryFee: 15,
      discount: 100, // استخدم قسيمة 100 جنيه
      total: 140,
      status: OrderStatus.outForDelivery,
      otpCode: '9301',
      createdAt: DateTime.now().subtract(const Duration(minutes: 35)),
      estimatedDeliveryMinutes: 5,
      courierName: 'كابتن أحمد علي',
      courierPhone: '01065432109',
    ),
  ];

  List<OrderModel> get orders => [..._orders];

  List<OrderModel> get chefOrders => _orders
      .where((o) =>
          o.status == OrderStatus.pendingChef ||
          o.status == OrderStatus.cooking ||
          o.status == OrderStatus.readyForPickup)
      .toList();

  List<OrderModel> get courierAvailableOrders => _orders
      .where((o) => o.status == OrderStatus.readyForPickup)
      .toList();

  List<OrderModel> get courierActiveOrders => _orders
      .where((o) => o.status == OrderStatus.outForDelivery)
      .toList();

  List<OrderModel> get clientActiveOrders => _orders
      .where((o) => o.status != OrderStatus.delivered && o.status != OrderStatus.cancelled)
      .toList();

  OrderModel? getOrderById(String id) {
    try {
      return _orders.firstWhere((o) => o.id == id);
    } catch (_) {
      return null;
    }
  }

  void addOrder({
    required String customerName,
    required String customerPhone,
    required String ministryName,
    required String buildingNumber,
    required String floor,
    required String officeNumber,
    required String restaurantName,
    required List<OrderItem> items,
    required double subtotal,
    required double deliveryFee,
    required double discount,
    required double total,
  }) {
    final rand = Random();
    final newId = 'ORD-${rand.nextInt(9000) + 1000}';
    final generatedOtp = (rand.nextInt(9000) + 1000).toString();

    final order = OrderModel(
      id: newId,
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
      status: OrderStatus.pendingChef,
      otpCode: generatedOtp,
      createdAt: DateTime.now(),
      estimatedDeliveryMinutes: 30,
    );

    _orders.insert(0, order);
    notifyListeners();

    // Write to Firestore /orders/{orderId}
    FirebaseService().createOrder(order, 'employee_capital');
  }

  void addOrderModel(OrderModel order) {
    _orders.insert(0, order);
    notifyListeners();
    FirebaseService().createOrder(order, 'employee_capital');
  }

  void updateOrderStatus(String orderId, OrderStatus newStatus) {
    final index = _orders.indexWhere((o) => o.id == orderId);
    if (index != -1) {
      _orders[index] = _orders[index].copyWith(status: newStatus);
      notifyListeners();

      // Update Firestore /orders/{orderId}
      FirebaseService().updateOrderStatus(orderId, newStatus);
    }
  }

  void assignCourier(String orderId, String courierName, String courierPhone) {
    final index = _orders.indexWhere((o) => o.id == orderId);
    if (index != -1) {
      _orders[index] = _orders[index].copyWith(
        status: OrderStatus.outForDelivery,
        courierName: courierName,
        courierPhone: courierPhone,
      );
      notifyListeners();

      // Update Firestore /orders/{orderId}
      FirebaseService().updateOrderStatus(orderId, OrderStatus.outForDelivery);
    }
  }

  bool verifyOtpAndCompleteDelivery(String orderId, String inputOtp) {
    final index = _orders.indexWhere((o) => o.id == orderId);
    if (index != -1) {
      if (_orders[index].otpCode == inputOtp.trim()) {
        _orders[index] = _orders[index].copyWith(status: OrderStatus.delivered);
        notifyListeners();

        // Update Firestore /orders/{orderId}
        FirebaseService().updateOrderStatus(orderId, OrderStatus.delivered);
        return true;
      }
    }
    return false;
  }
}
