import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/constants/colors.dart';
import '../../core/constants/google_logo_bytes.dart';
import '../../models/user_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/orders_provider.dart';
import '../client/client_home_screen.dart';
import '../chef/chef_portal_screen.dart';
import '../courier/courier_portal_screen.dart';
import '../admin/admin_notice_screen.dart';
import '../profile/privacy_policy_screen.dart';

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
  bool _obscureSignUpPassword = true;
  bool _hasWhatsApp = true;
  bool _acceptTerms = false;
  String? _detectedCarrierName;
  Color? _detectedCarrierColor;
  String? _detectedCarrierIcon;

  void _updateCarrierInfo(String text) {
    final clean = text.trim().replaceAll(RegExp(r'\s+|-'), '');
    setState(() {
      if (clean.startsWith('010') || clean.startsWith('+2010')) {
        _detectedCarrierName = 'فودافون';
        _detectedCarrierColor = const Color(0xFFE60000);
        _detectedCarrierIcon = '🔴';
      } else if (clean.startsWith('011') || clean.startsWith('+2011')) {
        _detectedCarrierName = 'اتصالات (e&)';
        _detectedCarrierColor = const Color(0xFF15803D);
        _detectedCarrierIcon = '🟢';
      } else if (clean.startsWith('012') || clean.startsWith('+2012')) {
        _detectedCarrierName = 'أورنج';
        _detectedCarrierColor = const Color(0xFFEA580C);
        _detectedCarrierIcon = '🟠';
      } else if (clean.startsWith('015') || clean.startsWith('+2015')) {
        _detectedCarrierName = 'وي (WE)';
        _detectedCarrierColor = const Color(0xFF7C3AED);
        _detectedCarrierIcon = '🟣';
      } else {
        _detectedCarrierName = null;
        _detectedCarrierColor = null;
        _detectedCarrierIcon = null;
      }
    });
  }

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (mounted) setState(() {});
    });
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

  void _showAppleErrorPopup(BuildContext context, {required String rawError}) {
    String title = 'تعذر تسجيل الدخول';
    String friendlyMessage = 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى.';
    String? hint;

    final lower = rawError.toLowerCase();
    if (lower.contains('permission-denied') || lower.contains('permission')) {
      title = 'صلاحيات الدخول';
      friendlyMessage = 'تم التحقق من بياناتك، ولكن لم يتم تفعيل صلاحيات الحساب بعد على قاعدة البيانات.';
      hint = 'إذا كان هذا أول دخول لك، يمكنك الضغط على "إنشاء حساب جديد" لتوثيق ملفك فوراً.';
    } else if (lower.contains('user-not-found') || lower.contains('invalid-credential') || lower.contains('invalid_login_credentials')) {
      title = 'بيانات غير صحيحة';
      friendlyMessage = 'البريد الإلكتروني أو كلمة المرور غير مطابقة، أو أن الحساب لم يتم إنشاؤه بعد.';
      hint = 'تأكد من كتابة البريد وكلمة المرور بدقة، أو أنشئ حساباً جديداً بالتبويب المجاور.';
    } else if (lower.contains('wrong-password')) {
      title = 'كلمة المرور غير صحيحة';
      friendlyMessage = 'كلمة المرور التي أدخلتها غير صحيحة.';
      hint = 'يرجى مراجعة كلمة المرور والمحاولة مرة أخرى.';
    } else if (lower.contains('email-already-in-use')) {
      title = 'البريد مسجل مسبقاً';
      friendlyMessage = 'هذا البريد الإلكتروني مسجل بالفعل في منظومة طلبات العاصمة.';
      hint = 'يمكنك التوجه لتبويب "تسجيل الدخول" واستخدام كلمة المرور الخاصة بك.';
    } else if (lower.contains('weak-password')) {
      title = 'كلمة مرور ضعيفة';
      friendlyMessage = 'كلمة المرور ضعيفة ولا تلبي معايير الأمان.';
      hint = 'يرجى إدخال 6 أحرف أو أرقام على الأقل.';
    } else if (lower.contains('network') || lower.contains('connection')) {
      title = 'تعذر الاتصال بالخادم';
      friendlyMessage = 'يرجى التحقق من اتصال جهازك بالإنترنت.';
      hint = 'حاول مجدداً بعد بضع ثوانٍ.';
    } else if (lower.contains('apiexception: 10') || lower.contains('api: 10') || lower.contains('api 10') || lower.contains('sign_in_failed')) {
      title = 'تفعيل الدخول بحساب Google (SHA-1)';
      friendlyMessage = 'يتطلب تشغيل الدخول بحساب Google إضافة بصمة الـ SHA-1 الخاصة بالتطبيق داخل مشروع Firebase Console.';
      hint = 'بصمة SHA-1 لجهازك جاهزة:\n1B:AD:D1:B0:B7:2D:2C:40:FC:97:DA:89:24:EF:CE:2D:01:3A:B5:D3';
    } else {
      friendlyMessage = rawError
          .replaceAll('Exception:', '')
          .replaceAll('حدث خطأ أثناء تسجيل الدخول:', '')
          .trim();
      if (friendlyMessage.isEmpty) {
        friendlyMessage = 'حدث خطأ غير متوقع، يرجى إعادة المحاولة.';
      }
    }

    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => Center(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 28),
          padding: const EdgeInsets.fromLTRB(22, 26, 22, 20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.18),
                blurRadius: 30,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Material(
            color: Colors.transparent,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Apple-style Red Badge Icon
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEE2E2),
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0xFFFECACA), width: 1.5),
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.error_outline_rounded,
                      color: Color(0xFFDC2626),
                      size: 32,
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Title
                Text(
                  title,
                  style: GoogleFonts.cairo(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppColors.navy,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),

                // Friendly Message
                Text(
                  friendlyMessage,
                  style: GoogleFonts.cairo(
                    fontSize: 13.5,
                    color: const Color(0xFF475569),
                    height: 1.45,
                  ),
                  textAlign: TextAlign.center,
                ),

                if (hint != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.lightbulb_outline_rounded, size: 16, color: AppColors.primary),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            hint,
                            style: GoogleFonts.cairo(
                              fontSize: 11.5,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 22),

                // Action Button (Apple / Google Style)
                SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: ElevatedButton(
                    onPressed: () => Navigator.of(ctx).pop(),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.navy,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: Text(
                      'حسناً، فهمت',
                      style: GoogleFonts.cairo(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
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
      _showAppleErrorPopup(context, rawError: auth.errorMessage ?? e.toString());
    }
  }

  Future<void> _handleSignUp() async {
    if (!_acceptTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'يرجى الموافقة على شروط الاستخدام وسياسة الخصوصية لإنشاء الحساب',
            style: GoogleFonts.cairo(fontWeight: FontWeight.bold),
          ),
          backgroundColor: Colors.red.shade700,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    if (!_signUpFormKey.currentState!.validate()) return;
    final auth = Provider.of<AuthProvider>(context, listen: false);

    try {
      await auth.signUpWithEmailAndPassword(
        email: _signUpEmailController.text.trim(),
        password: _signUpPasswordController.text,
        fullName: _fullNameController.text.trim(),
        phone: _phoneController.text.trim(),
        ministry: 'العاصمة الإدارية والمناطق المحيطة',
        floorNumber: 'غير محدد',
        roomNumber: 'غير محدد',
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('تم إنشاء الحساب بنجاح!'),
          backgroundColor: AppColors.primary,
        ),
      );
      _routeByRole(UserRole.employee, context);
    } catch (e) {
      if (!mounted) return;
      _showAppleErrorPopup(context, rawError: auth.errorMessage ?? e.toString());
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
      _showAppleErrorPopup(context, rawError: auth.errorMessage ?? e.toString());
    }
  }

  void _openForgotPasswordDialog() {
    final emailController = TextEditingController(
      text: _signInEmailController.text.trim(),
    );
    final formKey = GlobalKey<FormState>();
    bool isSubmitting = false;

    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          return Center(
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 24),
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.16),
                    blurRadius: 30,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Material(
                color: Colors.transparent,
                child: Form(
                  key: formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.12),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.lock_reset_rounded,
                          color: AppColors.primary,
                          size: 30,
                        ),
                      ),
                      const SizedBox(height: 14),
                      Text(
                        'استعادة كلمة المرور',
                        style: GoogleFonts.cairo(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: AppColors.navy,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'أدخل بريدك الإلكتروني المسجل في منظومة طلبات العاصمة، وسنرسل لك رابطاً مباشراً لتعيين كلمة مرور جديدة.',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.cairo(
                          fontSize: 12.5,
                          color: AppColors.textSecondary,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 18),
                      TextFormField(
                        controller: emailController,
                        keyboardType: TextInputType.emailAddress,
                        textDirection: TextDirection.ltr,
                        decoration: InputDecoration(
                          labelText: 'البريد الإلكتروني',
                          hintText: 'name@capital.gov.eg',
                          prefixIcon: const Icon(Icons.email_outlined, color: AppColors.primary),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                          filled: true,
                          fillColor: const Color(0xFFF8FAFC),
                        ),
                        validator: (v) {
                          if (v == null || v.trim().isEmpty) return 'يرجى إدخال البريد الإلكتروني';
                          if (!v.contains('@') || !v.contains('.')) return 'صيغة البريد الإلكتروني غير صحيحة';
                          return null;
                        },
                      ),
                      const SizedBox(height: 20),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: isSubmitting ? null : () => Navigator.of(ctx).pop(),
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(color: Color(0xFFCBD5E1)),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                padding: const EdgeInsets.symmetric(vertical: 12),
                              ),
                              child: Text(
                                'إلغاء',
                                style: GoogleFonts.cairo(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            flex: 2,
                            child: ElevatedButton(
                              onPressed: isSubmitting
                                  ? null
                                  : () async {
                                      if (!formKey.currentState!.validate()) return;
                                      setDialogState(() => isSubmitting = true);
                                      final auth = Provider.of<AuthProvider>(context, listen: false);
                                      try {
                                        await auth.sendPasswordResetEmail(emailController.text.trim());
                                        if (!mounted) return;
                                        if (ctx.mounted) {
                                          Navigator.of(ctx).pop();
                                        }
                                        _showPasswordResetSuccessDialog(emailController.text.trim());
                                      } catch (e) {
                                        if (ctx.mounted) {
                                          setDialogState(() => isSubmitting = false);
                                        }
                                        if (!mounted) return;
                                        ScaffoldMessenger.of(this.context).showSnackBar(
                                          SnackBar(
                                            content: Text(
                                              'تعذر إرسال الرابط: ${auth.errorMessage ?? e.toString()}',
                                              style: GoogleFonts.cairo(),
                                            ),
                                            backgroundColor: Colors.red.shade700,
                                          ),
                                        );
                                      }
                                    },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                elevation: 0,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                padding: const EdgeInsets.symmetric(vertical: 12),
                              ),
                              child: isSubmitting
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                    )
                                  : Text(
                                      'إرسال الرابط',
                                      style: GoogleFonts.cairo(
                                        fontSize: 13,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.white,
                                      ),
                                    ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  void _showPasswordResetSuccessDialog(String email) {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => Center(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 28),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.16),
                blurRadius: 30,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Material(
            color: Colors.transparent,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: Colors.green.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.mark_email_read_rounded,
                    color: Colors.green,
                    size: 32,
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  'تم إرسال الرابط بنجاح! ✉️',
                  style: GoogleFonts.cairo(
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                    color: AppColors.navy,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'أرسلنا رابط إعادة تعيين كلمة المرور إلى:\n$email\n\nيرجى مراجعة صندوق الوارد (أو مجلد الرسائل غير المرغوب فيها Spam) والضغط على الرابط لتعيين كلمة مرور جديدة.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.cairo(
                    fontSize: 12.5,
                    color: AppColors.textSecondary,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  height: 44,
                  child: ElevatedButton(
                    onPressed: () => Navigator.of(ctx).pop(),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.navy,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 0,
                    ),
                    child: Text(
                      'حسناً، فهمت',
                      style: GoogleFonts.cairo(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
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
                      'منظومة التوصيل الذكي بالعاصمة الإدارية',
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
                        Tab(text: 'إنشاء حساب جديد'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Tab Views
                  SizedBox(
                    height: 540,
                    child: TabBarView(
                      clipBehavior: Clip.none,
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
        padding: const EdgeInsets.only(top: 14, bottom: 20, left: 2, right: 2),
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
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: _openForgotPasswordDialog,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              icon: const Icon(Icons.help_outline_rounded, size: 15, color: AppColors.primary),
              label: Text(
                'نسيت كلمة المرور؟',
                style: GoogleFonts.cairo(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primary,
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
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
          const SizedBox(height: 16),
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
          const SizedBox(height: 12),
          // Google Sign In
          SizedBox(
            height: 48,
            child: OutlinedButton.icon(
              onPressed: auth.isLoading ? null : _handleGoogleSignIn,
              icon: Image.memory(base64Decode(googleLogoBase64), width: 22, height: 22),
              label: Text(
                'المتابعة باستخدام Google',
                style: GoogleFonts.cairo(
                  fontSize: 13,
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
          const SizedBox(height: 16),
          // Quick Demo Test Fill Section (Apple/Google style card)
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.bolt_rounded, color: AppColors.primary, size: 18),
                    const SizedBox(width: 6),
                    Text(
                      'حسابات تجريبية سريعة (اضغط للملء والتجربة):',
                      style: GoogleFonts.cairo(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: AppColors.navy,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    _buildDemoAccountChip(
                      label: 'موظف حكومي',
                      icon: Icons.person_rounded,
                      email: 'employee1@capital.gov.eg',
                      password: 'password123',
                    ),
                    _buildDemoAccountChip(
                      label: 'شيف مطبخ',
                      icon: Icons.restaurant_rounded,
                      email: 'chef@capital.gov.eg',
                      password: 'password123',
                    ),
                    _buildDemoAccountChip(
                      label: 'مندوب توصيل',
                      icon: Icons.two_wheeler_rounded,
                      email: 'courier@capital.gov.eg',
                      password: 'password123',
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDemoAccountChip({
    required String label,
    required IconData icon,
    required String email,
    required String password,
  }) {
    return InkWell(
      onTap: () {
        setState(() {
          _signInEmailController.text = email;
          _signInPasswordController.text = password;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('تم ملء بيانات: $label ($email)'),
            duration: const Duration(seconds: 2),
            backgroundColor: AppColors.navy,
            behavior: SnackBarBehavior.floating,
          ),
        );
      },
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFCBD5E1)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: AppColors.primary),
            const SizedBox(width: 4),
            Text(
              label,
              style: GoogleFonts.cairo(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.navy,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showTermsAndConditionsSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        height: MediaQuery.of(ctx).size.height * 0.85,
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          children: [
            Container(
              width: 44,
              height: 5,
              decoration: BoxDecoration(
                color: const Color(0xFFCBD5E1),
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'شروط وأحكام منصة طلبات العاصمة',
                  style: GoogleFonts.cairo(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppColors.navy,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.of(ctx).pop(),
                ),
              ],
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 12),
                physics: const BouncingScrollPhysics(),
                children: [
                  _buildTermsItem(
                    title: '1. نطاق الخدمة والتوصيل',
                    content:
                        'خدمة "طلبات العاصمة" مخصصة لتلبية احتياجات العاملين والزوار والمقيمين بكافة أرجاء العاصمة الإدارية الجديدة (الحي الحكومي، حي المال والأعمال CBD، الأحياء السكنية R3 و R5 و R7 و R8، الكمبوندات، والداون تاون) بالإضافة لنطاق التوسع والمدن المجاورة كمدينة الشروق ومدينة بدر ومدينتي والمستقبل سيتي.',
                  ),
                  _buildTermsItem(
                    title: '2. دقة بيانات التوصيل والتواصل',
                    content:
                        'يجب على العميل إدخال رقم هاتف مصري نشط وصحيح مكون من 11 رقماً، وتحديد ما إذا كان الرقم مزوداً بخدمة واتساب لتسهيل التواصل مع مندوب التوصيل وغرفة العمليات فور وصول الطلب للمبنى أو الدور المحدد.',
                  ),
                  _buildTermsItem(
                    title: '3. الأسعار، الضرائب، وطرق السداد',
                    content:
                        'الأسعار معلنة بشفافية، وتشمل الضرائب المعتمدة. يُتاح الدفع عبر بطاقات ميزة الحكومية، البطاقات الائتمانية والبنكية عبر بوابة جيديا (Geidea)، محفظة الموظف، أو الدفع نقداً عند الاستلام.',
                  ),
                  _buildTermsItem(
                    title: '4. سياسة الإلغاء وتجهيز الوجبات',
                    content:
                        'يحق للعميل إلغاء الطلب قبل بدء الشيف بالمطعم في تجهيز الطعام. بعد بدء التجهيز، يتعذر الإلغاء لضمان معايير الجودة والسلامة الغذائية المعمول بها في المطابخ المركزية.',
                  ),
                  _buildTermsItem(
                    title: '5. إجراءات الأمن والسلامة في المقرات الحكومية',
                    content:
                        'يلتزم مناديب طلبات العاصمة بكافة اللوائح والتعليمات الأمنية للمباني الحكومية والمجمعات السكنية، ويتم تسليم الطلب إما في بهو الاستقبال المعتمد أو مباشرة إلى المكتب والدور وفق تصريح الجهة.',
                  ),
                  _buildTermsItem(
                    title: '6. خصوصية وسرية البيانات',
                    content:
                        'نلتزم بأعلى معايير حماية البيانات وسريتها ولا نقوم بمشاركة أي أرقام هواتف أو مواقع جغرافية مع أي أطراف إعلانية خارجية.',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: () {
                  setState(() => _acceptTerms = true);
                  Navigator.of(ctx).pop();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                child: Text(
                  'الموافقة على الشروط والمتابعة',
                  style: GoogleFonts.cairo(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTermsItem({required String title, required String content}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: GoogleFonts.cairo(
              fontSize: 13.5,
              fontWeight: FontWeight.bold,
              color: AppColors.navy,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            content,
            style: GoogleFonts.cairo(
              fontSize: 12,
              color: const Color(0xFF475569),
              height: 1.55,
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
        padding: const EdgeInsets.only(top: 14, bottom: 20, left: 2, right: 2),
        physics: const BouncingScrollPhysics(),
        children: [
          TextFormField(
            controller: _fullNameController,
            decoration: InputDecoration(
              labelText: 'الاسم الكامل',
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
            onChanged: _updateCarrierInfo,
            decoration: InputDecoration(
              labelText: 'رقم الهاتف المصري (11 رقماً)',
              hintText: '01012345678 أو 011...',
              prefixIcon: const Icon(Icons.phone_outlined, color: AppColors.primary),
              suffixIcon: _detectedCarrierName != null
                  ? Container(
                      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: _detectedCarrierColor?.withValues(alpha: 0.12) ?? const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: _detectedCarrierColor?.withValues(alpha: 0.4) ?? const Color(0xFFCBD5E1),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _detectedCarrierIcon ?? '',
                            style: const TextStyle(fontSize: 12),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            _detectedCarrierName!,
                            style: GoogleFonts.cairo(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: _detectedCarrierColor ?? AppColors.navy,
                            ),
                          ),
                        ],
                      ),
                    )
                  : null,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              filled: true,
              fillColor: Colors.white,
            ),
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'أدخل رقم الهاتف المصري';
              final clean = v.trim().replaceAll(RegExp(r'\s+|-'), '');
              if (clean.length != 11) {
                return 'رقم الهاتف يجب أن يكون 11 رقماً (أنت أدخلت ${clean.length} أرقام)';
              }
              if (!RegExp(r'^(010|011|012|015)\d{8}$').hasMatch(clean)) {
                return 'رقم هاتف مصري غير صحيح (يبدأ بـ 010 أو 011 أو 012 أو 015)';
              }
              return null;
            },
          ),
          const SizedBox(height: 6),

          // WhatsApp Status Checkbox
          InkWell(
            onTap: () => setState(() => _hasWhatsApp = !_hasWhatsApp),
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
              child: Row(
                children: [
                  SizedBox(
                    width: 20,
                    height: 20,
                    child: Checkbox(
                      value: _hasWhatsApp,
                      onChanged: (val) => setState(() => _hasWhatsApp = val ?? true),
                      activeColor: const Color(0xFF25D366),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'الرقم مفعّل عليه تطبيق واتساب (WhatsApp)',
                    style: GoogleFonts.cairo(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: _hasWhatsApp ? const Color(0xFF15803D) : AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(width: 4),
                  const Text('💬', style: TextStyle(fontSize: 13)),
                ],
              ),
            ),
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
          const SizedBox(height: 14),

          // Talabat-style Terms & Conditions Checkbox
          InkWell(
            onTap: () => setState(() => _acceptTerms = !_acceptTerms),
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 2),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 22,
                    height: 22,
                    child: Checkbox(
                      value: _acceptTerms,
                      onChanged: (val) => setState(() => _acceptTerms = val ?? false),
                      activeColor: AppColors.primary,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(5)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text.rich(
                      TextSpan(
                        text: 'أوافق على ',
                        style: GoogleFonts.cairo(fontSize: 12, color: const Color(0xFF475569)),
                        children: [
                          WidgetSpan(
                            alignment: PlaceholderAlignment.middle,
                            child: InkWell(
                              onTap: _showTermsAndConditionsSheet,
                              child: Text(
                                'شروط الاستخدام',
                                style: GoogleFonts.cairo(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.primary,
                                  decoration: TextDecoration.underline,
                                ),
                              ),
                            ),
                          ),
                          const TextSpan(text: ' و'),
                          WidgetSpan(
                            alignment: PlaceholderAlignment.middle,
                            child: InkWell(
                              onTap: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(builder: (_) => const PrivacyPolicyScreen()),
                                );
                              },
                              child: Text(
                                'سياسة الخصوصية',
                                style: GoogleFonts.cairo(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.primary,
                                  decoration: TextDecoration.underline,
                                ),
                              ),
                            ),
                          ),
                          const TextSpan(text: ' لمنظومة طلبات العاصمة'),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
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
                      'إنشاء حساب جديد',
                      style: GoogleFonts.cairo(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: Divider(color: Colors.black.withValues(alpha: 0.12))),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text('أو التسجيل السريع', style: GoogleFonts.cairo(fontSize: 12, color: AppColors.textSecondary)),
              ),
              Expanded(child: Divider(color: Colors.black.withValues(alpha: 0.12))),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 48,
            child: OutlinedButton.icon(
              onPressed: auth.isLoading ? null : _handleGoogleSignIn,
              icon: Image.memory(base64Decode(googleLogoBase64), width: 22, height: 22),
              label: Text(
                'التسجيل باستخدام Google',
                style: GoogleFonts.cairo(
                  fontSize: 13,
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
}