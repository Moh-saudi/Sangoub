import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import '../../models/user_model.dart';
import '../../models/store_model.dart';
import '../../models/product_model.dart';
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

  // ─── 1. التحقق من صلاحيات الإدارة والفريق (admins/staff) ───────────────────

  /// فحص وثيقة المدير (admins/{uid})
  Future<bool> checkIsAdmin(String uid) async {
    try {
      final doc = await _firestore.collection('admins').doc(uid).get();
      return doc.exists;
    } catch (e) {
      debugPrint('admins check error: $e');
      return false;
    }
  }

  /// فحص وثيقة التكليف للفريق (staff/{uid})
  Future<Map<String, dynamic>?> checkStaffAssignment(String uid) async {
    try {
      final doc = await _firestore.collection('staff').doc(uid).get();
      if (doc.exists) {
        return doc.data();
      }
      return null;
    } catch (e) {
      debugPrint('staff check error: $e');
      return null;
    }
  }

  /// جلب ملف المستخدم (users/{uid}) مدمجاً مع صلاحيات الإدارة أو الفريق
  Future<UserModel?> getUserProfile(String uid) async {
    try {
      final isAdmin = await checkIsAdmin(uid);
      final staffData = await checkStaffAssignment(uid);

      final userDoc = await _firestore.collection('users').doc(uid).get();
      if (userDoc.exists) {
        return UserModel.fromFirestore(
          userDoc,
          staffData: staffData,
          isAdmin: isAdmin,
        );
      }

      // إذا لم يكن هناك ملف بعد في users، ننشئ ملف الموظف الأساسي
      return null;
    } catch (e) {
      debugPrint('getUserProfile error: $e');
      return null;
    }
  }

  /// إنشاء ملف موظف جديد موثّق وفق قواعد أمان Firestore
  Future<void> createInitialUserProfile({
    required User firebaseUser,
    String? fullName,
    String? phone,
    String? ministry,
    String? floor,
    String? room,
  }) async {
    final uid = firebaseUser.uid;
    final docRef = _firestore.collection('users').doc(uid);

    final payload = {
      'uid': uid,
      'fullName': fullName ?? firebaseUser.displayName ?? 'موظف بالعاصمة الإدارية',
      'email': firebaseUser.email ?? '',
      'phone': phone ?? firebaseUser.phoneNumber ?? '',
      'ministry': ministry ?? '',
      'floorNumber': floor ?? '',
      'roomNumber': room ?? '',
      'role': 'employee',
      'walletBalance': 0, // الرصيد الابتدائي صفر وفق العقد
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
      if (firebaseUser.photoURL != null) 'avatarUrl': firebaseUser.photoURL,
    };

    await docRef.set(payload);
    debugPrint('✅ تم إنشاء ملف المستخدم في Firestore: $uid');
  }

  /// تحديث بيانات العنوان والتواصل للموظف
  Future<void> updateUserAddressProfile({
    required String uid,
    required String fullName,
    required String phone,
    required String ministry,
    required String floorNumber,
    required String roomNumber,
  }) async {
    final docRef = _firestore.collection('users').doc(uid);
    await docRef.update({
      'fullName': fullName.trim(),
      'phone': phone.trim(),
      'ministry': ministry.trim(),
      'floorNumber': floorNumber.trim(),
      'roomNumber': roomNumber.trim(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
    debugPrint('✅ تم تحديث بيانات الموظف: $uid');
  }

  /// مزامنة صورة الملف الشخصي من Google/Firebase Auth إلى Firestore
  Future<void> updateUserAvatarUrl({
    required String uid,
    required String avatarUrl,
  }) async {
    await _firestore.collection('users').doc(uid).update({
      'avatarUrl': avatarUrl,
      'updatedAt': FieldValue.serverTimestamp(),
    });
    debugPrint('✅ تم تحديث صورة الملف الشخصي: $uid');
  }


  // ─── 2. استماع الكتالوج الحقيقي (stores & products) ───────────────────

  /// استماع المتاجر المفتوحة (stores)
  Stream<List<StoreModel>> streamStores() {
    return _firestore
        .collection('stores')
        .snapshots()
        .map((snapshot) {
      return snapshot.docs
          .map((doc) => StoreModel.fromFirestore(doc))
          .toList();
    });
  }

  /// استماع الأصناف والمنتجات المتاحة وغير المؤرشفة (products)
  Stream<List<ProductModel>> streamProducts() {
    return _firestore
        .collection('products')
        .snapshots()
        .map((snapshot) {
      return snapshot.docs
          .map((doc) => ProductModel.fromFirestore(doc))
          .where((p) => !p.archived) // استبعاد المنتجات المؤرشفة
          .toList();
    });
  }

  // ─── 3. استماع الطلبات حسب الدور الموثق (orders) ───────────────────

  /// استماع طلبات العميل الموظف
  Stream<List<OrderModel>> streamOrdersForEmployee(String uid) {
    return _firestore
        .collection('orders')
        .where('profileId', isEqualTo: uid)
        .snapshots()
        .map((snapshot) {
      final list = snapshot.docs
          .map((doc) => OrderModel.fromFirestore(doc))
          .toList();
      list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      return list;
    });
  }

  /// استماع طلبات مطبخ المتجر للشيف (storeIds يحتوي على assignedStoreId)
  Stream<List<OrderModel>> streamOrdersForChef(String storeId) {
    return _firestore
        .collection('orders')
        .where('storeIds', arrayContains: storeId)
        .snapshots()
        .map((snapshot) {
      final list = snapshot.docs
          .map((doc) => OrderModel.fromFirestore(doc))
          .toList();
      list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      return list;
    });
  }

  /// استماع الطلبات المكلف بها المندوب (courierId == uid)
  Stream<List<OrderModel>> streamOrdersForCourier(String uid) {
    return _firestore
        .collection('orders')
        .where('courierId', isEqualTo: uid)
        .snapshots()
        .map((snapshot) {
      final list = snapshot.docs
          .map((doc) => OrderModel.fromFirestore(doc))
          .toList();
      list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      return list;
    });
  }

  // ─── 4. معاملة تحديث مرحلة المطبخ للشيف (Firestore Transaction) ─────
  /// ترقية kitchenStatus[storeId]: received -> preparing -> ready
  Future<void> advanceKitchenStage({
    required String orderId,
    required String storeId,
  }) async {
    final orderRef = _firestore.collection('orders').doc(orderId);

    await _firestore.runTransaction((tx) async {
      final snapshot = await tx.get(orderRef);
      if (!snapshot.exists) {
        throw Exception('الطلب غير موجود.');
      }

      final data = snapshot.data()!;
      final storeIds = (data['storeIds'] as List<dynamic>?)?.cast<String>() ?? [];
      final kitchenStatus = Map<String, dynamic>.from(data['kitchenStatus'] as Map? ?? {});

      final currentStage = kitchenStatus[storeId] as String? ?? 'received';
      String nextStage;

      if (currentStage == 'received') {
        nextStage = 'preparing';
      } else if (currentStage == 'preparing') {
        nextStage = 'ready';
      } else {
        return; // المطبخ جاهز بالفعل
      }

      kitchenStatus[storeId] = nextStage;

      // هل كل المطابخ الأخرى أصبحت ready؟
      final bool allStoresReady = storeIds.isNotEmpty &&
          storeIds.every((sId) => kitchenStatus[sId] == 'ready');

      final String nextOrderStatus = allStoresReady ? 'ready' : 'preparing';

      final updateData = <String, dynamic>{
        'kitchenStatus': kitchenStatus,
        'orderStatus': nextOrderStatus,
        'updatedAt': FieldValue.serverTimestamp(),
      };

      if (allStoresReady) {
        updateData['readyAt'] = FieldValue.serverTimestamp();
      }

      tx.update(orderRef, updateData);
    });

    debugPrint('✅ تم تحديث مرحلة المطبخ في Firestore: $orderId ($storeId)');
  }

  /// 5. تحديث حالة الطلب إلى with_courier للمندوب
  Future<void> markOrderPickedUp(String orderId) async {
    final orderRef = _firestore.collection('orders').doc(orderId);
    await orderRef.update({
      'orderStatus': 'with_courier',
      'updatedAt': FieldValue.serverTimestamp(),
    });
    debugPrint('🛵 تم تحديث الطلب إلى with_courier: $orderId');
  }
}
