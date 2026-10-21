import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/constants/colors.dart';
import '../../models/order_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/orders_provider.dart';

class CourierPortalScreen extends StatefulWidget {
  const CourierPortalScreen({super.key});

  @override
  State<CourierPortalScreen> createState() => _CourierPortalScreenState();
}

class _CourierPortalScreenState extends State<CourierPortalScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  void _showOtpVerificationDialog(BuildContext context, OrdersProvider orders, OrderModel order) {
    final TextEditingController otpController = TextEditingController();
    bool isSubmitting = false;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              title: Row(
                children: [
                  const Icon(Icons.security_rounded, color: AppColors.primary),
                  const SizedBox(width: 8),
                  Text(
                    'تأكيد تسليم الطلب (OTP)',
                    style: GoogleFonts.cairo(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.navy),
                  ),
                ],
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'اطلب من الموظف (${order.customerName}) في ${order.ministryName} رمز الاستلام المكون من 4 أرقام:',
                    style: GoogleFonts.cairo(fontSize: 13, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: otpController,
                    keyboardType: TextInputType.number,
                    maxLength: 4,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.cairo(fontSize: 24, fontWeight: FontWeight.w900, letterSpacing: 8),
                    decoration: InputDecoration(
                      counterText: '',
                      hintText: '••••',
                      filled: true,
                      fillColor: AppColors.surfaceMuted,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.primaryContainer.withValues(alpha: 0.3),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.payments_rounded, color: AppColors.primaryDark, size: 20),
                        const SizedBox(width: 8),
                        Text(
                          'المبلغ المطلوب تحصيله: ${order.total.toStringAsFixed(0)} ج.م',
                          style: GoogleFonts.cairo(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primaryDark,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: isSubmitting ? null : () => Navigator.pop(ctx),
                  child: Text('إلغاء', style: GoogleFonts.cairo(color: AppColors.textSecondary)),
                ),
                ElevatedButton(
                  onPressed: isSubmitting
                      ? null
                      : () async {
                          final otp = otpController.text.trim();
                          if (otp.length < 4) return;
                          setDialogState(() => isSubmitting = true);

                          try {
                            final success = await orders.confirmDelivery(
                              orderId: order.id,
                              otpCode: otp,
                              collectedAmount: order.total,
                            );

                            if (!ctx.mounted) return;
                            Navigator.pop(ctx);

                            if (success) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  backgroundColor: AppColors.statusDelivered,
                                  content: Text(
                                    '✅ تم تسليم الطلب بنجاح وتم تحصيل ${order.total.toStringAsFixed(0)} ج.م!',
                                    style: GoogleFonts.cairo(fontWeight: FontWeight.bold),
                                  ),
                                ),
                              );
                            }
                          } catch (e) {
                            if (!ctx.mounted) return;
                            setDialogState(() => isSubmitting = false);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                backgroundColor: Colors.red,
                                content: Text(
                                  '❌ رمز الاستلام غير صحيح أو فشل التأكيد: ${e.toString().replaceAll('Exception: ', '')}',
                                  style: GoogleFonts.cairo(fontWeight: FontWeight.bold),
                                ),
                              ),
                            );
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.statusDelivered,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: isSubmitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : Text('تأكيد التسليم', style: GoogleFonts.cairo(fontWeight: FontWeight.bold, color: Colors.white)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final orders = Provider.of<OrdersProvider>(context);
    final auth = Provider.of<AuthProvider>(context);

    final available = orders.courierAvailableOrders;
    final active = orders.courierActiveOrders;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Column(
          children: [
            Text(
              'بوابة كابتن التوصيل 🛵',
              style: GoogleFonts.cairo(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.navy),
            ),
            Text(
              auth.currentUser?.name ?? 'كابتن الحي الحكومي',
              style: GoogleFonts.cairo(fontSize: 11, color: AppColors.textSecondary),
            ),
          ],
        ),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          labelStyle: GoogleFonts.cairo(fontWeight: FontWeight.bold, fontSize: 13),
          indicatorColor: AppColors.primary,
          tabs: [
            Tab(text: 'طلبات جاهزة للاستلام (${available.length})'),
            Tab(text: 'طلبات قيد التوصيل (${active.length})'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: AppColors.navy),
            tooltip: 'تسجيل الخروج',
            onPressed: () => auth.signOut(),
          ),
        ],
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Tab 1: Available Orders
          available.isEmpty
              ? Center(
                  child: Text(
                    'لا توجد طلبات جاهزة للاستلام حالياً 🛵',
                    style: GoogleFonts.cairo(color: AppColors.textMuted, fontSize: 14),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: available.length,
                  itemBuilder: (context, index) {
                    final order = available[index];
                    return Container(
                      margin: const EdgeInsets.only(bottom: 14),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: AppColors.statusReady.withValues(alpha: 0.3)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.03),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                order.id,
                                style: GoogleFonts.cairo(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.navy),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: AppColors.accentGold.withValues(alpha: 0.2),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  'حافز: 25 ج.م ⚡',
                                  style: GoogleFonts.cairo(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.navy),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              const Icon(Icons.restaurant, size: 16, color: AppColors.primary),
                              const SizedBox(width: 6),
                              Text(
                                'المطعم: ${order.restaurantName}',
                                style: GoogleFonts.cairo(fontSize: 12, fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              const Icon(Icons.location_on, size: 16, color: AppColors.navy),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  'الوجهة: ${order.ministryName} - ${order.buildingNumber}',
                                  style: GoogleFonts.cairo(fontSize: 12, color: AppColors.textSecondary),
                                ),
                              ),
                            ],
                          ),
                          const Divider(height: 20),
                          ElevatedButton.icon(
                            onPressed: () {
                              orders.assignCourier(
                                order.id,
                                auth.currentUser?.name ?? 'كابتن العاصمة',
                                '01012345678',
                              );
                              _tabController.animateTo(1);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  backgroundColor: AppColors.primary,
                                  content: Text(
                                    'تم استلام الطلب! توجه الآن إلى مقر الوزارة 🛵',
                                    style: GoogleFonts.cairo(fontWeight: FontWeight.bold),
                                  ),
                                ),
                              );
                            },
                            icon: const Icon(Icons.two_wheeler_rounded, color: Colors.white),
                            label: Text(
                              'استلام الطلب والتوجه لمكتب الوزارة',
                              style: GoogleFonts.cairo(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),

          // Tab 2: Active Deliveries
          active.isEmpty
              ? Center(
                  child: Text(
                    'ليس لديك رحلات توصيل جارية حالياً',
                    style: GoogleFonts.cairo(color: AppColors.textMuted, fontSize: 14),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: active.length,
                  itemBuilder: (context, index) {
                    final order = active[index];
                    return Container(
                      margin: const EdgeInsets.only(bottom: 14),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: AppColors.primary.withValues(alpha: 0.4)),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.primary.withValues(alpha: 0.08),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                order.id,
                                style: GoogleFonts.cairo(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.navy),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: AppColors.statusOnTheWay.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  'في الطريق 🛵',
                                  style: GoogleFonts.cairo(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.statusOnTheWay),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),

                          // Target ministry detailed office
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceMuted,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    const Icon(Icons.account_balance_rounded, size: 18, color: AppColors.navy),
                                    const SizedBox(width: 8),
                                    Text(
                                      order.ministryName,
                                      style: GoogleFonts.cairo(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.navy),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '🏢 ${order.buildingNumber} • 📍 ${order.floor} • 🚪 ${order.officeNumber}',
                                  style: GoogleFonts.cairo(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '👤 الموظف: ${order.customerName} (${order.customerPhone})',
                                  style: GoogleFonts.cairo(fontSize: 12, color: AppColors.textSecondary),
                                ),
                              ],
                            ),
                          ),

                          const SizedBox(height: 14),

                          // Complete Delivery with OTP Button
                          ElevatedButton.icon(
                            onPressed: () => _showOtpVerificationDialog(context, orders, order),
                            icon: const Icon(Icons.pin_outlined, color: Colors.white),
                            label: Text(
                              'تسليم الطلب وإدخال رمز OTP للموظف',
                              style: GoogleFonts.cairo(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.statusDelivered,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ],
      ),
    );
  }
}
