import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import '../../models/user_model.dart';
import '../../models/order_model.dart';

class FirebaseService {
  static final FirebaseService _instance = FirebaseService._internal();
  factory FirebaseService() => _instance;
  FirebaseService._internal();

  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  FirebaseFirestore get firestore => _firestore;
  FirebaseAuth get auth => _auth;

  User? get currentFirebaseUser => _auth.currentUser;

  Future<void> ensureAuthenticated() async {
    if (_auth.currentUser == null) {
      try {
        await _auth.signInAnonymously();
      } catch (e) {
        debugPrint('Firebase anonymous auth notice: $e');
      }
    }
  }

  // ─── 1. إدارة ملفات المستخدمين (/users/{userId}) ───────────────────
  Future<void> saveUserProfile(UserModel user) async {
    try {
      await ensureAuthenticated();
      final uid = _auth.currentUser?.uid ?? user.id;
      final docRef = _firestore.collection('users').doc(uid);
      await docRef.set({
        'uid': uid,
        'fullName': user.name,
        'email': user.email,
        'phone': user.phone,
        'ministry': user.ministryName ?? 'رئاسة مجلس الوزراء',
        'floorNumber': user.floor ?? 'الدور الأول',
        'roomNumber': user.officeNumber ?? 'مكتب 101',
        'role': _mapRoleToString(user.role),
        'walletBalance': 100, // رصيد ترحيبي لموظفي العاصمة
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
      debugPrint('✅ تم حفظ بيانات المستخدم في Firestore بنجاح: $uid');
    } catch (e) {
      debugPrint('⚠️ Firestore saveUserProfile Notice: $e');
    }
  }

  // ─── 2. كتابة الطلبات الجديدة (/orders/{orderId}) ───────────────────
  Future<void> createOrder(OrderModel order, String userId) async {
    try {
      await ensureAuthenticated();
      final currentUid = _auth.currentUser?.uid ?? userId;
      final docRef = _firestore.collection('orders').doc(order.id);
      
      final itemsSummary = order.items
          .map((i) => '${i.name} (×${i.quantity})')
          .join('، ');

      await docRef.set({
        'orderNumber': order.id,
        'profileId': currentUid,
        'profileName': order.customerName,
        'phone': order.customerPhone,
        'ministry': order.ministryName,
        'floorNumber': order.floor,
        'roomNumber': order.officeNumber,
        'itemsSummary': itemsSummary,
        'total': order.total,
        'subtotal': order.subtotal,
        'deliveryFee': order.deliveryFee,
        'discount': order.discount,
        'paymentMethod': 'cash',
        'orderStatus': _mapStatusToString(order.status),
        'otpCode': order.otpCode,
        'restaurantName': order.restaurantName,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      debugPrint('✅ تم كتابة الطلب في Firestore بنجاح: ${order.id}');
    } catch (e) {
      debugPrint('⚠️ Firestore createOrder Notice: $e');
    }
  }

  // ─── 3. تحديث حالة الطلب لحظياً ─────────────────────────────────────
  Future<void> updateOrderStatus(String orderId, OrderStatus status) async {
    try {
      final docRef = _firestore.collection('orders').doc(orderId);
      await docRef.update({
        'orderStatus': _mapStatusToString(status),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      debugPrint('✅ تم تحديث حالة الطلب في Firestore: $orderId -> $status');
    } catch (e) {
      debugPrint('⚠️ Firestore updateOrderStatus Notice: $e');
    }
  }

  // ─── 4. البث الحي للطلبات (Realtime Orders Stream) ───────────────────
  Stream<List<OrderModel>> streamOrders() {
    return _firestore
        .collection('orders')
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs.map((doc) {
        final data = doc.data();
        return OrderModel(
          id: data['orderNumber'] ?? doc.id,
          customerName: data['profileName'] ?? 'موظف بالعاصمة',
          customerPhone: data['phone'] ?? '',
          ministryName: data['ministry'] ?? 'الحي الحكومي',
          buildingNumber: 'مبنى الوزارة',
          floor: data['floorNumber'] ?? 'الدور الأرضي',
          officeNumber: data['roomNumber'] ?? 'المكتب',
          restaurantName: data['restaurantName'] ?? 'مطبخ العاصمة المركزي',
          items: [
            OrderItem(
              id: 'summary',
              name: data['itemsSummary'] ?? 'وجبة فود كورت',
              price: (data['total'] as num?)?.toDouble() ?? 0.0,
              quantity: 1,
            )
          ],
          subtotal: (data['subtotal'] as num?)?.toDouble() ?? (data['total'] as num?)?.toDouble() ?? 0.0,
          deliveryFee: (data['deliveryFee'] as num?)?.toDouble() ?? 15.0,
          discount: (data['discount'] as num?)?.toDouble() ?? 0.0,
          total: (data['total'] as num?)?.toDouble() ?? 0.0,
          status: _mapStringToStatus(data['orderStatus']),
          otpCode: data['otpCode'] ?? '1234',
          createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
        );
      }).toList();
    });
  }

  // Helpers
  String _mapRoleToString(UserRole role) {
    switch (role) {
      case UserRole.employee:
        return 'employee';
      case UserRole.chef:
        return 'restaurant';
      case UserRole.courier:
        return 'courier';
      case UserRole.admin:
        return 'admin';
    }
  }

  String _mapStatusToString(OrderStatus status) {
    switch (status) {
      case OrderStatus.pendingChef:
        return 'received';
      case OrderStatus.cooking:
        return 'preparing';
      case OrderStatus.readyForPickup:
        return 'ready';
      case OrderStatus.outForDelivery:
        return 'with_courier';
      case OrderStatus.delivered:
        return 'delivered';
      case OrderStatus.cancelled:
        return 'cancelled';
    }
  }

  OrderStatus _mapStringToStatus(String? status) {
    switch (status) {
      case 'received':
        return OrderStatus.pendingChef;
      case 'preparing':
        return OrderStatus.cooking;
      case 'ready':
        return OrderStatus.readyForPickup;
      case 'with_courier':
        return OrderStatus.outForDelivery;
      case 'delivered':
        return OrderStatus.delivered;
      case 'cancelled':
        return OrderStatus.cancelled;
      default:
        return OrderStatus.pendingChef;
    }
  }
}
