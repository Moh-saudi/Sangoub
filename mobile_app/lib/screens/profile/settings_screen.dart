import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/constants/colors.dart';
import '../../providers/auth_provider.dart';
import '../auth/login_screen.dart';
import 'account_info_screen.dart';
import 'saved_addresses_screen.dart';
import 'privacy_policy_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _notificationsEnabled = true;
  String _currentLanguage = 'العربية (Arabic)';
  final String _currentCountry = 'Egypt (مصر) 🇪🇬';

  void _showLanguageDialog() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Select Language / اختر اللغة',
              style: GoogleFonts.cairo(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            ListTile(
              title: const Text('العربية (Arabic) 🇪🇬'),
              trailing: _currentLanguage.contains('Arabic')
                  ? const Icon(Icons.check_circle_rounded, color: AppColors.primary)
                  : null,
              onTap: () {
                setState(() => _currentLanguage = 'العربية (Arabic)');
                Navigator.of(ctx).pop();
              },
            ),
            const Divider(),
            ListTile(
              title: const Text('English (الإنجليزية) 🇬🇧'),
              trailing: _currentLanguage.contains('English')
                  ? const Icon(Icons.check_circle_rounded, color: AppColors.primary)
                  : null,
              onTap: () {
                setState(() => _currentLanguage = 'English (الإنجليزية)');
                Navigator.of(ctx).pop();
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context, listen: false);

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.black, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          'Settings',
          style: GoogleFonts.cairo(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Colors.black,
          ),
        ),
        centerTitle: false,
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        physics: const BouncingScrollPhysics(),
        children: [
          // Account Info
          _buildSettingsRow(
            title: 'Account info',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const AccountInfoScreen()),
              );
            },
          ),
          const Divider(height: 1, indent: 16, endIndent: 16, color: Color(0xFFF1F5F9)),

          // Saved Addresses
          _buildSettingsRow(
            title: 'Saved addresses',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const SavedAddressesScreen()),
              );
            },
          ),
          const Divider(height: 1, indent: 16, endIndent: 16, color: Color(0xFFF1F5F9)),

          // Notifications
          _buildSettingsRow(
            title: 'Notifications',
            trailingText: _notificationsEnabled ? 'Enabled' : 'Disabled',
            onTap: () {
              setState(() => _notificationsEnabled = !_notificationsEnabled);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    _notificationsEnabled ? 'تم تفعيل الإشعارات' : 'تم تعطيل الإشعارات',
                    style: GoogleFonts.cairo(),
                  ),
                  duration: const Duration(seconds: 1),
                  backgroundColor: AppColors.navy,
                ),
              );
            },
          ),
          const Divider(height: 1, indent: 16, endIndent: 16, color: Color(0xFFF1F5F9)),

          // Language
          _buildSettingsRow(
            title: 'Language',
            trailingText: _currentLanguage,
            onTap: _showLanguageDialog,
          ),
          const Divider(height: 1, indent: 16, endIndent: 16, color: Color(0xFFF1F5F9)),

          // Country
          _buildSettingsRow(
            title: 'Country',
            trailingText: _currentCountry,
            onTap: () {},
          ),
          const Divider(height: 1, indent: 16, endIndent: 16, color: Color(0xFFF1F5F9)),

          // Privacy Policy
          _buildSettingsRow(
            title: 'Privacy policy',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const PrivacyPolicyScreen()),
              );
            },
          ),
          const Divider(height: 1, indent: 16, endIndent: 16, color: Color(0xFFF1F5F9)),

          // Log Out
          _buildSettingsRow(
            title: 'Log out',
            isDestructive: true,
            onTap: () async {
              await auth.signOut();
              if (!context.mounted) return;
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
                (route) => false,
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsRow({
    required String title,
    String? trailingText,
    bool isDestructive = false,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        child: Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: GoogleFonts.cairo(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: isDestructive ? Colors.red.shade600 : Colors.black87,
                ),
              ),
            ),
            if (trailingText != null) ...[
              Text(
                trailingText,
                style: GoogleFonts.cairo(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Colors.black87,
                  decoration: TextDecoration.underline,
                ),
              ),
              const SizedBox(width: 8),
            ],
            Icon(
              Icons.arrow_forward_ios_rounded,
              size: 14,
              color: isDestructive ? Colors.red.shade400 : const Color(0xFF94A3B8),
            ),
          ],
        ),
      ),
    );
  }
}
