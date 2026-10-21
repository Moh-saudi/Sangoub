import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/constants/colors.dart';
import '../../core/constants/google_logo_bytes.dart';
import '../../models/user_model.dart';
import '../../models/ministry_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/orders_provider.dart';
import '../client/client_home_screen.dart';
import '../chef/chef_portal_screen.dart';
import '../courier/courier_portal_screen.dart';
import '../admin/admin_notice_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Sign In Form
  final _signInFormKey = GlobalKey<FormState>();
  final _signInEmailController = TextEditingController();
  final _signInPasswordController = TextEditingController();
  bool _obscureSignInPassword = true;

  // Sign Up Form
  final _signUpFormKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _signUpEmailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _signUpPasswordController = TextEditingController();
  final _floorController = TextEditingController();
  final _roomController = TextEditingController();
  bool _obscureSignUpPassword = true;
  String _selectedMinistry = 'رئاسة مجلس الوزراء';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _signInEmailController.dispose();
    _signInPasswordController.dispose();
    _fullNameController.dispose();
    _signUpEmailController.dispose();
    _phoneController.dispose();
    _signUpPasswordController.dispose();
    _floorController.dispose();
    _roomController.dispose();
    super.dispose();
  }

  void _routeByRole(UserRole role, BuildContext context) {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final ordersProvider = Provider.of<OrdersProvider>(context, listen: false);
    final user = auth.currentUser;

    if (user != null) {
      // بدء استماع الطلبات فور تسجيل الدخول الحقيقي
      ordersProvider.startListeningToOrders(
        uid: user.id,
        role: role,
        storeId: user.storeId,
      );
    }

    Widget destination;
    switch (role) {
      case UserRole.admin:
        destination = const AdminNoticeScreen();
        break;
      case UserRole.restaurant:
        destination = const ChefPortalScreen();
        break;
      case UserRole.courier:
        destination = const CourierPortalScreen();
        break;
      case UserRole.employee:
        destination = const ClientHomeScreen();
        break;
    }

    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => destination),
    );
  }

  Future<void> _handleSignIn() async {
    if (!_signInFormKey.currentState!.validate()) return;
    final auth = Provider.of<AuthProvider>(context, listen: false);

    try {
      final role = await auth.signInWithEmailAndPassword(
        email: _signInEmailController.text.trim(),
        password: _signInPasswordController.text,
      );
      if (!mounted) return;
      _routeByRole(role, context);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(auth.errorMessage ?? e.toString()),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  Future<void> _handleSignUp() async {
    if (!_signUpFormKey.currentState!.validate()) return;
    final auth = Provider.of<AuthProvider>(context, listen: false);

    try {
      await auth.signUpWithEmailAndPassword(
        email: _signUpEmailController.text.trim(),
        password: _signUpPasswordController.text,
        fullName: _fullNameController.text.trim(),
        phone: _phoneController.text.trim(),
        ministry: _selectedMinistry,
        floorNumber: _floorController.text.trim(),
        roomNumber: _roomController.text.trim(),
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('تم إنشاء حساب موظف حكومي بنجاح!'),
          backgroundColor: AppColors.primary,
        ),
      );
      _routeByRole(UserRole.employee, context);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(auth.errorMessage ?? e.toString()),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  Future<void> _handleGoogleSignIn() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      final role = await auth.signInWithGoogle();
      if (!mounted) return;
      if (auth.isAuthenticated) {
        _routeByRole(role, context);
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(auth.errorMessage ?? e.toString()),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 10),
                  // App Logo & Header
                  Center(
                    child: Hero(
                      tag: 'app_logo',
                      child: Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primary.withValues(alpha: 0.15),
                              blurRadius: 18,
                              offset: const Offset(0, 6),
                            ),
                          ],
                        ),
                        child: ClipOval(
                          child: Image.asset(
                            'assets/images/app_icon.png',
                            fit: BoxFit.contain,
                            errorBuilder: (context, error, stackTrace) => const Icon(
                              Icons.delivery_dining,
                              size: 38,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Center(
                    child: Text(
                      'طلبات العاصمة',
                      style: GoogleFonts.cairo(
                        fontSize: 26,
                        fontWeight: FontWeight.bold,
                        color: AppColors.navy,
                      ),
                    ),
                  ),
                  Center(
                    child: Text(
                      'منظومة التوصيل الذكي لموظفي الحي الحكومي',
                      style: GoogleFonts.cairo(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Tabs: Sign In / Sign Up
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.black.withValues(alpha: 0.06)),
                    ),
                    child: TabBar(
                      controller: _tabController,
                      indicatorColor: AppColors.primary,
                      indicatorWeight: 3,
                      labelColor: AppColors.primary,
                      unselectedLabelColor: AppColors.textSecondary,
                      labelStyle: GoogleFonts.cairo(fontWeight: FontWeight.bold, fontSize: 14),
                      tabs: const [
                        Tab(text: 'تسجيل الدخول'),
                        Tab(text: 'موظف حكومي جديد'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Tab Views
                  SizedBox(
                    height: 520,
                    child: TabBarView(
                      controller: _tabController,
                      children: [
                        _buildSignInForm(auth),
                        _buildSignUpForm(auth),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSignInForm(AuthProvider auth) {
    return Form(
      key: _signInFormKey,
      child: ListView(
        shrinkWrap: true,
        physics: const BouncingScrollPhysics(),
        children: [
          TextFormField(
            controller: _signInEmailController,
            keyboardType: TextInputType.emailAddress,
            textDirection: TextDirection.ltr,
            decoration: InputDecoration(
              labelText: 'البريد الإلكتروني',
              hintText: 'name@capital.gov.eg',
              prefixIcon: const Icon(Icons.email_outlined, color: AppColors.primary),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              filled: true,
              fillColor: Colors.white,
            ),
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'أدخل البريد الإلكتروني';
              if (!v.contains('@')) return 'صيغة البريد غير صحيحة';
              return null;
            },
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _signInPasswordController,
            obscureText: _obscureSignInPassword,
            textDirection: TextDirection.ltr,
            decoration: InputDecoration(
              labelText: 'كلمة المرور',
              prefixIcon: const Icon(Icons.lock_outline, color: AppColors.primary),
              suffixIcon: IconButton(
                icon: Icon(_obscureSignInPassword ? Icons.visibility_off : Icons.visibility),
                onPressed: () => setState(() => _obscureSignInPassword = !_obscureSignInPassword),
              ),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              filled: true,
              fillColor: Colors.white,
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'أدخل كلمة المرور';
              if (v.length < 6) return 'كلمة المرور 6 خانات على الأقل';
              return null;
            },
          ),
          const SizedBox(height: 24),
          SizedBox(
            height: 52,
            child: ElevatedButton(
              onPressed: auth.isLoading ? null : _handleSignIn,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: auth.isLoading
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                    )
                  : Text(
                      'تسجيل الدخول',
                      style: GoogleFonts.cairo(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(child: Divider(color: Colors.black.withValues(alpha: 0.12))),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text('أو عبر الدخول الموحد', style: GoogleFonts.cairo(fontSize: 12, color: AppColors.textSecondary)),
              ),
              Expanded(child: Divider(color: Colors.black.withValues(alpha: 0.12))),
            ],
          ),
          const SizedBox(height: 16),
          // Google Sign In
          SizedBox(
            height: 50,
            child: OutlinedButton.icon(
              onPressed: auth.isLoading ? null : _handleGoogleSignIn,
              icon: Image.memory(base64Decode(googleLogoBase64), width: 22, height: 22),
              label: Text(
                'المتابعة بحساب Google المعتمد',
                style: GoogleFonts.cairo(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.navy,
                ),
              ),
              style: OutlinedButton.styleFrom(
                backgroundColor: Colors.white,
                side: BorderSide(color: Colors.black.withValues(alpha: 0.12)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSignUpForm(AuthProvider auth) {
    return Form(
      key: _signUpFormKey,
      child: ListView(
        shrinkWrap: true,
        physics: const BouncingScrollPhysics(),
        children: [
          TextFormField(
            controller: _fullNameController,
            decoration: InputDecoration(
              labelText: 'الاسم الكامل للموظف',
              hintText: 'م. أحمد محمود',
              prefixIcon: const Icon(Icons.person_outline, color: AppColors.primary),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              filled: true,
              fillColor: Colors.white,
            ),
            validator: (v) => (v == null || v.trim().isEmpty) ? 'أدخل الاسم الكامل' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _signUpEmailController,
            keyboardType: TextInputType.emailAddress,
            textDirection: TextDirection.ltr,
            decoration: InputDecoration(
              labelText: 'البريد الإلكتروني',
              hintText: 'employee@capital.gov.eg',
              prefixIcon: const Icon(Icons.email_outlined, color: AppColors.primary),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              filled: true,
              fillColor: Colors.white,
            ),
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'أدخل البريد الإلكتروني';
              if (!v.contains('@')) return 'صيغة البريد غير صحيحة';
              return null;
            },
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _phoneController,
            keyboardType: TextInputType.phone,
            textDirection: TextDirection.ltr,
            decoration: InputDecoration(
              labelText: 'رقم الهاتف المصري',
              hintText: '01012345678',
              prefixIcon: const Icon(Icons.phone_outlined, color: AppColors.primary),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              filled: true,
              fillColor: Colors.white,
            ),
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'أدخل رقم الهاتف';
              if (!RegExp(r'^(\+20|0)1[0125]\d{8}$').hasMatch(v.trim())) {
                return 'أدخل رقم موبايل مصري صحيح يبدأ بـ 01';
              }
              return null;
            },
          ),
          const SizedBox(height: 12),
          // Ministry Selector
          DropdownButtonFormField<String>(
            initialValue: _selectedMinistry,
            decoration: InputDecoration(
              labelText: 'الوزارة / الهيئة الحكومية',
              prefixIcon: const Icon(Icons.account_balance_outlined, color: AppColors.primary),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              filled: true,
              fillColor: Colors.white,
            ),
            isExpanded: true,
            items: MinistryModel.governmentDistrictMinistries.map((m) {
              return DropdownMenuItem<String>(
                value: m.nameArabic,
                child: Text(m.nameArabic, overflow: TextOverflow.ellipsis),
              );
            }).toList(),
            onChanged: (v) {
              if (v != null) setState(() => _selectedMinistry = v);
            },
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _floorController,
                  decoration: InputDecoration(
                    labelText: 'الدور',
                    hintText: 'الدور الرابع',
                    prefixIcon: const Icon(Icons.layers_outlined, color: AppColors.primary),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    filled: true,
                    fillColor: Colors.white,
                  ),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'أدخل الدور' : null,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextFormField(
                  controller: _roomController,
                  decoration: InputDecoration(
                    labelText: 'المكتب / الغرفة',
                    hintText: 'مكتب 402',
                    prefixIcon: const Icon(Icons.meeting_room_outlined, color: AppColors.primary),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    filled: true,
                    fillColor: Colors.white,
                  ),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'أدخل رقم المكتب' : null,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _signUpPasswordController,
            obscureText: _obscureSignUpPassword,
            textDirection: TextDirection.ltr,
            decoration: InputDecoration(
              labelText: 'كلمة المرور',
              prefixIcon: const Icon(Icons.lock_outline, color: AppColors.primary),
              suffixIcon: IconButton(
                icon: Icon(_obscureSignUpPassword ? Icons.visibility_off : Icons.visibility),
                onPressed: () => setState(() => _obscureSignUpPassword = !_obscureSignUpPassword),
              ),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              filled: true,
              fillColor: Colors.white,
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'أدخل كلمة المرور';
              if (v.length < 6) return 'كلمة المرور 6 خانات على الأقل';
              return null;
            },
          ),
          const SizedBox(height: 20),
          SizedBox(
            height: 52,
            child: ElevatedButton(
              onPressed: auth.isLoading ? null : _handleSignUp,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: auth.isLoading
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                    )
                  : Text(
                      'إنشاء حساب موظف حكومي',
                      style: GoogleFonts.cairo(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
