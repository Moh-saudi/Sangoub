import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';
import '../auth/role_select_login_screen.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _controller = PageController();
  int _currentPage = 0;

  final List<String> _onboardingImages = [
    'assets/images/onboarding_1.png',
    'assets/images/onboarding_2.png',
    'assets/images/onboarding_3.png',
    'assets/images/onboarding_4.png',
  ];

  void _navigateToLogin() {
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) =>
            const RoleSelectLoginScreen(),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
        transitionDuration: const Duration(milliseconds: 400),
      ),
    );
  }

  void _goToNextPage() {
    if (_currentPage < _onboardingImages.length - 1) {
      _controller.nextPage(
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeInOut,
      );
    } else {
      _navigateToLogin();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Widget _buildInteractivePage(int index) {
    // 941 x 1672 canvas matches the high-res onboarding asset resolution
    return Center(
      child: FittedBox(
        fit: BoxFit.contain,
        alignment: Alignment.center,
        child: SizedBox(
          width: 941,
          height: 1672,
          child: Stack(
            children: [
              // High-resolution Onboarding Graphic
              Image.asset(
                _onboardingImages[index],
                width: 941,
                height: 1672,
                fit: BoxFit.fill,
              ),

              // Overlay Interactive Tap Targets directly on the image's buttons
              if (index == 0) ...[
                // Screen 1: "ابدأ الآن" full-width orange pill button
                Positioned(
                  left: 45,
                  top: 1475,
                  width: 850,
                  height: 145,
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(72),
                      splashColor: Colors.white.withValues(alpha: 0.3),
                      highlightColor: Colors.white.withValues(alpha: 0.15),
                      onTap: _goToNextPage,
                    ),
                  ),
                ),
              ] else if (index == 1 || index == 2) ...[
                // Screen 2 & 3: "تخطي" on bottom left
                Positioned(
                  left: 60,
                  top: 1480,
                  width: 270,
                  height: 160,
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(30),
                      splashColor: AppColors.primary.withValues(alpha: 0.2),
                      highlightColor: AppColors.primary.withValues(alpha: 0.1),
                      onTap: _navigateToLogin,
                    ),
                  ),
                ),

                // Screen 2 & 3: "التالي" orange pill button on bottom right
                Positioned(
                  left: 420,
                  top: 1430,
                  width: 460,
                  height: 200,
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(100),
                      splashColor: Colors.white.withValues(alpha: 0.3),
                      highlightColor: Colors.white.withValues(alpha: 0.15),
                      onTap: _goToNextPage,
                    ),
                  ),
                ),
              ] else if (index == 3) ...[
                // Screen 4: "ابدأ الآن" full-width orange pill button
                Positioned(
                  left: 110,
                  top: 1400,
                  width: 720,
                  height: 210,
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(105),
                      splashColor: Colors.white.withValues(alpha: 0.3),
                      highlightColor: Colors.white.withValues(alpha: 0.15),
                      onTap: _navigateToLogin,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: PageView.builder(
          controller: _controller,
          itemCount: _onboardingImages.length,
          onPageChanged: (index) {
            setState(() {
              _currentPage = index;
            });
          },
          itemBuilder: (context, index) {
            return _buildInteractivePage(index);
          },
        ),
      ),
    );
  }
}
