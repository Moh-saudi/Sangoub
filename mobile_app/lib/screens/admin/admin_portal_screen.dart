import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/constants/colors.dart';
import '../../models/ministry_model.dart';
import '../../models/order_model.dart';
import '../../providers/orders_provider.dart';
import '../auth/role_select_login_screen.dart';

class AdminPortalScreen extends StatelessWidget {
  const AdminPortalScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final orders = Provider.of<OrdersProvider>(context);
    final allOrders = orders.orders;

    final totalSales = allOrders.fold(0.0, (sum, o) => sum + o.total);
    final activeOrders = allOrders.where((o) => o.status != OrderStatus.delivered && o.status != OrderStatus.cancelled).length;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Column(
          children: [
            Text(
              'لوحة إدارة الحي الحكومي 🏛️',
              style: GoogleFonts.cairo(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.navy),
            ),
            Text(
              'العاصمة الإدارية الجديدة - مركز التحكم والعمليات',
              style: GoogleFonts.cairo(fontSize: 11, color: AppColors.textSecondary),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.switch_account_outlined, color: AppColors.navy),
            tooltip: 'تغيير الدور',
            onPressed: () {
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(builder: (_) => const RoleSelectLoginScreen()),
              );
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // KPI Grid
            Row(
              children: [
                _buildKpiCard('إجمالي المبيعات', '${totalSales.toStringAsFixed(0)} ج.م', AppColors.primary, Icons.attach_money_rounded),
                const SizedBox(width: 12),
                _buildKpiCard('طلبات جارية', '$activeOrders', AppColors.statusCooking, Icons.delivery_dining_rounded),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _buildKpiCard('الوزارات المغطاة', '${MinistryModel.governmentDistrictMinistries.length}', AppColors.navy, Icons.account_balance_rounded),
                const SizedBox(width: 12),
                _buildKpiCard('إجمالي الطلبات', '${allOrders.length}', AppColors.statusDelivered, Icons.receipt_long_rounded),
              ],
            ),

            const SizedBox(height: 24),

            Text(
              'متابعة حركة الطلبات الميدانية لحظياً',
              style: GoogleFonts.cairo(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.navy),
            ),

            const SizedBox(height: 12),

            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: allOrders.length,
              itemBuilder: (context, index) {
                final order = allOrders[index];
                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: order.status.color.withValues(alpha: 0.15),
                        child: Icon(order.status.icon, color: order.status.color, size: 20),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  order.id,
                                  style: GoogleFonts.cairo(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.navy),
                                ),
                                Text(
                                  '${order.total.toStringAsFixed(0)} ج.م',
                                  style: GoogleFonts.cairo(fontWeight: FontWeight.bold, color: AppColors.primary, fontSize: 13),
                                ),
                              ],
                            ),
                            Text(
                              '${order.ministryName} (${order.officeNumber})',
                              style: GoogleFonts.cairo(fontSize: 12, color: AppColors.textSecondary),
                            ),
                            Text(
                              'الحالة: ${order.status.arabicLabel}',
                              style: GoogleFonts.cairo(fontSize: 11, fontWeight: FontWeight.bold, color: order.status.color),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildKpiCard(String title, String value, Color color, IconData icon) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
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
            CircleAvatar(
              radius: 18,
              backgroundColor: color.withValues(alpha: 0.15),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 12),
            Text(
              value,
              style: GoogleFonts.cairo(fontSize: 20, fontWeight: FontWeight.w900, color: AppColors.navy),
            ),
            Text(
              title,
              style: GoogleFonts.cairo(fontSize: 12, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}
