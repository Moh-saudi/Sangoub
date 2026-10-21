import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/constants/colors.dart';
import '../../models/order_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/orders_provider.dart';

class ChefPortalScreen extends StatelessWidget {
  const ChefPortalScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final orders = Provider.of<OrdersProvider>(context);
    final auth = Provider.of<AuthProvider>(context);
    final chefOrders = orders.chefOrders;

    final pendingCount = chefOrders.where((o) => o.status == OrderStatus.pendingChef).length;
    final cookingCount = chefOrders.where((o) => o.status == OrderStatus.cooking).length;
    final readyCount = chefOrders.where((o) => o.status == OrderStatus.readyForPickup).length;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Column(
          children: [
            Text(
              'بوابة الشيف والمطبخ المركزي 👨‍🍳',
              style: GoogleFonts.cairo(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.navy),
            ),
            Text(
              auth.currentUser?.name ?? 'مطبخ الحي الحكومي',
              style: GoogleFonts.cairo(fontSize: 11, color: AppColors.textSecondary),
            ),
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
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // KPI Counters for Chef
            Row(
              children: [
                _buildStatCard('جديد بالمطبخ', '$pendingCount', AppColors.statusPending, Icons.alarm),
                const SizedBox(width: 10),
                _buildStatCard('قيد الطهي', '$cookingCount', AppColors.statusCooking, Icons.soup_kitchen),
                const SizedBox(width: 10),
                _buildStatCard('جاهز للمندوب', '$readyCount', AppColors.statusReady, Icons.done_all),
              ],
            ),

            const SizedBox(height: 20),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'طلبات المطبخ الواردة لحظياً',
                  style: GoogleFonts.cairo(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.navy),
                ),
                Text(
                  '${chefOrders.length} طلبات',
                  style: GoogleFonts.cairo(fontSize: 13, color: AppColors.textSecondary, fontWeight: FontWeight.bold),
                ),
              ],
            ),

            const SizedBox(height: 12),

            if (chefOrders.isEmpty)
              Container(
                padding: const EdgeInsets.all(32),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(
                  'لا توجد طلبات واردة حالياً للمطبخ 🌟',
                  style: GoogleFonts.cairo(color: AppColors.textMuted, fontSize: 14),
                ),
              )
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: chefOrders.length,
                itemBuilder: (context, index) {
                  final order = chefOrders[index];
                  final storeId = auth.currentUser?.storeId ??
                      (order.storeIds.isNotEmpty ? order.storeIds.first : '');
                  final kitchenStage = order.kitchenStatus[storeId] ??
                      (order.status == OrderStatus.pendingChef
                          ? 'received'
                          : (order.status == OrderStatus.cooking ? 'preparing' : 'ready'));

                  return Container(
                    margin: const EdgeInsets.only(bottom: 14),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: order.status.color.withValues(alpha: 0.3)),
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
                        // Header: Order ID & Status Badge
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              order.id,
                              style: GoogleFonts.cairo(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: AppColors.navy,
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: order.status.color.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                order.status.arabicLabel,
                                style: GoogleFonts.cairo(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: order.status.color,
                                ),
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 8),

                        // Destination Ministry info
                        Row(
                          children: [
                            const Icon(Icons.location_city_rounded, size: 16, color: AppColors.primary),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                '${order.ministryName} (${order.buildingNumber} • ${order.floor} • ${order.officeNumber})',
                                style: GoogleFonts.cairo(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.navy,
                                ),
                              ),
                            ),
                          ],
                        ),

                        const Divider(height: 20),

                        // Order Meals & Details
                        Text(
                          'مكونات الطلب:',
                          style: GoogleFonts.cairo(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        ...order.items.map(
                          (item) => Padding(
                            padding: const EdgeInsets.symmetric(vertical: 3),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  '• ${item.name}',
                                  style: GoogleFonts.cairo(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.navy),
                                ),
                                Text(
                                  '× ${item.quantity}',
                                  style: GoogleFonts.cairo(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.primary),
                                ),
                              ],
                            ),
                          ),
                        ),

                        const SizedBox(height: 14),

                        // Action Buttons based on kitchenStage
                        if (kitchenStage == 'received')
                          ElevatedButton.icon(
                            onPressed: () async {
                              try {
                                await orders.advanceKitchenStage(
                                  orderId: order.id,
                                  storeId: storeId,
                                );
                              } catch (e) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('خطأ: $e'), backgroundColor: Colors.red),
                                  );
                                }
                              }
                            },
                            icon: const Icon(Icons.soup_kitchen_rounded, color: Colors.white),
                            label: Text(
                              'قبول وبدء التحضير في المطبخ',
                              style: GoogleFonts.cairo(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.statusCooking,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          )
                        else if (kitchenStage == 'preparing')
                          ElevatedButton.icon(
                            onPressed: () async {
                              try {
                                await orders.advanceKitchenStage(
                                  orderId: order.id,
                                  storeId: storeId,
                                );
                              } catch (e) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('خطأ: $e'), backgroundColor: Colors.red),
                                  );
                                }
                              }
                            },
                            icon: const Icon(Icons.check_circle_outline, color: Colors.white),
                            label: Text(
                              'الوجبة جاهزة للاستلام (إشعار المناديب 🛵)',
                              style: GoogleFonts.cairo(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.statusReady,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          )
                        else
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: AppColors.statusReady.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.two_wheeler_rounded, color: AppColors.statusReady, size: 20),
                                const SizedBox(width: 8),
                                Text(
                                  'تم تجهيز الوجبة وجاهزة للاستلام من المندوب',
                                  style: GoogleFonts.cairo(
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.statusReady,
                                  ),
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

  Widget _buildStatCard(String title, String count, Color color, IconData icon) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 6),
            Text(
              count,
              style: GoogleFonts.cairo(fontSize: 20, fontWeight: FontWeight.w900, color: AppColors.navy),
            ),
            Text(
              title,
              style: GoogleFonts.cairo(fontSize: 11, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}
