import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/services/firebase_service.dart';
import '../models/user_model.dart';

class AuthProvider with ChangeNotifier {
  UserModel? _currentUser;
  bool _isLoading = false;

  UserModel? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _currentUser != null;

  AuthProvider() {
    _loadUserFromPrefs();
  }

  Future<void> _loadUserFromPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final userId = prefs.getString('user_id');
    final roleName = prefs.getString('user_role');
    final name = prefs.getString('user_name');
    final email = prefs.getString('user_email');
    final ministry = prefs.getString('user_ministry');
    final office = prefs.getString('user_office');

    if (userId != null && roleName != null) {
      final role = UserRole.values.firstWhere(
        (r) => r.name == roleName,
        orElse: () => UserRole.employee,
      );
      _currentUser = UserModel(
        id: userId,
        name: name ?? 'موظف العاصمة',
        email: email ?? 'employee@capital.gov.eg',
        phone: '01012345678',
        role: role,
        ministryName: ministry ?? 'وزارة الاتصالات وتكنولوجيا المعلومات',
        officeNumber: office ?? 'مكتب 402 - الدور الرابع',
      );
      notifyListeners();
    }
  }

  Future<void> loginAsRole({
    required UserRole role,
    String? name,
    String? email,
    String? ministryName,
    String? officeNumber,
  }) async {
    _isLoading = true;
    notifyListeners();

    await Future.delayed(const Duration(milliseconds: 600));

    String defaultName;
    switch (role) {
      case UserRole.employee:
        defaultName = name ?? 'أحمد محمود (موظف حكومي)';
        break;
      case UserRole.chef:
        defaultName = name ?? 'الشيف طارق (مطبخ العاصمة المركزي)';
        break;
      case UserRole.courier:
        defaultName = name ?? 'كابتن عمر (دليفري الحي الحكومي)';
        break;
      case UserRole.admin:
        defaultName = name ?? 'د. حسام السعيد (إدارة الحي الحكومي)';
        break;
    }

    _currentUser = UserModel(
      id: 'USR_${DateTime.now().millisecondsSinceEpoch}',
      name: defaultName,
      email: email ?? '${role.name}@capital.gov.eg',
      phone: '01012345678',
      role: role,
      ministryName: ministryName ?? 'وزارة الاتصالات وتكنولوجيا المعلومات',
      officeNumber: officeNumber ?? 'الدور 4 - مكتب 402',
    );

    // Write to Firestore /users/{userId}
    FirebaseService().saveUserProfile(_currentUser!);

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('user_id', _currentUser!.id);
    await prefs.setString('user_role', role.name);
    await prefs.setString('user_name', _currentUser!.name);
    await prefs.setString('user_email', _currentUser!.email);
    if (_currentUser!.ministryName != null) {
      await prefs.setString('user_ministry', _currentUser!.ministryName!);
    }
    if (_currentUser!.officeNumber != null) {
      await prefs.setString('user_office', _currentUser!.officeNumber!);
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    _currentUser = null;
    notifyListeners();
  }
}
