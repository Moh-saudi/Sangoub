import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/constants/colors.dart';
import '../../models/ministry_model.dart';
import '../../models/order_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/cart_provider.dart';
import '../../providers/orders_provider.dart';
import 'order_tracking_screen.dart';

class CheckoutInvoiceScreen extends StatefulWidget {
  const CheckoutInvoiceScreen({super.key});

  @override
  State<CheckoutInvoiceScreen> createState() => _CheckoutInvoiceScreenState();
}

class _CheckoutInvoiceScreenState extends State<CheckoutInvoiceScreen> {
  String _selectedPaymentMethod = 'wallet';
  final TextEditingController _couponController = TextEditingController(text: 'CAPITAL100');
  final TextEditingController _floorController = TextEditingController(text: 'الدور الرابع');
  final TextEditingController _officeController = TextEditingController(text: 'مكتب 402');
  final TextEditingController _notesController = TextEditingController();

  bool _isProcessing = false;

  @override
  void dispose() {
    _couponController.dispose();
    _floorController.dispose();
    _officeController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _showMinistryPicker(BuildContext context, CartProvider cart) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 48,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'اختر مقر الوزارة للتوصيل',
                style: GoogleFonts.cairo(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: AppColors.navy,
                ),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: MinistryModel.allMinistries.length,
                  itemBuilder: (context, index) {
                    final ministry = MinistryModel.allMinistries[index];
                    final isSelected = cart.selectedMinistry == ministry.name;
                    return Material(
                      color: Colors.transparent,
                      child: ListTile(
                        dense: true,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        tileColor: isSelected ? AppColors.primaryContainer.withValues(alpha: 0.3) : null,
                        leading: Icon(
                          Icons.account_balance_rounded,
                          color: isSelected ? AppColors.primary : AppColors.navy,
                          size: 20,
                        ),
                        title: Text(
                          ministry.name,
                          style: GoogleFonts.cairo(
                            fontSize: 13,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                            color: isSelected ? AppColors.primaryDark : AppColors.textPrimary,
                          ),
                        ),
                        trailing: isSelected ? const Icon(Icons.check_circle, color: AppColors.primary, size: 18) : null,
                        onTap: () {
                          cart.setMinistry(ministry.name);
                          Navigator.pop(ctx);
                        },
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _processCheckout() async {
    final cart = Provider.of<CartProvider>(context, listen: false);
    final orders = Provider.of<OrdersProvider>(context, listen: false);
    final auth = Provider.of<AuthProvider>(context, listen: false);

    if (cart.items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'السلة فارغة حالياً، يرجى إضافة وجبات أولاً',
            style: GoogleFonts.cairo(),
          ),
          backgroundColor: AppColors.navy,
        ),
      );
      return;
    }

    setState(() => _isProcessing = true);

    await Future.delayed(const Duration(milliseconds: 1000));

    // Create the order model
    final order = OrderModel(
      id: 'ORD_${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}',
      customerName: auth.currentUser?.name ?? 'موظف الحي الحكومي',
      customerPhone: auth.currentUser?.phone ?? '01012345678',
      ministryName: cart.selectedMinistry,
      floor: _floorController.text.trim().isNotEmpty ? _floorController.text.trim() : 'الدور الرابع',
      officeNumber: _officeController.text.trim().isNotEmpty ? _officeController.text.trim() : 'مكتب 402',
      items: cart.items.values
          .map((item) => OrderItem(
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
              ))
          .toList(),
      subtotal: cart.subtotal,
      deliveryFee: cart.deliveryFee,
      discount: cart.discount,
      total: cart.total,
      status: OrderStatus.pendingChef,
      otpCode: '${(1000 + DateTime.now().millisecond * 9) % 9000 + 1000}',
      restaurantName: 'مطبخ العاصمة المركزي',
      createdAt: DateTime.now(),
    );

    // Add to orders provider & sync to Firestore
    orders.addOrderModel(order);
    cart.clear();

    setState(() => _isProcessing = false);

    if (!mounted) return;

    // Navigate to Order Tracking
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => OrderTrackingScreen(orderId: order.id),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cart = Provider.of<CartProvider>(context);

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
        title: Text(
          'إتمام الطلب والدفع الإلكتروني',
          style: GoogleFonts.cairo(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: AppColors.navy,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ─── Ministry Delivery Location ──────────────────────────
            Container(
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
                  Row(
                    children: [
                      const Icon(Icons.location_on_rounded, color: AppColors.primary, size: 22),
                      const SizedBox(width: 8),
                      Text(
                        'مقر التسليم بالحي الحكومي',
                        style: GoogleFonts.cairo(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: AppColors.navy,
                        ),
                      ),
                      const Spacer(),
                      TextButton(
                        onPressed: () => _showMinistryPicker(context, cart),
                        child: Text(
                          'تغيير الوزارة',
                          style: GoogleFonts.cairo(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    ],
                  ),
                  Text(
                    cart.selectedMinistry,
                    style: GoogleFonts.cairo(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.navy,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _floorController,
                          style: GoogleFonts.cairo(fontSize: 12),
                          decoration: InputDecoration(
                            labelText: 'الدور / الطابق',
                            labelStyle: GoogleFonts.cairo(fontSize: 11),
                            isDense: true,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: _officeController,
                          style: GoogleFonts.cairo(fontSize: 12),
                          decoration: InputDecoration(
                            labelText: 'رقم المكتب / الجناح',
                            labelStyle: GoogleFonts.cairo(fontSize: 11),
                            isDense: true,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // ─── Cart Items Summary ──────────────────────────────────
            Container(
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
                  Row(
                    children: [
                      const Icon(Icons.shopping_bag_outlined, color: AppColors.navy, size: 20),
                      const SizedBox(width: 8),
                      Text(
                        'ملخص الأصناف (${cart.itemCount})',
                        style: GoogleFonts.cairo(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: AppColors.navy,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (cart.items.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Text(
                        'لا توجد وجبات في السلة',
                        style: GoogleFonts.cairo(color: AppColors.textMuted),
                      ),
                    )
                  else
                    ...cart.items.values.map((item) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                '${item.quantity}×',
                                style: GoogleFonts.cairo(
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.primary,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                item.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.cairo(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.navy,
                                ),
                              ),
                            ),
                            Text(
                              '${(item.price * item.quantity).toStringAsFixed(0)} ج.م',
                              style: GoogleFonts.cairo(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: AppColors.navy,
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // ─── Promo Code ──────────────────────────────────────────
            Container(
              padding: const EdgeInsets.all(14),
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
              child: Row(
                children: [
                  const Icon(Icons.local_offer_outlined, color: AppColors.primary, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _couponController,
                      style: GoogleFonts.cairo(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: AppColors.navy,
                      ),
                      decoration: InputDecoration(
                        hintText: 'أدخل كود الخصم (CAPITAL100)',
                        hintStyle: GoogleFonts.cairo(fontSize: 12, color: AppColors.textMuted),
                        border: InputBorder.none,
                        isDense: true,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: () {
                      if (_couponController.text.trim().toUpperCase() == 'CAPITAL100') {
                        cart.applyCoupon('CAPITAL100');
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('تم تطبيق خصم 100 جنيه بنجاح! 🎁', style: GoogleFonts.cairo()),
                            backgroundColor: Colors.green,
                          ),
                        );
                      }
                    },
                    child: Text(
                      'تطبيق',
                      style: GoogleFonts.cairo(
                        fontWeight: FontWeight.bold,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // ─── Electronic Payment Methods ──────────────────────────
            Container(
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
                  Text(
                    'طريقة الدفع الإلكتروني',
                    style: GoogleFonts.cairo(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: AppColors.navy,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _buildPaymentOption(
                    id: 'wallet',
                    title: 'محفظة الموظف الذكية (رصيد 100 ج.م)',
                    icon: Icons.account_balance_wallet_rounded,
                    subtitle: 'خصم فوري مباشر من الرصيد الترحيبي',
                  ),
                  _buildPaymentOption(
                    id: 'meeza',
                    title: 'بطاقة ميزة الوطنية (Meeza)',
                    icon: Icons.credit_card_rounded,
                    subtitle: 'دفع إلكتروني معتمد للمصالح الحكومية',
                  ),
                  _buildPaymentOption(
                    id: 'card',
                    title: 'بطاقة بنكية (فيزا / ماستركارد)',
                    icon: Icons.payment_rounded,
                    subtitle: 'دفع إلكتروني آمن ومشفر',
                  ),
                  _buildPaymentOption(
                    id: 'cash',
                    title: 'الدفع نقداً عند الاستلام بمكتبك',
                    icon: Icons.attach_money_rounded,
                    subtitle: 'الدفع المباشر لمندوب التوصيل',
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // ─── Formal Electronic Invoice Breakdown ─────────────────
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'الفاتورة الإلكترونية الرسمية',
                        style: GoogleFonts.cairo(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: AppColors.navy,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.green.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          'معتمدة ضريبياً',
                          style: GoogleFonts.cairo(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: Colors.green,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _buildInvoiceRow('المجموع الفرعي للوجبات', '${cart.subtotal.toStringAsFixed(0)} ج.م'),
                  _buildInvoiceRow('خدمة التوصيل للحي الحكومي', '${cart.deliveryFee.toStringAsFixed(0)} ج.م'),
                  if (cart.discount > 0)
                    _buildInvoiceRow(
                      'خصم قسيمة الموظف (CAPITAL100)',
                      '-${cart.discount.toStringAsFixed(0)} ج.م',
                      color: Colors.green,
                    ),
                  const Divider(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'المبلغ الإجمالي للدفع',
                        style: GoogleFonts.cairo(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: AppColors.navy,
                        ),
                      ),
                      Text(
                        '${cart.total.toStringAsFixed(0)} ج.م',
                        style: GoogleFonts.cairo(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // ─── Confirm & Pay Button ────────────────────────────────
            ElevatedButton(
              onPressed: _isProcessing ? null : _processCheckout,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                minimumSize: const Size.fromHeight(54),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                elevation: 3,
              ),
              child: _isProcessing
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          'تأكيد الطلب والدفع الإلكتروني (${cart.total.toStringAsFixed(0)} ج.م)',
                          style: GoogleFonts.cairo(fontSize: 15, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(width: 8),
                        const Icon(Icons.arrow_forward_rounded, size: 18),
                      ],
                    ),
            ),

            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildPaymentOption({
    required String id,
    required String title,
    required IconData icon,
    required String subtitle,
  }) {
    final isSelected = _selectedPaymentMethod == id;
    return InkWell(
      onTap: () => setState(() => _selectedPaymentMethod = id),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primaryContainer.withValues(alpha: 0.35) : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected ? AppColors.primary : const Color(0xFFE2E8F0),
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(
              isSelected ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
              color: isSelected ? AppColors.primary : AppColors.textMuted,
              size: 20,
            ),
            const SizedBox(width: 12),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: isSelected ? AppColors.primary : AppColors.navy, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.cairo(
                      fontSize: 13,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                      color: AppColors.navy,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: GoogleFonts.cairo(fontSize: 10, color: AppColors.textMuted),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInvoiceRow(String label, String value, {Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: GoogleFonts.cairo(fontSize: 12, color: AppColors.textSecondary)),
          Text(
            value,
            style: GoogleFonts.cairo(
              fontSize: 13,
              fontWeight: FontWeight.bold,
              color: color ?? AppColors.navy,
            ),
          ),
        ],
      ),
    );
  }
}
