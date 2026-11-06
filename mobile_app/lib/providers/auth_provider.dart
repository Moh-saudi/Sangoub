import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/services/notification_service.dart';
import '../core/services/supabase_service.dart';
import '../models/user_model.dart';

class AuthProvider with ChangeNotifier {
  final SupabaseService _supabase = SupabaseService();
  final GoogleSignIn _googleSignIn = GoogleSignIn();

  StreamSubscription<AuthState>? _authSubscription;
  UserModel? _currentUser;
  bool _isLoading = false;
  String? _errorMessage;

  UserModel? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get isAuthenticated => _supabase.client.auth.currentSession != null;

  UserRole get currentRole => _currentUser?.role ?? UserRole.employee;
  bool get isAdmin => currentRole == UserRole.admin;
  bool get isChef => currentRole == UserRole.restaurant;
  bool get isCourier => currentRole == UserRole.courier;
  bool get isEmployee => currentRole == UserRole.employee;

  AuthProvider() {
    _authSubscription = _supabase.client.auth.onAuthStateChange.listen((state) {
      if (state.session == null) {
        _currentUser = null;
        _isLoading = false;
        notifyListeners();
      } else {
        unawaited(reloadUserSession());
      }
    });
    if (_supabase.client.auth.currentSession != null) {
      unawaited(reloadUserSession());
    }
  }

  /// تحميل ملف المستخدم من Supabase وتسجيل جهاز FCM لهذا الحساب.
  Future<void> reloadUserSession() async {
    final user = _supabase.currentUser;
    if (user == null) {
      _currentUser = null;
      notifyListeners();
      return;
    }

    try {
      _isLoading = true;
      notifyListeners();
      _currentUser = await _supabase.getUserProfile(user.id);
      if (_currentUser == null) {
        throw const AuthException('ملف الحساب غير موجود في Supabase.');
      }
      _errorMessage = null;
      unawaited(NotificationService.instance.syncTokenWithUser(user.id));
    } catch (e) {
      debugPrint('reloadUserSession error: $e');
      _errorMessage = _friendlyAuthError(e);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<UserRole> signInWithEmailAndPassword({
    required String email,
    required String password,
  }) async {
    return _runAuth<UserRole>(() async {
      await _supabase.signInWithEmailPassword(
        email: email.trim(),
        password: password,
      );
      await reloadUserSession();
      return _currentUser?.role ?? UserRole.employee;
    }, fallbackMessage: 'حدث خطأ أثناء تسجيل الدخول.');
  }

  Future<void> sendPasswordResetEmail(String email) async {
    await _runAuth<void>(() async {
      await _supabase.client.auth.resetPasswordForEmail(email.trim());
    }, fallbackMessage: 'تعذر إرسال رابط استعادة كلمة المرور.');
  }

  /// يعيد true عند تسجيل الدخول فورًا، وfalse إذا كانت هناك حاجة لتأكيد البريد.
  Future<bool> signUpWithEmailAndPassword({
    required String email,
    required String password,
    required String fullName,
    required String phone,
    required String ministry,
    required String floorNumber,
    required String roomNumber,
  }) async {
    return _runAuth<bool>(() async {
      final response = await _supabase.signUpWithEmailPassword(
        email: email.trim(),
        password: password,
        data: {
          'full_name': fullName.trim(),
          'phone': phone.trim(),
          'ministry': ministry.trim(),
          'floor_number': floorNumber.trim(),
          'room_number': roomNumber.trim(),
        },
      );

      if (response.session == null) return false;

      await _supabase.updateProfile(response.user!.id, {
        'full_name': fullName.trim(),
        'phone': phone.trim(),
        'ministry': ministry.trim(),
        'floor_number': floorNumber.trim(),
        'room_number': roomNumber.trim(),
      });
      await reloadUserSession();
      return true;
    }, fallbackMessage: 'تعذر إنشاء الحساب.');
  }

  Future<UserRole> signInWithGoogle() async {
    return _runAuth<UserRole>(() async {
      final googleUser = await _googleSignIn.signIn();
      if (googleUser == null) return _currentUser?.role ?? UserRole.employee;

      final googleAuth = await googleUser.authentication;
      final idToken = googleAuth.idToken;
      if (idToken == null) {
        throw const AuthException('تعذر الحصول على رمز Google لتسجيل الدخول.');
      }

      await _supabase.client.auth.signInWithIdToken(
        provider: OAuthProvider.google,
        idToken: idToken,
        accessToken: googleAuth.accessToken,
      );
      await reloadUserSession();
      return _currentUser?.role ?? UserRole.employee;
    }, fallbackMessage: 'تعذر تسجيل الدخول عبر Google.');
  }

  Future<void> updateAddressProfile({
    required String fullName,
    required String phone,
    required String ministry,
    required String floorNumber,
    required String roomNumber,
  }) async {
    final user = _currentUser;
    if (user == null) return;
    await _runAuth<void>(() async {
      await _supabase.updateProfile(user.id, {
        'full_name': fullName.trim(),
        'phone': phone.trim(),
        'ministry': ministry.trim(),
        'floor_number': floorNumber.trim(),
        'room_number': roomNumber.trim(),
      });
      await reloadUserSession();
    }, fallbackMessage: 'تعذر تحديث بيانات الحساب.');
  }

  Future<void> signOut() async {
    try {
      await NotificationService.instance.unregisterCurrentDeviceToken();
    } catch (e) {
      debugPrint('Notification token unregister note: $e');
    }
    try {
      await _googleSignIn.signOut();
    } catch (_) {}
    await _supabase.signOut();
    _currentUser = null;
    _errorMessage = null;
    notifyListeners();
  }

  void updateAvatarUrl(String url) {
    if (_currentUser != null) {
      _currentUser = _currentUser!.copyWith(avatarUrl: url);
      notifyListeners();
    }
  }

  Future<T> _runAuth<T>(Future<T> Function() action, {required String fallbackMessage}) async {
    try {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
      return await action();
    } catch (e) {
      _errorMessage = _friendlyAuthError(e, fallbackMessage: fallbackMessage);
      throw Exception(_errorMessage);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  String _friendlyAuthError(Object error, {String fallbackMessage = 'فشلت عملية المصادقة.'}) {
    final message = error.toString().toLowerCase();
    if (message.contains('invalid login credentials') ||
        message.contains('invalid_credentials')) {
      return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    }
    if (message.contains('user already registered') ||
        message.contains('email_exists')) {
      return 'هذا البريد الإلكتروني مسجل بالفعل.';
    }
    if (message.contains('password should be at least') ||
        message.contains('weak_password')) {
      return 'كلمة المرور ضعيفة. يرجى إدخال 6 خانات على الأقل.';
    }
    if (message.contains('email not confirmed')) {
      return 'يرجى تأكيد بريدك الإلكتروني أولاً.';
    }
    if (error is AuthException) return error.message;
    return '$fallbackMessage $error';
  }

  @override
  void dispose() {
    _authSubscription?.cancel();
    super.dispose();
  }
}
