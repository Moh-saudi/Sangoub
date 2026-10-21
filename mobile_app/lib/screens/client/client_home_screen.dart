import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/constants/colors.dart';
import '../../models/ministry_model.dart';
import '../../models/order_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/cart_provider.dart';
import '../../providers/orders_provider.dart';
import '../auth/role_select_login_screen.dart';

class ClientHomeScreen extends StatefulWidget {
  const ClientHomeScreen({super.key});

  @override
  State<ClientHomeScreen> createState() => _ClientHomeScreenState();
}

class _ClientHomeScreenState extends State<ClientHomeScreen> {
  String _selectedCategory = 'الكل';

  final List<Map<String, dynamic>> _categories = [
    {'name': 'الكل', 'icon': Icons.grid_view_rounded},
    {'name': 'فطور', 'icon': Icons.bakery_dining_rounded},
    {'name': 'سندوتشات', 'icon': Icons.lunch_dining_rounded},
    {'name': 'مشروبات', 'icon': Icons.local_cafe_rounded},
    {'name': 'سوبر ماركت', 'icon': Icons.shopping_basket_rounded},
  ];

  final List<Map<String, dynamic>> _meals = [
    {
      'id': 'm1',
      'name': 'وجبة فطور ملوكي (كرواسون + أومليت)',
      'category': 'فطور',
      'price': 120.0,
      'restaurant': 'مطبخ العاصمة المركزي',
      'prepTime': '15 دقيقة',
      'rating': 4.9,
      'image': 'assets/images/delivery_pin.png',
    },
    {
      'id': 'm2',
      'name': 'ساندوتش تشيكن جريل شيدر',
      'category': 'سندوتشات',
      'price': 110.0,
      'restaurant': 'ساندوتشات بريميوم العاصمة',
      'prepTime': '20 دقيقة',
      'rating': 4.8,
      'image': 'assets/images/delivery_pin.png',
    },
    {
      'id': 'm3',
      'name': 'كافيه لاتيه إسباني مثلج',
      'category': 'مشروبات',
      'price': 65.0,
      'restaurant': 'كافيه الحي الحكومي',
      'prepTime': '8 دقائق',
      'rating': 4.9,
      'image': 'assets/images/delivery_pin.png',
    },
    {
      'id': 'm4',
      'name': 'سلة فواكه طازجة وسناكس مكتبية',
      'category': 'سوبر ماركت',
      'price': 180.0,
      'restaurant': 'ماركت الحي الحكومي السريع',
      'prepTime': '10 دقائق',
      'rating': 4.7,
      'image': 'assets/images/delivery_pin.png',
    },
    {
      'id': 'm5',
      'name': 'برجر لحم بلدي مع صوص باربيكيو',
      'category': 'سندوتشات',
      'price': 145.0,
      'restaurant': 'جريل هاوس العاصمة',
      'prepTime': '22 دقيقة',
      'rating': 4.9,
      'image': 'assets/images/delivery_pin.png',
    },
  ];

