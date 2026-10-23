import 'dart:convert';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  /// عنوان الخادم الإنتاجي مع إمكانية التخصيص بـ --dart-define=API_BASE_URL=...
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://capital-talabat.vercel.app',
  );

  Future<String?> _getIdToken() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return null;
    return await user.getIdToken();
  }

  /// 1. إنشاء طلب عبر خادم الويب الموثق (POST /api/orders)
  Future<Map<String, dynamic>> createOrder({
    required String id, // ord-<UUID v4>
    required String profileName,
    required String phone,
    required String ministry,
    required String floorNumber,
    required String roomNumber,
    required List<Map<String, dynamic>> items,
    String paymentMethod = 'cash',
    double tip = 0.0,
    String? couponCode,
    String? notes,
  }) async {
    final token = await _getIdToken();
    if (token == null) {
      throw Exception('يرجى تسجيل الدخول أولاً للمتابعة.');
    }

    final url = Uri.parse('$baseUrl/api/orders');
    final payload = {
      'id': id,
      'profileName': profileName,
      'phone': phone,
      'ministry': ministry,
      'floorNumber': floorNumber,
      'roomNumber': roomNumber,
      'items': items,
      'paymentMethod': paymentMethod,
      'tip': tip,
      if (couponCode != null && couponCode.trim().isNotEmpty)
        'couponCode': couponCode.trim(),
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    };

    debugPrint('🚀 Sending createOrder to: $url');
    final response = await http.post(
      url,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode(payload),
    );

    debugPrint('📥 createOrder Response status: ${response.statusCode}');

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      return data;
    } else {
      String errorMessage = 'تعذر إنشاء الطلب على الخادم.';
      try {
        final errJson = jsonDecode(response.body);
        if (errJson['error'] != null) {
          errorMessage = errJson['error'].toString();
        }
      } catch (_) {
        errorMessage = 'خطأ في الخادم (${response.statusCode}): ${response.body}';
      }
      throw Exception(errorMessage);
    }
  }

  /// 2. جلب رمز الاستلام السري للعميل (POST /api/order-delivery)
  Future<String> fetchDeliveryOtp(String orderId) async {
    final token = await _getIdToken();
    if (token == null) {
      throw Exception('يرجى تسجيل الدخول أولاً.');
    }

    final url = Uri.parse('$baseUrl/api/order-delivery');
    final response = await http.post(
      url,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'action': 'code',
        'orderId': orderId,
      }),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      final otp = data['otpCode']?.toString();
      if (otp != null && otp.isNotEmpty) {
        return otp;
      }
      throw Exception('رمز الاستلام غير متوفر حالياً.');
    } else {
      String errorMessage = 'تعذر جلب رمز الاستلام.';
      try {
        final errJson = jsonDecode(response.body);
        if (errJson['error'] != null) errorMessage = errJson['error'];
      } catch (_) {}
      throw Exception(errorMessage);
    }
  }

  /// 3. تأكيد تسليم المندوب للطلب بالرمز والمبلغ (POST /api/order-delivery)
  Future<bool> confirmDelivery({
    required String orderId,
    required String otpCode,
    required double collectedAmount,
  }) async {
    final token = await _getIdToken();
    if (token == null) {
      throw Exception('يرجى تسجيل الدخول أولاً.');
    }

    final url = Uri.parse('$baseUrl/api/order-delivery');
    final response = await http.post(
      url,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'action': 'deliver',
        'orderId': orderId,
        'otpCode': otpCode.trim(),
        'collectedAmount': collectedAmount,
      }),
    );

    if (response.statusCode == 200) {
      return true;
    } else {
      String errorMessage = 'تعذر إتمام التسليم.';
      try {
        final errJson = jsonDecode(response.body);
        if (errJson['error'] != null) errorMessage = errJson['error'];
      } catch (_) {}
      throw Exception(errorMessage);
    }
  }
}
