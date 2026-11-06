import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../models/user_model.dart';
import '../../models/store_model.dart';
import '../../models/product_model.dart';
import '../../models/order_model.dart';

class SupabaseService {
  static final SupabaseService _instance = SupabaseService._internal();
  factory SupabaseService() => _instance;
  SupabaseService._internal();

  static const String supabaseUrl = 'https://tvnsqatkaqyubeznhnmu.supabase.co';
  static const String supabaseAnonKey = 'sb_publishable_9ORqYV9HK0AbacKtYSRZiA_K7hcJ4yI';

  SupabaseClient get client => Supabase.instance.client;

  /// تهيئة Supabase عند بدء التطبيق
  static Future<void> initialize({String? url, String? anonKey}) async {
    await Supabase.initialize(
      url: url ?? supabaseUrl,
      anonKey: anonKey ?? supabaseAnonKey,
    );
    debugPrint('Supabase initialized successfully for project tvnsqatkaqyubeznhnmu');
  }

  User? get currentUser => client.auth.currentUser;
  bool get isAuthenticated => currentUser != null;

  // ─── 1. الحساب الشخصي (Profiles) ───────────────────────────────────────────
  Future<UserModel?> getUserProfile(String uid) async {
    if (client.auth.currentUser?.id != uid) {
      throw const AuthException('غير مصرح بقراءة ملف هذا الحساب.');
    }

    final data = await client.from('profiles').select().eq('id', uid).maybeSingle();
    if (data == null) return null;

    final authUser = client.auth.currentUser!;
    final metadata = authUser.userMetadata ?? const <String, dynamic>{};
    final assignments = await client
        .from('user_roles')
        .select('role_id, store_id')
        .eq('user_id', uid);
    final roleIds = List<Map<String, dynamic>>.from(assignments)
        .map((row) => row['role_id']?.toString())
        .whereType<String>()
        .toSet();

    final profileRole = (data['role'] ?? '').toString();
    final assignedRole = roleIds.contains('super_admin')
        ? 'admin'
        : roleIds.contains('courier') || roleIds.contains('store_courier')
            ? 'courier'
            : roleIds.contains('store_owner') ||
                    roleIds.contains('store_manager') ||
                    roleIds.contains('kitchen_staff') ||
                    roleIds.contains('store_accountant')
                ? 'restaurant'
                : null;
    final role = profileRole == 'admin' ||
            profileRole == 'courier' ||
            profileRole == 'restaurant'
        ? profileRole
        : assignedRole ?? 'employee';
    Map<String, dynamic>? storeAssignment;
    for (final assignment in List<Map<String, dynamic>>.from(assignments)) {
      if (assignment['store_id'] != null) {
        storeAssignment = assignment;
        break;
      }
    }

    String profileText(String key, String metadataKey) =>
        (data[key] ?? metadata[metadataKey] ?? '').toString();

    return UserModel(
      id: uid,
      name: profileText('full_name', 'full_name').trim().isEmpty
          ? 'مستخدم جديد'
          : profileText('full_name', 'full_name').trim(),
      phone: profileText('phone', 'phone'),
      email: (data['email'] ?? authUser.email ?? '').toString(),
      role: UserRoleExtension.fromString(role),
      ministryName: profileText('ministry', 'ministry'),
      floor: profileText('floor_number', 'floor_number'),
      officeNumber: profileText('room_number', 'room_number'),
      walletBalance: (data['wallet_balance'] as num?)?.toDouble() ?? 0.0,
      avatarUrl: (data['avatar_url'] ?? metadata['avatar_url'])?.toString(),
      storeId: storeAssignment?['store_id']?.toString(),
    );
  }

  Future<void> updateProfile(String uid, Map<String, dynamic> updates) async {
    if (client.auth.currentUser?.id != uid) {
      throw const AuthException('غير مصرح بتحديث ملف هذا الحساب.');
    }
    await client.from('profiles').update(updates).eq('id', uid);
  }

  // ─── 2. المتاجر والمنتجات (Stores & Products) ──────────────────────────────
  Future<List<Map<String, dynamic>>> getStores() async {
    try {
      final response = await client
          .from('stores')
          .select()
          .order('rating', ascending: false);
      return List<Map<String, dynamic>>.from(response);
    } catch (e) {
      debugPrint('getStores Supabase error: $e');
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getProducts({String? storeId}) async {
    try {
      var query = client.from('products').select().eq('is_available', true);
      if (storeId != null) {
        query = query.eq('store_id', storeId);
      }
      final response = await query;
      return List<Map<String, dynamic>>.from(response);
    } catch (e) {
      debugPrint('getProducts Supabase error: $e');
      return [];
    }
  }

  // ─── 3. الطلبات (Orders) ───────────────────────────────────────────────────
  Stream<List<Map<String, dynamic>>> streamUserOrders(String userId) {
    return client
        .from('orders')
        .stream(primaryKey: ['id'])
        .eq('customer_id', userId)
        .order('created_at', ascending: false);
  }

  Future<Map<String, dynamic>?> createOrder(Map<String, dynamic> orderData) async {
    try {
      final response = await client
          .from('orders')
          .insert(orderData)
          .select()
          .single();
      return response;
    } catch (e) {
      debugPrint('createOrder Supabase error: $e');
      rethrow;
    }
  }

  // ─── 4. المصادقة (Auth) ────────────────────────────────────────────────────
  Future<AuthResponse> signInWithEmailPassword({
    required String email,
    required String password,
  }) async {
    return await client.auth.signInWithPassword(
      email: email,
      password: password,
    );
  }

  Future<AuthResponse> signUpWithEmailPassword({
    required String email,
    required String password,
    Map<String, dynamic>? data,
  }) async {
    return await client.auth.signUp(
      email: email,
      password: password,
      data: data,
    );
  }

  Future<void> signOut() async {
    await client.auth.signOut();
  }
}

