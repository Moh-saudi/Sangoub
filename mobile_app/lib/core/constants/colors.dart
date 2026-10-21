import 'package:flutter/material.dart';

class AppColors {
  // Brand Identity Colors (From Capital Talabat Design)
  static const Color primary = Color(0xFFFF5A00); // طلبات Orange
  static const Color primaryDark = Color(0xFFE04E00);
  static const Color primaryLight = Color(0xFFFF7A2E);
  static const Color primaryContainer = Color(0xFFFFF2EB);

  static const Color navy = Color(0xFF1B2538); // العاصمة Deep Navy
  static const Color navyDark = Color(0xFF111827);
  static const Color navyLight = Color(0xFF2E3E5C);

  static const Color accentGold = Color(0xFFFFC72C); // Discount badge yellow
  
  // Backgrounds & Surfaces
  static const Color background = Color(0xFFF8F9FC);
  static const Color surface = Colors.white;
  static const Color surfaceMuted = Color(0xFFF1F3F7);

  // Typography Colors
  static const Color textPrimary = Color(0xFF1B2538);
  static const Color textSecondary = Color(0xFF64748B);
  static const Color textMuted = Color(0xFF94A3B8);

  // Borders & Dividers
  static const Color border = Color(0xFFE2E8F0);
  static const Color borderLight = Color(0xFFF1F5F9);

  // Status Colors (Orders)
  static const Color statusPending = Color(0xFFF59E0B);    // أصفر: بانتظار الشيف
  static const Color statusCooking = Color(0xFF3B82F6);    // أزرق: جاري التحضير
  static const Color statusReady = Color(0xFF8B5CF6);      // بنفسجي: جاهز للتسليم
  static const Color statusOnTheWay = Color(0xFFFF5A00);   // برتقالي: مع المندوب
  static const Color statusDelivered = Color(0xFF10B981);   // أخضر: تم التسليم
  static const Color statusCancelled = Color(0xFFEF4444);   // أحمر: ملغي
}
