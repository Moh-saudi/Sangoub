import 'dart:async';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../core/services/firebase_service.dart';
import '../models/user_model.dart';

class AuthProvider with ChangeNotifier {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final GoogleSignIn _googleSignIn = GoogleSignIn();
  final FirebaseService _firebaseService = FirebaseService();

  StreamSubscription<User?>? _authSubscription;

  UserModel? _currentUser;
  bool _isLoading = false;
  String? _errorMessage;

  UserModel? get currentUser => _currentUser;
  User? get firebaseUser => _auth.currentUser;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get isAuthenticated => _currentUser != null && _auth.currentUser != null;

  UserRole get currentRole => _currentUser?.role ?? UserRole.employee;
  bool get isAdmin => currentRole == UserRole.admin;
  bool get isChef => currentRole == UserRole.restaurant;
  bool get isCourier => currentRole == UserRole.courier;
  bool get isEmployee => currentRole == UserRole.employee;

  AuthProvider() {
    _initAuthListener();
  }

  void _initAuthListener() {
    _authSubscription = _auth.authStateChanges().listen((User? firebaseUser) async {
      if (firebaseUser == null) {
        _currentUser = null;
        _isLoading = false;
        notifyListeners();
      } else {
        await reloadUserSession();
      }
    });
  }

  /// إعادة تحميل بيانات المستخدم والصلاحيات من Firestore (admins -> staff -> users)
  Future<void> reloadUserSession() async {
    final firebaseUser = _auth.currentUser;
    if (firebaseUser == null) return;

    try {
      _isLoading = true;
      notifyListeners();

      var profile = await _firebaseService.getUserProfile(firebaseUser.uid);
      if (profile == null) {
        // أول دخول لمستخدم موثّق: إنشاء ملف users/{uid} بالدور employee
        await _firebaseService.createInitialUserProfile(firebaseUser: firebaseUser);
        profile = await _firebaseService.getUserProfile(firebaseUser.uid);
      }

      // ─── مزامنة صورة الملف الشخصي من Google/Firebase Auth ──────────
      // إذا لم تُحفظ الصورة في Firestore (حسابات قديمة أو فاتت عند الإنشاء)
      if (profile != null &&
          (profile.avatarUrl == null || profile.avatarUrl!.trim().isEmpty) &&
          firebaseUser.photoURL != null &&
          firebaseUser.photoURL!.isNotEmpty) {
        await _firebaseService.updateUserAvatarUrl(
          uid: firebaseUser.uid,
          avatarUrl: firebaseUser.photoURL!,
        );
        profile = profile.copyWith(avatarUrl: firebaseUser.photoURL);
      }

      _currentUser = profile;
      _errorMessage = null;
    } catch (e) {
      debugPrint('reloadUserSession error: $e');
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }


  /// تسجيل الدخول بالبريد الإلكتروني وكلمة المرور الحقيقيين
  Future<UserRole> signInWithEmailAndPassword({
    required String email,
    required String password,
  }) async {
    try {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();

      final credential = await _auth.signInWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );

      final uid = credential.user!.uid;
      var profile = await _firebaseService.getUserProfile(uid);
      if (profile == null) {
        await _firebaseService.createInitialUserProfile(firebaseUser: credential.user!);
        profile = await _firebaseService.getUserProfile(uid);
      }

      _currentUser = profile;
      return _currentUser?.role ?? UserRole.employee;
    } on FirebaseAuthException catch (e) {
      _errorMessage = _mapAuthError(e.code);
      throw Exception(_errorMessage);
    } catch (e) {
      _errorMessage = 'حدث خطأ أثناء تسجيل الدخول: $e';
      throw Exception(_errorMessage);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// إرسال رابط استعادة كلمة المرور عبر البريد الإلكتروني الرسمي
  Future<void> sendPasswordResetEmail(String email) async {
    try {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();

      await _auth.sendPasswordResetEmail(email: email.trim());
    } on FirebaseAuthException catch (e) {
      _errorMessage = _mapAuthError(e.code);
      throw Exception(_errorMessage);
    } catch (e) {
      _errorMessage = 'تعذر إرسال رابط الاستعادة: $e';
      throw Exception(_errorMessage);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// إنشاء حساب موظف جديد بالبريد الإلكتروني مع بيانات الوزارة
  Future<void> signUpWithEmailAndPassword({
    required String email,
    required String password,
    required String fullName,
    required String phone,
    required String ministry,
    required String floorNumber,
    required String roomNumber,
  }) async {
    try {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();

      final credential = await _auth.createUserWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );

      final user = credential.user!;
      await user.updateDisplayName(fullName.trim());

      await _firebaseService.createInitialUserProfile(
        firebaseUser: user,
        fullName: fullName.trim(),
        phone: phone.trim(),
        ministry: ministry.trim(),
        floor: floorNumber.trim(),
        room: roomNumber.trim(),
      );

      await reloadUserSession();
    } on FirebaseAuthException catch (e) {
      _errorMessage = _mapAuthError(e.code);
      throw Exception(_errorMessage);
    } catch (e) {
      _errorMessage = 'تعذر إنشاء الحساب: $e';
      throw Exception(_errorMessage);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// تسجيل الدخول عبر Google الحقيقي
  Future<UserRole> signInWithGoogle() async {
    try {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();

      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        // ألغى المستخدم عملية التسجيل
        _isLoading = false;
        notifyListeners();
        return _currentUser?.role ?? UserRole.employee;
      }

      final GoogleSignInAuthentication googleAuth = await googleUser.authentication;
      final AuthCredential credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      final userCredential = await _auth.signInWithCredential(credential);
      final user = userCredential.user!;

      var profile = await _firebaseService.getUserProfile(user.uid);
      if (profile == null) {
        await _firebaseService.createInitialUserProfile(firebaseUser: user);
        profile = await _firebaseService.getUserProfile(user.uid);
      }

      _currentUser = profile;
      return _currentUser?.role ?? UserRole.employee;
    } catch (e) {
      _errorMessage = 'تعذر تسجيل الدخول عبر Google: $e';
      throw Exception(_errorMessage);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// تحديث بيانات مقر العمل والتواصل
  Future<void> updateAddressProfile({
    required String fullName,
    required String phone,
    required String ministry,
    required String floorNumber,
    required String roomNumber,
  }) async {
    if (_currentUser == null) return;
    try {
      _isLoading = true;
      notifyListeners();

      await _firebaseService.updateUserAddressProfile(
        uid: _currentUser!.id,
        fullName: fullName,
        phone: phone,
        ministry: ministry,
        floorNumber: floorNumber,
        roomNumber: roomNumber,
      );

      _currentUser = _currentUser!.copyWith(
        name: fullName,
        phone: phone,
        ministryName: ministry,
        floor: floorNumber,
        officeNumber: roomNumber,
      );
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// تسجيل الخروج وإلغاء الجلسات ومسح البيانات المؤقتة
  Future<void> signOut() async {
    try {
      await _googleSignIn.signOut();
    } catch (_) {}
    await _auth.signOut();
    _currentUser = null;
    _errorMessage = null;
    notifyListeners();
  }

  String _mapAuthError(String code) {
    switch (code) {
      case 'user-not-found':
      case 'wrong-password':
      case 'invalid-credential':
        return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      case 'email-already-in-use':
        return 'هذا البريد الإلكتروني مسجل بالفعل لموظف آخر.';
      case 'invalid-email':
        return 'صيغة البريد الإلكتروني غير صالحة.';
      case 'weak-password':
        return 'كلمة المرور ضعيفة. يرجى إدخال 6 خانات على الأقل.';
      case 'network-request-failed':
        return 'تعذر الاتصال بالشبكة. يرجى التحقق من اتصال الإنترنت.';
      default:
        return 'فشلت عملية المصادقة: $code';
    }
  }

  @override
  void dispose() {
    _authSubscription?.cancel();
    super.dispose();
  }
}
