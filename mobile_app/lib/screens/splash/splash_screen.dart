import 'dart:async';
import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/constants/colors.dart';
import '../onboarding/onboarding_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _rotationController;
  int _currentStepIndex = 0;

  final List<String> _loadingSteps = [
    'تهيئة خدمات وقوائم الحي الحكومي',
    'مزامنة المتاجر والمطاعم المعتمدة',
    'تأمين الاتصال وتشفير بيانات الطلب',
  ];

  @override
  void initState() {
    super.initState();
    _rotationController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    )..repeat();

    // Progress through loading steps
    Timer(const Duration(milliseconds: 900), () {
      if (mounted) setState(() => _currentStepIndex = 1);
    });
    Timer(const Duration(milliseconds: 1800), () {
      if (mounted) setState(() => _currentStepIndex = 2);
    });

    // Navigate to Onboarding
    Timer(const Duration(milliseconds: 3200), () {
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        PageRouteBuilder(
          pageBuilder: (context, animation, secondaryAnimation) =>
              const OnboardingScreen(),
          transitionsBuilder:
              (context, animation, secondaryAnimation, child) {
            return FadeTransition(opacity: animation, child: child);
          },
          transitionDuration: const Duration(milliseconds: 600),
        ),
      );
    });
  }

  @override
  void dispose() {
    _rotationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Stack(
          children: [
            // Center Content: Glowing Aura + Logo Card + Text
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // ─── Glow Aura & Logo Container ───────────────────
                  SizedBox(
                    width: 240,
                    height: 240,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        // Layer 1: Rotating Colorful Aura with Blur
                        AnimatedBuilder(
                          animation: _rotationController,
                          builder: (context, child) {
                            return Transform.rotate(
                              angle: _rotationController.value * 2 * math.pi,
                              child: ImageFiltered(
                                imageFilter: ImageFilter.blur(
                                  sigmaX: 38,
                                  sigmaY: 38,
                                ),
                                child: Container(
                                  width: 170,
                                  height: 170,
                                  decoration: const BoxDecoration(
                                    shape: BoxShape.circle,
                                    gradient: SweepGradient(
                                      colors: [
                                        Color(0xFFFF5A00), // طلبات Orange
                                        Color(0xFFE11D48), // Deep Rose / Pink
                                        Color(0xFF8B5CF6), // Royal Purple
                                        Color(0xFF06B6D4), // Bright Cyan
                                        Color(0xFF10B981), // Emerald Green
                                        Color(0xFFF59E0B), // Warm Amber
                                        Color(0xFFFF5A00), // Loop back to Orange
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            );
                          },
                        ),

                        // Layer 2: White rounded card with soft shadow
                        Container(
                          width: 145,
                          height: 145,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(32),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.08),
                                blurRadius: 20,
                                offset: const Offset(0, 8),
                              ),
                              BoxShadow(
                                color: AppColors.primary.withValues(alpha: 0.15),
                                blurRadius: 30,
                                offset: const Offset(0, 10),
                              ),
                            ],
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(24),
                            child: Image.asset(
                              'assets/images/app_icon.png',
                              fit: BoxFit.contain,
                            ),
                          ),
                        )
                            .animate()
                            .scale(
                              duration: 800.ms,
                              curve: Curves.easeOutBack,
                            )
                            .fadeIn(duration: 600.ms),
                      ],
                    ),
                  ),

                  const SizedBox(height: 32),

                  // Title: "طلبات الحي الحكومي بالعاصمة"
                  Text(
                    'طلبات الحي الحكومي بالعاصمة',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.cairo(
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      color: AppColors.navy,
                      letterSpacing: 0.3,
                    ),
                  ).animate().fadeIn(delay: 300.ms).slideY(begin: 0.2, end: 0),

                  const SizedBox(height: 20),

                  // Checklist loading steps with smooth transitions
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Column(
                      children: List.generate(_loadingSteps.length, (index) {
                        final bool isCurrent = index <= _currentStepIndex;
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              AnimatedOpacity(
                                duration: const Duration(milliseconds: 300),
                                opacity: isCurrent ? 1.0 : 0.35,
                                child: Text(
                                  _loadingSteps[index],
                                  textAlign: TextAlign.center,
                                  style: GoogleFonts.cairo(
                                    fontSize: 13,
                                    fontWeight: isCurrent
                                        ? FontWeight.w600
                                        : FontWeight.normal,
                                    color: isCurrent
                                        ? AppColors.textPrimary
                                        : AppColors.textMuted,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      }),
                    ),
                  ).animate().fadeIn(delay: 500.ms),
                ],
              ),
            ),

            // Footer: "خدمة التوصيل السريع للحي الحكومي بالعاصمة الإدارية"
            Positioned(
              bottom: 24,
              left: 20,
              right: 20,
              child: Text(
                'خدمة التوصيل السريع للحي الحكومي بالعاصمة الإدارية',
                textAlign: TextAlign.center,
                style: GoogleFonts.cairo(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textMuted,
                ),
              ).animate().fadeIn(delay: 800.ms),
            ),
          ],
        ),
      ),
    );
  }
}