  void _showMinistryPickerModal(BuildContext context, CartProvider cart) {
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
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'اختر الوزارة / مقر العمل بالحي الحكومي',
                style: GoogleFonts.cairo(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: AppColors.navy,
                ),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: ListView.separated(
                  itemCount: MinistryModel.governmentDistrictMinistries.length,
                  separatorBuilder: (context, index) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final ministry = MinistryModel.governmentDistrictMinistries[index];
                    final isSelected = cart.selectedMinistry == ministry.nameArabic;
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: CircleAvatar(
                        backgroundColor: isSelected ? AppColors.primary : AppColors.surfaceMuted,
                        child: Icon(
                          Icons.account_balance_rounded,
                          color: isSelected ? Colors.white : AppColors.navy,
                          size: 20,
                        ),
                      ),
                      title: Text(
                        ministry.nameArabic,
                        style: GoogleFonts.cairo(
                          fontSize: 14,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                          color: isSelected ? AppColors.primary : AppColors.navy,
                        ),
                      ),
                      subtitle: Text(
                        '${ministry.buildingNumber} • ${ministry.sector}',
                        style: GoogleFonts.cairo(fontSize: 12, color: AppColors.textSecondary),
                      ),
                      trailing: isSelected
                          ? const Icon(Icons.check_circle_rounded, color: AppColors.primary)
                          : null,
                      onTap: () {
                        cart.setDeliveryLocation(
                          ministry: ministry.nameArabic,
                          building: ministry.buildingNumber,
                          floor: cart.floor,
                          office: cart.office,
                        );
                        Navigator.pop(ctx);
                      },
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

  void _showCartSheet(BuildContext context, CartProvider cart, OrdersProvider orders, AuthProvider auth) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              height: MediaQuery.of(context).size.height * 0.75,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 48,
                      height: 4,
                      decoration: BoxDecoration(
                        color: AppColors.border,
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'سلة طلباتك 🛒',
                        style: GoogleFonts.cairo(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: AppColors.navy,
                        ),
                      ),
                      TextButton(
                        onPressed: () {
                          cart.clearCart();
                          Navigator.pop(ctx);
                        },
                        child: Text(
                          'تفريغ السلة',
                          style: GoogleFonts.cairo(color: Colors.red, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // Delivery Address Card
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.primaryContainer.withValues(alpha: 0.5),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.location_on_rounded, color: AppColors.primary),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                cart.selectedMinistry,
                                style: GoogleFonts.cairo(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.navy,
                                ),
                              ),
                              Text(
                                '${cart.building} • ${cart.floor} • ${cart.office}',
                                style: GoogleFonts.cairo(fontSize: 11, color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 12),

                  // Cart Items List
                  Expanded(
                    child: cart.items.isEmpty
                        ? Center(
                            child: Text(
                              'السلة فارغة حالياً',
                              style: GoogleFonts.cairo(color: AppColors.textMuted),
                            ),
                          )
                        : ListView.separated(
                            itemCount: cart.items.values.length,
                            separatorBuilder: (context, index) => const Divider(height: 1),
                            itemBuilder: (context, index) {
                              final item = cart.items.values.toList()[index];
                              return Padding(
                                padding: const EdgeInsets.symmetric(vertical: 8),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            item.name,
                                            style: GoogleFonts.cairo(
                                              fontSize: 13,
                                              fontWeight: FontWeight.bold,
                                              color: AppColors.navy,
                                            ),
                                          ),
                                          Text(
                                            '${item.price.toStringAsFixed(0)} ج.م',
                                            style: GoogleFonts.cairo(
                                              fontSize: 12,
                                              color: AppColors.primary,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Row(
                                      children: [
                                        IconButton(
                                          icon: const Icon(Icons.remove_circle_outline, color: AppColors.navy, size: 20),
                                          onPressed: () {
                                            cart.removeSingleItem(item.id);
                                            setSheetState(() {});
                                          },
                                        ),
                                        Text(
                                          '${item.quantity}',
                                          style: GoogleFonts.cairo(fontWeight: FontWeight.bold, fontSize: 14),
                                        ),
                                        IconButton(
                                          icon: const Icon(Icons.add_circle, color: AppColors.primary, size: 20),
                                          onPressed: () {
                                            cart.addItem(id: item.id, name: item.name, price: item.price);
                                            setSheetState(() {});
                                          },
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                  ),

                  // Coupon Banner
                  Container(
                    margin: const EdgeInsets.symmetric(vertical: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppColors.accentGold.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.confirmation_number_outlined, color: AppColors.navy, size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            cart.appliedDiscount > 0
                                ? 'تم تفعيل خصم ${cart.appliedDiscount.toStringAsFixed(0)} ج.م 🎉'
                                : 'قسيمة 100 ج.م متاحة (كود: CAPITAL100)',
                            style: GoogleFonts.cairo(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.navy),
                          ),
                        ),
                        if (cart.appliedDiscount == 0)
                          TextButton(
                            onPressed: () {
                              cart.applyCoupon('CAPITAL100');
                              setSheetState(() {});
                            },
                            child: Text(
                              'تطبيق',
                              style: GoogleFonts.cairo(
                                color: AppColors.primary,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),

                  // Summary breakdown
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('إجمالي الوجبات:', style: GoogleFonts.cairo(fontSize: 13, color: AppColors.textSecondary)),
                      Text('${cart.subtotal.toStringAsFixed(0)} ج.م', style: GoogleFonts.cairo(fontSize: 13, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('رسوم التوصيل لمكتب الوزارة:', style: GoogleFonts.cairo(fontSize: 13, color: AppColors.textSecondary)),
                      Text('${cart.deliveryFee.toStringAsFixed(0)} ج.م', style: GoogleFonts.cairo(fontSize: 13, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  if (cart.appliedDiscount > 0)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('الخصم:', style: GoogleFonts.cairo(fontSize: 13, color: Colors.green)),
                        Text('-${cart.appliedDiscount.toStringAsFixed(0)} ج.م', style: GoogleFonts.cairo(fontSize: 13, color: Colors.green, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  const Divider(),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('المبلغ النهائي المطلوب:', style: GoogleFonts.cairo(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.navy)),
                      Text('${cart.total.toStringAsFixed(0)} ج.م', style: GoogleFonts.cairo(fontSize: 18, fontWeight: FontWeight.w900, color: AppColors.primary)),
                    ],
                  ),
                  const SizedBox(height: 14),

                  // Submit Order Button
                  ElevatedButton(
                    onPressed: cart.items.isEmpty
                        ? null
                        : () {
                            orders.addOrder(
                              customerName: auth.currentUser?.name ?? 'موظف العاصمة',
                              customerPhone: auth.currentUser?.phone ?? '01012345678',
                              ministryName: cart.selectedMinistry,
                              buildingNumber: cart.building,
                              floor: cart.floor,
                              officeNumber: cart.office,
                              restaurantName: 'مطبخ العاصمة المركزي',
                              items: cart.items.values.toList(),
                              subtotal: cart.subtotal,
                              deliveryFee: cart.deliveryFee,
                              discount: cart.appliedDiscount,
                              total: cart.total,
                            );
                            cart.clearCart();
                            Navigator.pop(ctx);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                backgroundColor: AppColors.statusDelivered,
                                content: Text(
                                  'تم إرسال طلبك لشيف المطعم بنجاح! 🚀 تم إنشاء رمز الاستلام OTP',
                                  style: GoogleFonts.cairo(fontWeight: FontWeight.bold),
                                ),
                              ),
                            );
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    child: Text(
                      'تأكيد الطلب وإرساله للمطبخ',
                      style: GoogleFonts.cairo(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final cart = Provider.of<CartProvider>(context);
    final orders = Provider.of<OrdersProvider>(context);
    final auth = Provider.of<AuthProvider>(context);

    final filteredMeals = _selectedCategory == 'الكل'
        ? _meals
        : _meals.where((m) => m['category'] == _selectedCategory).toList();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: InkWell(
          onTap: () => _showMinistryPickerModal(context, cart),
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.location_on, color: AppColors.primary, size: 20),
                const SizedBox(width: 6),
                Flexible(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'موقع التوصيل بالحي الحكومي',
                        style: GoogleFonts.cairo(fontSize: 10, color: AppColors.textSecondary),
                      ),
                      Text(
                        cart.selectedMinistry,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.cairo(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: AppColors.navy,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.keyboard_arrow_down_rounded, color: AppColors.navy, size: 20),
              ],
            ),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.switch_account_outlined, color: AppColors.navy),
            tooltip: 'تغيير الحساب / الدور',
            onPressed: () {
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(builder: (_) => const RoleSelectLoginScreen()),
              );
            },
          ),
        ],
      ),
      body: Stack(
        children: [
          SingleChildScrollView(
            padding: const EdgeInsets.only(bottom: 90),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Banner for Government Employees (Matching Onboarding 4 Voucher)
                Container(
                  margin: const EdgeInsets.all(16),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.navy, Color(0xFF2C3E5D)],
                      begin: Alignment.topRight,
                      end: Alignment.bottomLeft,
                    ),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.navy.withValues(alpha: 0.2),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppColors.accentGold,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                'عروض حصرية لموظفي الحكومة',
                                style: GoogleFonts.cairo(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.navyDark,
                                ),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'قسيمة شراء 100 جنيه 🎁',
                              style: GoogleFonts.cairo(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                            Text(
                              'كود الخصم: CAPITAL100 عند تأكيد السلة',
                              style: GoogleFonts.cairo(
                                fontSize: 12,
                                color: Colors.white.withValues(alpha: 0.8),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Icon(Icons.local_offer_rounded, color: Colors.white, size: 32),
                      ),
                    ],
                  ),
                ),

                // Active orders live tracker card (if any order is active)
                if (orders.clientActiveOrders.isNotEmpty) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(
                      'طلباتك الجارية في العاصمة 🛵',
                      style: GoogleFonts.cairo(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: AppColors.navy,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    height: 120,
                    child: ListView.builder(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: orders.clientActiveOrders.length,
                      itemBuilder: (context, index) {
                        final order = orders.clientActiveOrders[index];
                        return Container(
                          width: 290,
                          margin: const EdgeInsets.only(left: 12),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: order.status.color.withValues(alpha: 0.3)),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.04),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    order.id,
                                    style: GoogleFonts.cairo(
                                      fontWeight: FontWeight.bold,
                                      color: AppColors.navy,
                                      fontSize: 13,
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: order.status.color.withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Row(
                                      children: [
                                        Icon(order.status.icon, size: 12, color: order.status.color),
                                        const SizedBox(width: 4),
                                        Text(
                                          order.status.arabicLabel,
                                          style: GoogleFonts.cairo(
                                            fontSize: 10,
                                            fontWeight: FontWeight.bold,
                                            color: order.status.color,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              Text(
                                '${order.items.length} وجبات • ${order.total.toStringAsFixed(0)} ج.م',
                                style: GoogleFonts.cairo(fontSize: 11, color: AppColors.textSecondary),
                              ),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    'رمز الاستلام (OTP):',
                                    style: GoogleFonts.cairo(fontSize: 11, color: AppColors.textSecondary),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppColors.primaryContainer,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      order.otpCode,
                                      style: GoogleFonts.cairo(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w900,
                                        color: AppColors.primaryDark,
                                        letterSpacing: 2,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // Categories Row
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    'التصنيفات المتاحة',
                    style: GoogleFonts.cairo(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: AppColors.navy,
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  height: 44,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: _categories.length,
                    itemBuilder: (context, index) {
                      final cat = _categories[index];
                      final isSelected = _selectedCategory == cat['name'];
                      return Padding(
                        padding: const EdgeInsets.only(left: 8),
                        child: FilterChip(
                          selected: isSelected,
                          showCheckmark: false,
                          avatar: Icon(
                            cat['icon'] as IconData,
                            size: 16,
                            color: isSelected ? Colors.white : AppColors.navy,
                          ),
                          label: Text(
                            cat['name'] as String,
                            style: GoogleFonts.cairo(
                              fontSize: 13,
                              fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                              color: isSelected ? Colors.white : AppColors.navy,
                            ),
                          ),
                          selectedColor: AppColors.primary,
                          backgroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                            side: BorderSide(
                              color: isSelected ? AppColors.primary : AppColors.border,
                            ),
                          ),
                          onSelected: (_) {
                            setState(() {
                              _selectedCategory = cat['name'] as String;
                            });
                          },
                        ),
                      );
                    },
                  ),
                ),

                const SizedBox(height: 18),

                // Meals Grid / List
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    'قائمة الوجبات والمشروبات',
                    style: GoogleFonts.cairo(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: AppColors.navy,
                    ),
                  ),
                ),
                const SizedBox(height: 8),

                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: filteredMeals.length,
                  itemBuilder: (context, index) {
                    final meal = filteredMeals[index];
                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(12),
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
                          Container(
                            width: 72,
                            height: 72,
                            decoration: BoxDecoration(
                              color: AppColors.surfaceMuted,
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: const Icon(
                              Icons.restaurant_menu_rounded,
                              color: AppColors.primary,
                              size: 32,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  meal['name'],
                                  style: GoogleFonts.cairo(
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.navy,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${meal['restaurant']} • ⏱️ ${meal['prepTime']}',
                                  style: GoogleFonts.cairo(
                                    fontSize: 11,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  '${meal['price']} ج.م',
                                  style: GoogleFonts.cairo(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w900,
                                    color: AppColors.primary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          ElevatedButton(
                            onPressed: () {
                              cart.addItem(
                                id: meal['id'],
                                name: meal['name'],
                                price: meal['price'],
                              );
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  duration: const Duration(seconds: 1),
                                  backgroundColor: AppColors.navy,
                                  content: Text(
                                    'تمت الإضافة للسلة 🛒',
                                    style: GoogleFonts.cairo(fontSize: 12),
                                  ),
                                ),
                              );
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              minimumSize: Size.zero,
                            ),
                            child: const Icon(Icons.add, size: 20),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ],
            ),
          ),

          // Floating Cart Bar (Bottom)
          if (cart.itemCount > 0)
            Positioned(
              bottom: 16,
              left: 16,
              right: 16,
              child: InkWell(
                onTap: () => _showCartSheet(context, cart, orders, auth),
                borderRadius: BorderRadius.circular(18),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withValues(alpha: 0.35),
                        blurRadius: 18,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          '${cart.itemCount}',
                          style: GoogleFonts.cairo(
                            fontSize: 14,
                            fontWeight: FontWeight.w900,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        'عرض السلة وإتمام الطلب',
                        style: GoogleFonts.cairo(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        '${cart.total.toStringAsFixed(0)} ج.م',
                        style: GoogleFonts.cairo(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white, size: 14),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
