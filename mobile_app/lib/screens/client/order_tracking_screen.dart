import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/constants/colors.dart';
import '../../models/order_model.dart';
import '../../providers/orders_provider.dart';

class OrderTrackingScreen extends StatefulWidget {
  final String orderId;

  const OrderTrackingScreen({
    super.key,
    required this.orderId,
  });

  @override
  State<OrderTrackingScreen> createState() => _OrderTrackingScreenState();
}

class _OrderTrackingScreenState extends State<OrderTrackingScreen> {
  bool _isLoadingOtp = false;
  String? _fetchedOtp;

  @override
  void initState() {
    super.initState();
    _fetchOtp();
  }

  Future<void> _fetchOtp() async {
    setState(() => _isLoadingOtp = true);
    try {
      final ordersProvider = Provider.of<OrdersProvider>(context, listen: false);
      final code = await ordersProvider.fetchOrderOtpCode(widget.orderId);
      if (mounted) {
        setState(() {
          _fetchedOtp = code;
          _isLoadingOtp = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingOtp = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final ordersProvider = Provider.of<OrdersProvider>(context);

    // Find the order or use a fallback
    final order = ordersProvider.orders.firstWhere(
      (o) => o.id == widget.orderId,
      orElse: () => OrderModel(
        id: widget.orderId,
        orderNumber: 'CAP-${widget.orderId.substring(0, widget.orderId.length > 6 ? 6 : widget.orderId.length).toUpperCase()}',
        profileId: '',
        customerName: 'موظف العاصمة',
        customerPhone: '01012345678',
        ministryName: 'وزارة الاتصالات وتكنولوجيا المعلومات',
        floor: 'الدور الرابع',
        officeNumber: 'مكتب 402',
        items: const [],
        storeIds: const [],
        kitchenStatus: const {},
        itemsSummary: '',
        subtotal: 180,
        deliveryFee: 15,
        discount: 100,
        total: 95,
        status: OrderStatus.preparing,
        otpCode: _fetchedOtp,
        restaurantName: 'مطبخ العاصمة المركزي',
        createdAt: DateTime.now(),
      ),
    );

    final String displayOtp = _fetchedOtp ?? ((order.otpCode?.isNotEmpty == true) ? order.otpCode! : '');

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.navy, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Column(
          children: [
            Text(
              'تتبع طلب الحي الحكومي',
              style: GoogleFonts.cairo(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: AppColors.navy,
              ),
            ),
            Text(
              'رقم الطلب: ${order.id}',
              style: GoogleFonts.cairo(
                fontSize: 11,
                color: AppColors.textMuted,
              ),
            ),
          ],
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // ─── Live Status Header Card ─────────────────────────────
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.navy, Color(0xFF233554)],
                  begin: Alignment.topRight,
                  end: Alignment.bottomLeft,
                ),
                borderRadius: BorderRadius.circular(22),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.navy.withValues(alpha: 0.25),
                    blurRadius: 18,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: order.status.color.withValues(alpha: 0.2),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(order.status.icon, color: order.status.color, size: 28),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              order.status.arabicLabel,
                              style: GoogleFonts.cairo(
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'الوقت المتوقع للوصول: 15-20 دقيقة ⏱️',
                              style: GoogleFonts.cairo(
                                fontSize: 12,
                                color: Colors.white.withValues(alpha: 0.8),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 18),

                  // Progress Bar
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: LinearProgressIndicator(
                      value: _calculateProgress(order.status),
                      minHeight: 8,
                      backgroundColor: Colors.white.withValues(alpha: 0.15),
                      valueColor: AlwaysStoppedAnimation<Color>(order.status.color),
                    ),
                  ),
                ],
              ),
            ).animate().slideY(begin: 0.1, end: 0, duration: 400.ms).fadeIn(),

            const SizedBox(height: 16),

            // ─── Prominent Secret OTP Handover Code ──────────────────
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.3), width: 1.5),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.08),
                    blurRadius: 14,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.primaryContainer.withValues(alpha: 0.4),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(Icons.pin_rounded, color: AppColors.primaryDark, size: 30),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'رمز التحقق والاستلام (OTP):',
                          style: GoogleFonts.cairo(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: AppColors.navy,
                          ),
                        ),
                        Text(
                          'أعطِ هذا الرمز للكابتن فقط عند استلام الوجبة بمكتبك',
                          style: GoogleFonts.cairo(
                            fontSize: 11,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  InkWell(
                    onTap: _fetchOtp,
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: _isLoadingOtp
                          ? const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : Text(
                              displayOtp.isNotEmpty ? displayOtp : 'عرض الرمز',
                              style: GoogleFonts.cairo(
                                fontSize: displayOtp.isNotEmpty ? 20 : 13,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                                letterSpacing: displayOtp.isNotEmpty ? 3 : 0,
                              ),
                            ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // ─── Step-by-Step Timeline ───────────────────────────────
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.03),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'مراحل تحضير وتوصيل الطلب',
                    style: GoogleFonts.cairo(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: AppColors.navy,
                    ),
                  ),
                  const SizedBox(height: 18),

                  _buildTimelineStep(
                    title: 'تم استلام وتأكيد الطلب',
                    subtitle: 'تم إرسال تفاصيل الوجبة إلى مطبخ الفود كورت المركزي',
                    icon: Icons.receipt_long_rounded,
                    isDone: true,
                    isActive: order.status == OrderStatus.received,
                  ),
                  _buildTimelineStep(
                    title: 'قيد التحضير في المطبخ',
                    subtitle: 'يقوم الشيف بتجهيز وجبتك الطازجة وتغليفها حرارياً',
                    icon: Icons.outdoor_grill_rounded,
                    isDone: order.status != OrderStatus.received,
                    isActive: order.status == OrderStatus.preparing,
                  ),
                  _buildTimelineStep(
                    title: 'في الطريق مع كابتن العاصمة',
                    subtitle: 'استلم المندوب وجبتك وهو في طريقه لمقر وزارتك',
                    icon: Icons.two_wheeler_rounded,
                    isDone: order.status == OrderStatus.withCourier || order.status == OrderStatus.delivered,
                    isActive: order.status == OrderStatus.withCourier,
                  ),
                  _buildTimelineStep(
                    title: 'تم التوصيل والتسليم',
                    subtitle: 'تم التحقق برمز OTP وتسليم الوجبة بنجاح لمكتبك',
                    icon: Icons.task_alt_rounded,
                    isDone: order.status == OrderStatus.delivered,
                    isActive: order.status == OrderStatus.delivered,
                    isLast: true,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // ─── Delivery Destination Card ───────────────────────────
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.03),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.location_on_rounded, color: AppColors.primary, size: 20),
                      const SizedBox(width: 8),
                      Text(
                        'عنوان التسليم بالحي الحكومي',
                        style: GoogleFonts.cairo(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: AppColors.navy,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    order.ministryName,
                    style: GoogleFonts.cairo(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.navy,
                    ),
                  ),
                  Text(
                    '${order.floor} • ${order.officeNumber}',
                    style: GoogleFonts.cairo(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  double _calculateProgress(OrderStatus status) {
    switch (status) {
      case OrderStatus.received:
        return 0.25;
      case OrderStatus.preparing:
        return 0.50;
      case OrderStatus.ready:
        return 0.70;
      case OrderStatus.withCourier:
        return 0.85;
      case OrderStatus.delivered:
        return 1.0;
      case OrderStatus.cancelled:
        return 0.0;
    }
  }

  Widget _buildTimelineStep({
    required String title,
    required String subtitle,
    required IconData icon,
    required bool isDone,
    required bool isActive,
    bool isLast = false,
  }) {
    final color = isDone ? AppColors.primary : const Color(0xFFCBD5E1);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: isDone ? AppColors.primary : Colors.white,
                shape: BoxShape.circle,
                border: Border.all(color: color, width: 2),
              ),
              child: Icon(
                icon,
                color: isDone ? Colors.white : const Color(0xFF94A3B8),
                size: 18,
              ),
            ),
            if (!isLast)
              Container(
                width: 2,
                height: 40,
                color: isDone ? AppColors.primary : const Color(0xFFE2E8F0),
              ),
          ],
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 4, bottom: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.cairo(
                    fontSize: 14,
                    fontWeight: isDone ? FontWeight.bold : FontWeight.w600,
                    color: isDone ? AppColors.navy : const Color(0xFF64748B),
                  ),
                ),
                Text(
                  subtitle,
                  style: GoogleFonts.cairo(
                    fontSize: 11,
                    color: AppColors.textMuted,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
