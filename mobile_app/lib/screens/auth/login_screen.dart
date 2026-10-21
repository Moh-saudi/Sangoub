import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/constants/colors.dart';
import '../../models/user_model.dart';
import '../../providers/auth_provider.dart';
import '../client/client_home_screen.dart';
import '../chef/chef_portal_screen.dart';
import '../courier/courier_portal_screen.dart';
import '../admin/admin_portal_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _identifierController =
      TextEditingController(text: 'employee@capital.gov.eg');
  final TextEditingController _passwordController =
      TextEditingController(text: '123456');

  bool _obscurePassword = true;
  bool _rememberMe = true;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _navigateToRoleScreen(UserRole role) {
    Widget destination;
    switch (role) {
      case UserRole.employee:
        destination = const ClientHomeScreen();
        break;
      case UserRole.chef:
        destination = const ChefPortalScreen();
        break;
      case UserRole.courier:
        destination = const CourierPortalScreen();
        break;
      case UserRole.admin:
        destination = const AdminPortalScreen();
        break;
    }

    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => destination),
    );
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final role = await authProvider.loginWithCredentials(
      identifier: _identifierController.text,
      password: _passwordController.text,
    );

    if (!mounted) return;
    _navigateToRoleScreen(role);
  }

  Future<void> _handleGoogleSignIn() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final role = await authProvider.loginWithCredentials(
      identifier: 'google.employee@capital.gov.eg',
      password: 'sso_auth_token',
    );
    if (!mounted) return;
    _navigateToRoleScreen(role);
  }

  void _applyDemoCredentials(String identifier, String roleLabel) {
    setState(() {
      _identifierController.text = identifier;
      _passwordController.text = '123456';
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'تم إدراج بيانات $roleLabel بنجاح',
          style: GoogleFonts.cairo(fontWeight: FontWeight.bold),
        ),
        duration: const Duration(seconds: 1),
        backgroundColor: AppColors.navy,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 10),

                    // ─── Header: App Icon & Brand ──────────────────────
                    Center(
                      child: Container(
                        width: 80,
                        height: 80,
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(22),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primary.withValues(alpha: 0.12),
                              blurRadius: 20,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(16),
                          child: Image.asset(
                            'assets/images/app_icon.png',
                            fit: BoxFit.contain,
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Title
                    Text(
                      'تسجيل الدخول',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.cairo(
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                        color: AppColors.navy,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'منظومة طلبات وتوصيل الحي الحكومي بالعاصمة',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.cairo(
                        fontSize: 13,
                        color: AppColors.textMuted,
                        fontWeight: FontWeight.w500,
                      ),
                    ),

                    const SizedBox(height: 32),

                    // ─── Field 1: Identifier ────────────────────────────
                    Text(
                      'البريد الإلكتروني أو اسم المستخدم أو الهاتف',
                      style: GoogleFonts.cairo(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.navy,
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _identifierController,
                      keyboardType: TextInputType.emailAddress,
                      textDirection: TextDirection.ltr,
                      textAlign: TextAlign.left,
                      style: GoogleFonts.cairo(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                      decoration: InputDecoration(
                        hintText: 'user@capital.gov.eg / 010xxxxxxxx',
                        hintStyle: GoogleFonts.cairo(
                          fontSize: 12,
                          color: AppColors.textMuted,
                        ),
                        prefixIcon: const Icon(
                          Icons.person_outline_rounded,
                          color: AppColors.textMuted,
                        ),
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 14,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: AppColors.border),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: AppColors.border),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(
                            color: AppColors.primary,
                            width: 1.5,
                          ),
                        ),
                      ),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) {
                          return 'يرجى إدخال اسم المستخدم أو البريد الإلكتروني';
                        }
                        return null;
                      },
                    ),

                    const SizedBox(height: 18),

                    // ─── Field 2: Password ──────────────────────────────
                    Text(
                      'كلمة المرور',
                      style: GoogleFonts.cairo(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.navy,
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _passwordController,
                      obscureText: _obscurePassword,
                      textDirection: TextDirection.ltr,
                      textAlign: TextAlign.left,
                      style: const TextStyle(
                        fontSize: 16,
                        letterSpacing: 2,
                      ),
                      decoration: InputDecoration(
                        hintText: '••••••••',
                        prefixIcon: const Icon(
                          Icons.lock_outline_rounded,
                          color: AppColors.textMuted,
                        ),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscurePassword
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                            color: AppColors.textMuted,
                          ),
                          onPressed: () {
                            setState(() {
                              _obscurePassword = !_obscurePassword;
                            });
                          },
                        ),
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 14,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: AppColors.border),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: AppColors.border),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(
                            color: AppColors.primary,
                            width: 1.5,
                          ),
                        ),
                      ),
                      validator: (val) {
                        if (val == null || val.length < 4) {
                          return 'يرجى إدخال كلمة مرور صحيحة';
                        }
                        return null;
                      },
                    ),

                    const SizedBox(height: 12),

                    // Remember Me & Forgot Password
                    Row(
                      children: [
                        SizedBox(
                          width: 24,
                          height: 24,
                          child: Checkbox(
                            value: _rememberMe,
                            activeColor: AppColors.primary,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(6),
                            ),
                            onChanged: (val) {
                              setState(() => _rememberMe = val ?? true);
                            },
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'تذكر بيانات الدخول',
                          style: GoogleFonts.cairo(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.navy,
                          ),
                        ),
                        const Spacer(),
                        TextButton(
                          onPressed: () {},
                          style: TextButton.styleFrom(
                            padding: EdgeInsets.zero,
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: Text(
                            'نسيت كلمة المرور؟',
                            style: GoogleFonts.cairo(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 24),

                    // ─── Primary Submit Button ───────────────────────────
                    ElevatedButton(
                      onPressed: authProvider.isLoading ? null : _handleLogin,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        minimumSize: const Size.fromHeight(52),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        elevation: 2,
                      ),
                      child: authProvider.isLoading
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.white,
                              ),
                            )
                          : Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  'تسجيل الدخول',
                                  style: GoogleFonts.cairo(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                const Icon(
                                  Icons.arrow_forward_rounded,
                                  size: 18,
                                ),
                              ],
                            ),
                    ),

                    const SizedBox(height: 16),

                    // ─── Google SSO ─────────────────────────────────────
                    OutlinedButton.icon(
                      onPressed: authProvider.isLoading ? null : _handleGoogleSignIn,
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(48),
                        foregroundColor: AppColors.navy,
                        side: const BorderSide(color: AppColors.border),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      icon: Image.network(
                        'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg',
                        height: 18,
                        errorBuilder: (context, error, stackTrace) =>
                            const Icon(Icons.g_mobiledata_rounded, size: 24),
                      ),
                      label: Text(
                        'المتابعة بحساب Google المعتمد',
                        style: GoogleFonts.cairo(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),

                    const SizedBox(height: 28),

                    // ─── Quick Fill Demo Chips for Easy Testing ──────────
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(
                                Icons.key_rounded,
                                size: 14,
                                color: AppColors.primary,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                'تعبئة بيانات سريعة للاختبار:',
                                style: GoogleFonts.cairo(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textMuted,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8,
                            runSpacing: 6,
                            children: [
                              ActionChip(
                                label: Text(
                                  'موظف حكومي',
                                  style: GoogleFonts.cairo(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                avatar: const Icon(Icons.person, size: 14),
                                onPressed: () => _applyDemoCredentials(
                                  'employee@capital.gov.eg',
                                  'الموظف الحكومي',
                                ),
                              ),
                              ActionChip(
                                label: Text(
                                  'شيف المطبخ',
                                  style: GoogleFonts.cairo(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                avatar: const Icon(Icons.restaurant, size: 14),
                                onPressed: () => _applyDemoCredentials(
                                  'chef@capital.gov.eg',
                                  'شيف المطبخ',
                                ),
                              ),
                              ActionChip(
                                label: Text(
                                  'مندوب التوصيل',
                                  style: GoogleFonts.cairo(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                avatar: const Icon(Icons.two_wheeler, size: 14),
                                onPressed: () => _applyDemoCredentials(
                                  'courier@capital.gov.eg',
                                  'مندوب التوصيل',
                                ),
                              ),
                              ActionChip(
                                label: Text(
                                  'إدارة الحي',
                                  style: GoogleFonts.cairo(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                avatar: const Icon(Icons.admin_panel_settings, size: 14),
                                onPressed: () => _applyDemoCredentials(
                                  'admin@capital.gov.eg',
                                  'إدارة الحي الحكومي',
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
