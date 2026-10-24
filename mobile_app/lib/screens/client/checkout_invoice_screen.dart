import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants/colors.dart';
import '../../core/services/api_service.dart';
import '../../models/ministry_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/cart_provider.dart';
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

    if (auth.firebaseUser == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'يرجى تسجيل الدخول أولاً لإتمام الطلب',
            style: GoogleFonts.cairo(),
          ),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    setState(() => _isProcessing = true);

    try {
      final orderId = 'ord-${const Uuid().v4()}';
      final profileName = (auth.currentUser?.name.isNotEmpty == true)
          ? auth.currentUser!.name
          : (auth.firebaseUser?.displayName?.isNotEmpty == true
              ? auth.firebaseUser!.displayName!
              : 'موظف العاصمة');

      final phone = (auth.currentUser?.phone.isNotEmpty == true)
          ? auth.currentUser!.phone
          : '01012345678';

      final ministry = cart.selectedMinistry.isNotEmpty
          ? cart.selectedMinistry
          : (auth.currentUser?.ministry.isNotEmpty == true
              ? auth.currentUser!.ministry
              : 'الحي الحكومي بالعاصمة الإدارية');

      final floor = _floorController.text.trim().isNotEmpty
          ? _floorController.text.trim()
          : (auth.currentUser?.floorNumber.isNotEmpty == true
              ? auth.currentUser!.floorNumber
              : 'الدور الرابع');

      final office = _officeController.text.trim().isNotEmpty
          ? _officeController.text.trim()
          : (auth.currentUser?.roomNumber.isNotEmpty == true
              ? auth.currentUser!.roomNumber
              : 'مكتب 402');

      final notes = _notesController.text.trim();

      // إنشاء الطلب رسمياً عبر الـ Backend API POST /api/orders
      final res = await ApiService().createOrder(
        id: orderId,
        profileName: profileName,
        phone: phone,
        ministry: ministry,
        floorNumber: floor,
        roomNumber: office,
        items: cart.toApiItems(),
        paymentMethod: _selectedPaymentMethod,
        couponCode: cart.couponCode,
        notes: notes.isNotEmpty ? notes : null,
      );

      final createdDocId = (res['order']?['id'] as String?) ?? orderId;
      final redirectUrl = res['redirectUrl'] as String?;

      cart.clearCart();

      // فتح بوابة جيديا إذا كان الدفع إلكترونياً
      if (res['requiresPaymentRedirect'] == true && redirectUrl != null && redirectUrl.isNotEmpty) {
        try {
          final uri = Uri.parse(redirectUrl);
          if (await canLaunchUrl(uri)) {
            await launchUrl(uri, mode: LaunchMode.externalApplication);
          }
        } catch (launchErr) {
          debugPrint('Error launching Geidea gateway: $launchErr');
        }
      }

      if (!mounted) return;
      setState(() => _isProcessing = false);

      // الانتقال فوراً لشاشة التتبع الحي للطلب
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => OrderTrackingScreen(orderId: createdDocId),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isProcessing = false);

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.toString().replaceAll('Exception: ', ''),
            style: GoogleFonts.cairo(),
          ),
          backgroundColor: Colors.redAccent,
          duration: const Duration(seconds: 4),
        ),
      );
    }
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
                    onPressed: () async {
                      final code = _couponController.text.trim();
                      if (code.isEmpty) return;
                      final success = await cart.applyCoupon(code);
                      if (!context.mounted) return;
                      if (success) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              'تم تطبيق كود الخصم ($code) بنجاح! 🎁',
                              style: GoogleFonts.cairo(),
                            ),
                            backgroundColor: Colors.green,
                          ),
                        );
                      } else {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              'كود الخصم غير صالح أو لم يصل للحد الأدنى للطلب',
                              style: GoogleFonts.cairo(),
                            ),
                            backgroundColor: Colors.redAccent,
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
                    id: 'instapay',
                    title: 'انستاباي (InstaPay) - الدفع اللحظي',
                    assetIcon: 'assets/icons/payment/instapay.png',
                    subtitle: 'تحويل بنكي فوري معتمد من البنك المركزي المصري',
                    badge: 'فوري ⚡',
                  ),
                  _buildPaymentOption(
                    id: 'vodafone_cash',
                    title: 'فودافون كاش ومحافظ المحمول',
                    assetIcon: 'assets/icons/payment/vodafone cach.png',
                    subtitle: 'أورنج كاش، وي باي، إتصالات، وفودافون كاش',
                    badge: 'محافظ ذكية 📱',
                  ),
                  _buildPaymentOption(
                    id: 'geidea',
                    title: 'بطاقة بنكية / Apple Pay (بوابة جيديا Geidea)',
                    assetIcon: 'assets/icons/payment/visa--logo.png',
                    subtitle: 'دفع فوري وآمن 100% عبر بوابة جيديا الرسمية (مدى / فيزا / ماستركارد / Apple Pay)',
                    badge: 'جيديا 💳',
                  ),
                  _buildPaymentOption(
                    id: 'wallet',
                    title: 'محفظة الموظف الذكية (رصيد الحساب)',
                    icon: Icons.account_balance_wallet_rounded,
                    subtitle: 'خصم فوري مباشر من الرصيد الترحيبي (100 ج.م)',
                    badge: 'رصيد متاح',
                  ),
                  _buildPaymentOption(
                    id: 'cash',
                    title: 'الدفع نقداً عند الاستلام بمكتبك',
                    icon: Icons.payments_rounded,
                    subtitle: 'الدفع المباشر لمندوب التوصيل بعد استلام الوجبة',
                    badge: 'كاش 💵',
                  ),
                  if (_selectedPaymentMethod != 'cash' && _selectedPaymentMethod != 'wallet')
                    Container(
                      margin: const EdgeInsets.only(top: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDF4),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFBBF7D0)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.verified_user_rounded, color: Color(0xFF16A34A), size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'بوابة الدفع الإلكتروني جاهزة ومؤمنة، سيتم تسجيل العملية رسميًا في الفاتورة الضريبية.',
                              style: GoogleFonts.cairo(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: const Color(0xFF166534),
                              ),
                            ),
                          ),
                        ],
                      ),
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
                  _buildInvoiceRow(
                    'خدمة التوصيل (${cart.deliveryZoneName} - ${cart.deliveryDistanceLabel})',
                    '${cart.deliveryFee.toStringAsFixed(0)} ج.م',
                  ),
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
    IconData? icon,
    String? assetIcon,
    required String subtitle,
    String? badge,
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
              width: 44,
              height: 44,
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: assetIcon != null
                  ? Image.asset(
                      assetIcon,
                      fit: BoxFit.contain,
                      errorBuilder: (context, error, stackTrace) => Icon(
                        Icons.credit_card_rounded,
                        color: isSelected ? AppColors.primary : AppColors.navy,
                        size: 20,
                      ),
                    )
                  : Icon(icon ?? Icons.payment, color: isSelected ? AppColors.primary : AppColors.navy, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          style: GoogleFonts.cairo(
                            fontSize: 13,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                            color: AppColors.navy,
                          ),
                        ),
                      ),
                      if (badge != null)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: isSelected ? AppColors.primary.withValues(alpha: 0.15) : const Color(0xFFE2E8F0),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            badge,
                            style: GoogleFonts.cairo(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: isSelected ? AppColors.primaryDark : AppColors.textSecondary,
                            ),
                          ),
                        ),
                    ],
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
