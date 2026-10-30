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
    try {
      await Supabase.initialize(
        url: url ?? supabaseUrl,
        anonKey: anonKey ?? supabaseAnonKey,
      );
      debugPrint('Supabase initialized successfully for project tvnsqatkaqyubeznhnmu');
    } catch (e) {
      debugPrint('Supabase initialization error: $e');
    }
  }

  User? get currentUser => client.auth.currentUser;
  bool get isAuthenticated => currentUser != null;

  // ─── 1. الحساب الشخصي (Profiles) ───────────────────────────────────────────
  Future<UserModel?> getUserProfile(String uid) async {
    try {
      final data = await client
          .from('profiles')
          .select()
          .eq('id', uid)
          .maybeSingle();

      if (data == null) return null;
      return UserModel(
        uid: uid,
        fullName: data['full_name'] ?? '',
        phone: data['phone'] ?? '',
        email: data['email'] ?? '',
        role: data['role'] ?? 'employee',
        ministry: data['ministry'] ?? '',
        floorNumber: data['floor_number'] ?? '',
        roomNumber: data['room_number'] ?? '',
        walletBalance: (data['wallet_balance'] as num?)?.toDouble() ?? 0.0,
      );
    } catch (e) {
      debugPrint('getUserProfile Supabase error: $e');
      return null;
    }
  }

  Future<void> updateProfile(String uid, Map<String, dynamic> updates) async {
    try {
      await client.from('profiles').update(updates).eq('id', uid);
    } catch (e) {
      debugPrint('updateProfile Supabase error: $e');
      rethrow;
    }
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

