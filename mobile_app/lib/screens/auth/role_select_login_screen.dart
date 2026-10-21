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

class RoleSelectLoginScreen extends StatefulWidget {
  const RoleSelectLoginScreen({super.key});

  @override
  State<RoleSelectLoginScreen> createState() => _RoleSelectLoginScreenState();
}

class _RoleSelectLoginScreenState extends State<RoleSelectLoginScreen> {
  UserRole _selectedRole = UserRole.employee;

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
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    await authProvider.loginAsRole(role: _selectedRole);
    if (!mounted) return;
    _navigateToRoleScreen(_selectedRole);
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 16),
              // App Small Logo & Branding
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: Image.asset(
                      'assets/images/app_icon.png',
                      width: 52,
                      height: 52,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            'طلبات ',
                            style: GoogleFonts.cairo(
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              color: AppColors.primary,
                            ),
                          ),
                          Text(
                            'العاصمة',
                            style: GoogleFonts.cairo(
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              color: AppColors.navy,
                            ),
                          ),
                        ],
                      ),
                      Text(
                        'منظومة الحي الحكومي الذكية',
                        style: GoogleFonts.cairo(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),

              const SizedBox(height: 32),

              Text(
                'تسجيل الدخول واختيار الحساب',
                textAlign: TextAlign.center,
                style: GoogleFonts.cairo(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: AppColors.navy,
                ),
              ),

              const SizedBox(height: 8),

              Text(
                'حدد صفتك للوصول إلى لوحة التحكم والخدمات المخصصة لك',
                textAlign: TextAlign.center,
                style: GoogleFonts.cairo(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                ),
              ),

              const SizedBox(height: 24),

              // The 4 Role Selection Cards
              _buildRoleCard(
                role: UserRole.employee,
                title: 'موظف حكومي (العميل)',
                subtitle: 'طلب الوجبات والمشروبات وتوصيلها إلى مكتب الوزارة',
                icon: Icons.person_pin_circle_rounded,
                badgeColor: AppColors.primary,
              ),
              const SizedBox(height: 12),
              _buildRoleCard(
                role: UserRole.chef,
                title: 'شيف المطعم / المطبخ',
                subtitle: 'استلام أوامر الطهي، وتحديث حالة الوجبات لحظياً',
                icon: Icons.restaurant_rounded,
                badgeColor: AppColors.statusCooking,
              ),
              const SizedBox(height: 12),
              _buildRoleCard(
                role: UserRole.courier,
                title: 'مندوب التوصيل (كابتن العاصمة)',
                subtitle: 'استلام الطلبات الجاهزة، ملاحة الخريطة، وتسليم OTP',
                icon: Icons.two_wheeler_rounded,
                badgeColor: AppColors.accentGold,
              ),
              const SizedBox(height: 12),
              _buildRoleCard(
                role: UserRole.admin,
                title: 'إدارة الحي الحكومي',
                subtitle: 'متابعة العمليات الميدانية والإحصائيات وتعيين الوزارات',
                icon: Icons.admin_panel_settings_rounded,
                badgeColor: AppColors.navy,
              ),

              const SizedBox(height: 28),

              // Enter / Login Button
              ElevatedButton(
                onPressed: authProvider.isLoading ? null : _handleLogin,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  elevation: 2,
                ),
                child: authProvider.isLoading
                    ? const SizedBox(
                        height: 24,
                        width: 24,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2.5,
                        ),
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            'الدخول كـ ${_selectedRole.titleArabic}',
                            style: GoogleFonts.cairo(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Icon(Icons.login_rounded, color: Colors.white),
                        ],
                      ),
              ),

              const SizedBox(height: 16),

              // Google Sign-In Option
              OutlinedButton.icon(
                onPressed: authProvider.isLoading ? null : _handleLogin,
                icon: Image.network(
                  'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg',
                  width: 20,
                  height: 20,
                  errorBuilder: (context, error, stackTrace) => const Icon(Icons.g_mobiledata, color: AppColors.navy, size: 28),
                ),
                label: Text(
                  'المتابعة بحساب Google الرسمي',
                  style: GoogleFonts.cairo(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.navy,
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  side: const BorderSide(color: AppColors.border),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRoleCard({
    required UserRole role,
    required String title,
    required String subtitle,
    required IconData icon,
    required Color badgeColor,
  }) {
    final bool isSelected = _selectedRole == role;

    return InkWell(
      onTap: () {
        setState(() {
          _selectedRole = role;
        });
      },
      borderRadius: BorderRadius.circular(18),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primaryContainer.withValues(alpha: 0.5) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.border,
            width: isSelected ? 2 : 1,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.12),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isSelected ? AppColors.primary : badgeColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(
                icon,
                color: isSelected ? Colors.white : badgeColor,
                size: 26,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.cairo(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: AppColors.navy,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: GoogleFonts.cairo(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              isSelected ? Icons.check_circle_rounded : Icons.radio_button_off_rounded,
              color: isSelected ? AppColors.primary : AppColors.textMuted,
            ),
          ],
        ),
      ),
    );
  }
}
