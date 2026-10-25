import 'dart:async';
import 'package:flutter/material.dart';
import '../core/services/firebase_service.dart';
import '../core/services/api_service.dart';
import '../core/services/notification_service.dart';
import '../models/order_model.dart';
import '../models/user_model.dart';

class OrdersProvider with ChangeNotifier {
  final FirebaseService _firebaseService = FirebaseService();
  final ApiService _apiService = ApiService();

  StreamSubscription<List<OrderModel>>? _ordersSubscription;
  List<OrderModel> _orders = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<OrderModel> get orders => [..._orders];
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  // فلاتر بحسب مراحل الطلب
  List<OrderModel> get activeOrders => _orders
      .where((o) =>
          o.status != OrderStatus.delivered && o.status != OrderStatus.cancelled)
      .toList();

  List<OrderModel> get clientActiveOrders => activeOrders;
  List<OrderModel> get chefOrders => [..._orders];
  List<OrderModel> get courierOrders => [..._orders];
  List<OrderModel> get courierAvailableOrders => _orders
      .where((o) => o.status == OrderStatus.readyForPickup)
      .toList();
  List<OrderModel> get courierActiveOrders => _orders
      .where((o) => o.status == OrderStatus.outForDelivery)
      .toList();

  List<OrderModel> get pastOrders => _orders
      .where((o) =>
          o.status == OrderStatus.delivered || o.status == OrderStatus.cancelled)
      .toList();

  /// بدء الاستماع الحي للطلبات وفق الدور الموثق
  void startListeningToOrders({
    required String uid,
    required UserRole role,
    String? storeId,
  }) {
    _ordersSubscription?.cancel();
    _isLoading = true;
    _orders = [];
    notifyListeners();

    Stream<List<OrderModel>> stream;
    if (role == UserRole.restaurant) {
      if (storeId == null || storeId.isEmpty) {
        debugPrint('⚠️ الشيف غير مرتبط بمتجر storeId صالح');
        _isLoading = false;
        notifyListeners();
        return;
      }
      stream = _firebaseService.streamOrdersForChef(storeId);
    } else if (role == UserRole.courier) {
      stream = _firebaseService.streamOrdersForCourier(uid);
    } else {
      // موظف / عميل
      stream = _firebaseService.streamOrdersForEmployee(uid);
    }

    _ordersSubscription = stream.listen((ordersList) {
      if (_orders.isNotEmpty && role == UserRole.employee) {
        for (final newOrder in ordersList) {
          final oldOrder = _orders.firstWhere(
            (o) => o.id == newOrder.id,
            orElse: () => newOrder,
          );
          if (oldOrder.status != newOrder.status) {
            _notifyOrderStatusChanged(newOrder);
          }
        }
      }
      _orders = ordersList;
      _isLoading = false;
      _errorMessage = null;
      notifyListeners();
    }, onError: (e) {
      debugPrint('Orders stream error: $e');
      _errorMessage = 'خطأ في جلب الطلبات: $e';
      _isLoading = false;
      notifyListeners();
    });
  }

  void _notifyOrderStatusChanged(OrderModel order) {
    String title = 'تحديث حالة الطلب: ${order.orderNumber}';
    String body = order.status.arabicLabel;

    if (order.status == OrderStatus.preparing) {
      title = 'طلبك قيد التحضير 👨‍🍳';
      body = 'بدأ الشيف في تحضير وجبتك في ${order.restaurantName}';
    } else if (order.status == OrderStatus.ready) {
      title = 'طلبك جاهز للاستلام 🛍️';
      body = 'تم تجهيز وتغليف وجبتك، بانتظار استلام كابتن التوصيل';
    } else if (order.status == OrderStatus.withCourier) {
      title = 'المندوب في الطريق لمكتبك 🛵';
      body = 'كابتن العاصمة استلم وجبتك وهو متوجه الآن إلى مقر ${order.ministryName}';
    } else if (order.status == OrderStatus.delivered) {
      title = 'تم تسليم الطلب بنجاح ✅';
      body = 'تم تسليم وجبتك بمكتبك. بالهناء والشفاء!';
    }

    NotificationService.instance.showOrderStageAlert(
      orderId: order.id,
      title: title,
      body: body,
    );
  }


  /// إيقاف الاستماع ومسح بيانات الطلبات (عند الخروج أو تبديل الحساب)
  void cancelListening() {
    _ordersSubscription?.cancel();
    _ordersSubscription = null;
    _orders = [];
    _isLoading = false;
    _errorMessage = null;
    notifyListeners();
  }

  /// ترقية مرحلة المطبخ للشيف (received -> preparing -> ready)
  Future<void> advanceKitchenStage({
    required String orderId,
    required String storeId,
  }) async {
    try {
      await _firebaseService.advanceKitchenStage(
        orderId: orderId,
        storeId: storeId,
      );
    } catch (e) {
      debugPrint('advanceKitchenStage error: $e');
      rethrow;
    }
  }

  /// جلب رمز الاستلام السري للعميل من الخادم الموثق
  Future<String> fetchOrderOtpCode(String orderId) async {
    try {
      final code = await _apiService.fetchDeliveryOtp(orderId);
      // تحديث الطلب محلياً بالرمز
      final index = _orders.indexWhere((o) => o.id == orderId);
      if (index != -1) {
        _orders[index] = _orders[index].copyWith(otpCode: code);
        notifyListeners();
      }
      return code;
    } catch (e) {
      debugPrint('fetchOrderOtpCode error: $e');
      rethrow;
    }
  }

  /// تأكيد المندوب لتسليم الطلب بالرمز والمبلغ
  Future<bool> confirmDelivery({
    required String orderId,
    required String otpCode,
    required double collectedAmount,
  }) async {
    try {
      final success = await _apiService.confirmDelivery(
        orderId: orderId,
        otpCode: otpCode,
        collectedAmount: collectedAmount,
      );
      return success;
    } catch (e) {
      debugPrint('confirmDelivery error: $e');
      rethrow;
    }
  }

  /// تأكيد المندوب لاستلام الوجبة والتوجه للوزارة
  Future<void> markOrderPickedUp(String orderId) async {
    try {
      await _firebaseService.markOrderPickedUp(orderId);
    } catch (e) {
      debugPrint('markOrderPickedUp error: $e');
      rethrow;
    }
  }

  Future<void> assignCourier(String orderId, String courierName, String courierPhone) async {
    await markOrderPickedUp(orderId);
  }

  OrderModel? getOrderById(String orderId) {
    try {
      return _orders.firstWhere((o) => o.id == orderId);
    } catch (_) {
      return null;
    }
  }

  @override
  void dispose() {
    _ordersSubscription?.cancel();
    super.dispose();
  }
}
