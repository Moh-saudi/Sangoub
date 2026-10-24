import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';
import '../../core/constants/colors.dart';
import '../../models/ministry_model.dart';
import '../../models/order_model.dart';
import '../../models/product_model.dart';
import '../../providers/app_config_provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/cart_provider.dart';
import '../../providers/catalog_provider.dart';
import '../../providers/orders_provider.dart';
import '../../widgets/app_image.dart';
import '../../widgets/map_address_picker.dart';
import 'checkout_invoice_screen.dart';
import 'offers_screen.dart';
import 'order_tracking_screen.dart';
import 'product_details_screen.dart';
import 'user_profile_screen.dart';

class ClientHomeScreen extends StatefulWidget {
  const ClientHomeScreen({super.key});

  @override
  State<ClientHomeScreen> createState() => _ClientHomeScreenState();
}

class _ClientHomeScreenState extends State<ClientHomeScreen> {
  int _currentBottomNavIndex = 0;
  String _selectedCategory = 'الكل';
  final PageController _offersPageController = PageController();
  int _currentOfferIndex = 0;
  Timer? _offersTimer;
  final TextEditingController _searchController = TextEditingController();
  int _ordersFilterIndex = 0; // 0: All, 1: Active, 2: Delivered & Paid

  // ─── 1. عروض حصرية (سلايدر العروض الترويجية) ─────────────────────
  final List<Map<String, dynamic>> _offersBanners = [
    {
      'image': 'assets/images/slide_1.png',
      'title': 'قسيمة شراء 100 جنيه 🎁',
      'subtitle': 'كود: CAPITAL100 لجميع موظفي الـ 34 وزارة',
      'tag': 'عرض ترحيبي حصري',
      'gradient': const [Color(0xFFFF5A00), Color(0xFFFF8A00)],
      'icon': Icons.card_giftcard_rounded,
    },
    {
      'image': 'assets/images/slide_2.png',
      'title': 'خصم 40% على الفود كورت 🍔',
      'subtitle': 'على جميع وجبات الغداء بين 12 ظهراً و 4 عصراً',
      'tag': 'وجبات الغداء الحكومية',
      'gradient': const [Color(0xFF1B2538), Color(0xFF2C3E5D)],
      'icon': Icons.lunch_dining_rounded,
    },
    {
      'image': 'assets/images/slide_3.png',
      'title': 'توصيل مجاني فوري 🛵',
      'subtitle': 'توصيل سريع لكافة مكاتب وأجنحة الوزارات',
      'tag': 'خدمة سريعة VIP',
      'gradient': const [Color(0xFF0F766E), Color(0xFF14B8A6)],
      'icon': Icons.electric_moped_rounded,
    },
    {
      'image': 'assets/images/slide_4.png',
      'title': 'قهوة الصباح وفطور طازج ☕',
      'subtitle': 'خصم 25% مع كل طلب إفطار قبل الساعة 10 صباحاً',
      'tag': 'إفطار الموظف الذكي',
      'gradient': const [Color(0xFF7C2D12), Color(0xFFB45309)],
      'icon': Icons.local_cafe_rounded,
    },
  ];

  // ─── 2. التصنيفات ────────────────────────────────────────────────
  final List<Map<String, dynamic>> _categories = [
    {'name': 'الكل', 'icon': Icons.grid_view_rounded},
    {'name': 'فطور', 'icon': Icons.bakery_dining_rounded},
    {'name': 'برجر', 'icon': Icons.fastfood_rounded},
    {'name': 'سندوتشات', 'icon': Icons.lunch_dining_rounded},
    {'name': 'شاورما', 'icon': Icons.kebab_dining_rounded},
    {'name': 'مشروبات', 'icon': Icons.local_cafe_rounded},
    {'name': 'سوبر ماركت', 'icon': Icons.shopping_basket_rounded},
    {'name': 'حلويات', 'icon': Icons.cake_rounded},
  ];

  @override
  void initState() {
    super.initState();
    // Auto slide the offers banner every 4 seconds
    _offersTimer = Timer.periodic(const Duration(seconds: 4), (timer) {
      if (_offersPageController.hasClients) {
        int nextPage = (_currentOfferIndex + 1) % _offersBanners.length;
        _offersPageController.animateToPage(
          nextPage,
          duration: const Duration(milliseconds: 400),
          curve: Curves.easeInOut,
        );
      }
    });
  }

  @override
  void dispose() {
    _offersTimer?.cancel();
    _offersPageController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _handleAutoLocationDetection(BuildContext context, CartProvider cart) async {
    final result = await Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute(
        builder: (_) => MapAddressPickerScreen(
          initialTitle: cart.selectedMinistry,
        ),
      ),
    );
    if (result != null && mounted) {
      final details = (result['details'] as String?) ?? (result['address'] as String?);
      final district = (result['district'] as String?)?.trim() ?? '';
      final city = (result['city'] as String?)?.trim() ?? '';
      final title = (result['title'] as String?)?.trim() ?? '';

      String chosenLocation = '';
      if (details != null && details.isNotEmpty && details != 'الموقع المحدد على الخريطة') {
        chosenLocation = details;
      } else if (district.isNotEmpty) {
        chosenLocation = city.isNotEmpty ? '$district، $city' : district;
      } else if (city.isNotEmpty) {
        chosenLocation = city;
      } else if (title.isNotEmpty && title != 'عنواني' && title != 'المنزل') {
        chosenLocation = title;
      } else {
        chosenLocation = 'موقعي على الخريطة';
      }

      cart.setMinistry(chosenLocation);
    }
  }

  Widget _buildUserAvatar(AuthProvider auth) {
    // 1. صورة مخصصة قام المستخدم برفعها / 2. صورة حساب Google التي سجل بها
    final customAvatar = auth.currentUser?.avatarUrl?.trim();
    final googleAvatar = auth.firebaseUser?.photoURL?.trim();
    final photoUrl = (customAvatar != null && customAvatar.isNotEmpty)
        ? customAvatar
        : ((googleAvatar != null && googleAvatar.isNotEmpty) ? googleAvatar : null);
    final hasPhoto = photoUrl != null;

    return InkWell(
      onTap: () => setState(() => _currentBottomNavIndex = 3),
      borderRadius: BorderRadius.circular(22),
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                colors: [AppColors.primary, Color(0xFFFF8A00)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.25),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: ClipOval(
              child: hasPhoto
                  ? Image.network(
                      photoUrl,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => _buildAvatarInitials(auth),
                    )
                  : _buildAvatarInitials(auth),
            ),
          ),
          Positioned(
            bottom: 0,
            right: 0,
            child: Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                color: const Color(0xFF22C55E),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAvatarInitials(AuthProvider auth) {
    final name = (auth.currentUser?.name.isNotEmpty == true)
        ? auth.currentUser!.name
        : (auth.firebaseUser?.displayName?.isNotEmpty == true
            ? auth.firebaseUser!.displayName!
            : 'موظف العاصمة');
    final parts = name.trim().split(' ').where((p) => p.isNotEmpty).toList();
    String initials = 'م';
    if (parts.length >= 2) {
      initials = '${parts[0][0]}${parts[1][0]}';
    } else if (parts.isNotEmpty && parts[0].isNotEmpty) {
      initials = parts[0].substring(0, parts[0].length >= 2 ? 2 : 1);
    }
    return Center(
      child: Text(
        initials,
        style: GoogleFonts.cairo(
          fontSize: 13,
          fontWeight: FontWeight.bold,
          color: Colors.white,
        ),
      ),
    );
  }

  void _openProductDetails(ProductModel product) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ProductDetailsScreen(product: product),
      ),
    );
  }

  void _openCheckout() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => const CheckoutInvoiceScreen(),
      ),
    );
  }

  void _showAllPopularMealsSheet(
    BuildContext context,
    List<ProductModel> meals,
    String sectionTitle,
  ) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      enableDrag: true,
      isDismissible: true,
      useSafeArea: true,
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.75,
          minChildSize: 0.25,
          maxChildSize: 0.95,
          expand: false,
          snap: true,
          snapSizes: const [0.5, 0.75, 0.95],
          shouldCloseOnMinExtent: true,
          builder: (context, scrollController) {
            return Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                children: [
                  // مقبض السحب لأسفل مع التعرف على سحب الإصبع للإغلاق
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onVerticalDragUpdate: (details) {
                      if (details.primaryDelta != null && details.primaryDelta! > 10) {
                        Navigator.of(ctx).pop();
                      }
                    },
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      color: Colors.transparent,
                      child: Center(
                        child: Container(
                          width: 48,
                          height: 5,
                          decoration: BoxDecoration(
                            color: const Color(0xFFCBD5E1),
                            borderRadius: BorderRadius.circular(3),
                          ),
                        ),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 30, color: AppColors.navy),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                              tooltip: 'إغلاق القائمة',
                              onPressed: () => Navigator.of(ctx).pop(),
                            ),
                            const SizedBox(width: 8),
                            const Text('🔥 ', style: TextStyle(fontSize: 18)),
                            Text(
                              sectionTitle,
                              style: GoogleFonts.cairo(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: AppColors.navy,
                              ),
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            '${meals.length} صنف',
                            style: GoogleFonts.cairo(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Divider(height: 1),
                  Expanded(
                    child: ListView.separated(
                      controller: scrollController,
                      padding: const EdgeInsets.all(16),
                      itemCount: meals.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        final meal = meals[index];
                        return InkWell(
                          onTap: () {
                            Navigator.of(ctx).pop();
                            _openProductDetails(meal);
                          },
                          borderRadius: BorderRadius.circular(16),
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: Row(
                              children: [
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(12),
                                  child: (meal.effectiveImageUrl ?? meal.imageUrl)?.isNotEmpty == true
                                      ? Image.network(
                                          (meal.effectiveImageUrl ?? meal.imageUrl)!,
                                          width: 72,
                                          height: 72,
                                          fit: BoxFit.cover,
                                          errorBuilder: (_, __, ___) => Container(
                                            width: 72,
                                            height: 72,
                                            color: const Color(0xFFE2E8F0),
                                            child: const Icon(Icons.fastfood_rounded, color: AppColors.textMuted),
                                          ),
                                        )
                                      : Container(
                                          width: 72,
                                          height: 72,
                                          color: const Color(0xFFE2E8F0),
                                          child: const Icon(Icons.fastfood_rounded, color: AppColors.textMuted),
                                        ),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        meal.name,
                                        style: GoogleFonts.cairo(
                                          fontSize: 14,
                                          fontWeight: FontWeight.bold,
                                          color: AppColors.navy,
                                        ),
                                      ),
                                      Text(
                                        meal.storeName,
                                        style: GoogleFonts.cairo(
                                          fontSize: 11,
                                          color: AppColors.textMuted,
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Text(
                                            '${meal.price.toStringAsFixed(0)} ج.م',
                                            style: GoogleFonts.cairo(
                                              fontSize: 15,
                                              fontWeight: FontWeight.w900,
                                              color: AppColors.primary,
                                            ),
                                          ),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                            decoration: BoxDecoration(
                                              color: AppColors.primary,
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: Text(
                                              'عرض التفاصيل',
                                              style: GoogleFonts.cairo(
                                                fontSize: 11,
                                                fontWeight: FontWeight.bold,
                                                color: Colors.white,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
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
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final cart = Provider.of<CartProvider>(context);
    final orders = Provider.of<OrdersProvider>(context);
    final catalog = Provider.of<CatalogProvider>(context);
    final auth = Provider.of<AuthProvider>(context);
    final appConfig = Provider.of<AppConfigProvider>(context);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      // ─── Header AppBar ─────────────────────────────────────────────
      appBar: (_currentBottomNavIndex == 2 || _currentBottomNavIndex == 3)
          ? null
          : AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        leading: Padding(
          padding: const EdgeInsetsDirectional.only(start: 12),
          child: _buildUserAvatar(auth),
        ),
        title: InkWell(
          onTap: () => _handleAutoLocationDetection(context, cart),
          borderRadius: BorderRadius.circular(20),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            constraints: const BoxConstraints(maxWidth: 215),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 20,
                  height: 20,
                  decoration: const BoxDecoration(
                    color: AppColors.primaryContainer,
                    shape: BoxShape.circle,
                  ),
                  child: const Center(
                    child: Icon(Icons.near_me_rounded, color: AppColors.primary, size: 12),
                  ),
                ),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    cart.selectedMinistry,
                    overflow: TextOverflow.ellipsis,
                    maxLines: 1,
                    style: GoogleFonts.cairo(
                      fontSize: 11.5,
                      fontWeight: FontWeight.bold,
                      color: AppColors.navy,
                    ),
                  ),
                ),
                const SizedBox(width: 3),
                const Icon(Icons.keyboard_arrow_down_rounded, color: AppColors.primary, size: 16),
              ],
            ),
          ),
        ),
        actions: [
          Stack(
            alignment: Alignment.center,
            children: [
              Container(
                margin: const EdgeInsetsDirectional.only(end: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: IconButton(
                  icon: const Icon(Icons.shopping_bag_outlined, color: AppColors.navy, size: 20),
                  onPressed: _openCheckout,
                ),
              ),
              if (cart.itemCount > 0)
                Positioned(
                  top: 6,
                  right: 14,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                    child: Text(
                      '${cart.itemCount}',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.cairo(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),

      // ─── Body Switcher by Bottom Navigation Bar ────────────────────
      body: IndexedStack(
        index: _currentBottomNavIndex,
        children: [
          // Tab 0: Home Page (مع كافة السلايدرز والمطاعم)
          _buildHomeTab(context, cart, orders, catalog, appConfig),

          // Tab 1: Orders & Live Tracking
          _buildOrdersTab(context, orders, cart),

          // Tab 2: Checkout & Invoicing
          const CheckoutInvoiceScreen(),

          // Tab 3: User Profile
          const UserProfileScreen(),
        ],
      ),

      // ─── Floating Cart Bar (if on Home tab and cart has items) ─────
      bottomSheet: (_currentBottomNavIndex == 0 && cart.itemCount > 0)
          ? Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.08),
                    blurRadius: 18,
                    offset: const Offset(0, -4),
                  ),
                ],
              ),
              child: SafeArea(
                child: InkWell(
                  onTap: _openCheckout,
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.3),
                          blurRadius: 14,
                          offset: const Offset(0, 4),
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
                          'عرض السلة وإتمام الدفع',
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
            )
          : null,

      // ─── Modern Talabat Bottom Navigation Bar ──────────────────────
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 20,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _currentBottomNavIndex,
          onTap: (index) => setState(() => _currentBottomNavIndex = index),
          type: BottomNavigationBarType.fixed,
          backgroundColor: Colors.white,
          selectedItemColor: AppColors.primary,
          unselectedItemColor: const Color(0xFF94A3B8),
          selectedLabelStyle: GoogleFonts.cairo(fontSize: 11, fontWeight: FontWeight.bold),
          unselectedLabelStyle: GoogleFonts.cairo(fontSize: 11, fontWeight: FontWeight.w600),
          items: [
            const BottomNavigationBarItem(
              icon: Icon(Icons.home_filled),
              activeIcon: Icon(Icons.home_filled),
              label: 'الرئيسية',
            ),
            BottomNavigationBarItem(
              icon: Badge(
                isLabelVisible: orders.clientActiveOrders.isNotEmpty,
                label: Text('${orders.clientActiveOrders.length}'),
                backgroundColor: AppColors.primary,
                child: const Icon(Icons.receipt_long_rounded),
              ),
              label: 'طلباتي',
            ),
            BottomNavigationBarItem(
              icon: Badge(
                isLabelVisible: cart.itemCount > 0,
                label: Text('${cart.itemCount}'),
                backgroundColor: AppColors.primary,
                child: const Icon(Icons.shopping_bag_rounded),
              ),
              label: 'السلة',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.person_rounded),
              label: 'حسابي',
            ),
          ],
        ),
      ),
    );
  }

  // ═════════════════════════════════════════════════════════════════════
  // TAB 0: HOME PAGE (السلايدرز والتصنيفات والمطاعم)
  // ═════════════════════════════════════════════════════════════════════
  Widget _buildHomeTab(
    BuildContext context,
    CartProvider cart,
    OrdersProvider orders,
    CatalogProvider catalog,
    AppConfigProvider appConfig,
  ) {
    final products = catalog.products;
    final filteredProducts = catalog.filteredProducts;
    final stores = catalog.stores;
    final banners = appConfig.offersBanners.isNotEmpty ? appConfig.offersBanners : _offersBanners;
    final dynamicPopularTitle = appConfig.getDynamicPopularTitle(userAddressTitle: cart.selectedMinistry);

    return SingleChildScrollView(
      padding: const EdgeInsets.only(bottom: 90),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ─── Search Bar (تصميم عصري ستايل أبل / جوجل) ───────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Container(
              height: 48,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.search_rounded, color: AppColors.primary, size: 22),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _searchController,
                      onChanged: (val) {
                        catalog.setSearchQuery(val);
                        setState(() {});
                      },
                      style: GoogleFonts.cairo(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.navy,
                      ),
                      decoration: InputDecoration(
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(vertical: 10),
                        hintText: 'ابحث عن وجبة، متجر، أو قهوة مفضلة...',
                        hintStyle: GoogleFonts.cairo(
                          fontSize: 12,
                          color: AppColors.textMuted,
                          fontWeight: FontWeight.normal,
                        ),
                        border: InputBorder.none,
                      ),
                    ),
                  ),
                  if (_searchController.text.isNotEmpty)
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 18, color: AppColors.textMuted),
                      splashRadius: 18,
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                      onPressed: () {
                        _searchController.clear();
                        catalog.setSearchQuery('');
                        setState(() {});
                      },
                    )
                  else
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.04),
                            blurRadius: 4,
                            offset: const Offset(0, 1),
                          ),
                        ],
                      ),
                      child: const Icon(Icons.tune_rounded, color: AppColors.navy, size: 16),
                    ),
                ],
              ),
            ),
          ),

          // ─── 1. سلايدر العروض الترويجية (Offers Slider) ─────────────
          const SizedBox(height: 10),
          SizedBox(
            height: 165,
            child: PageView.builder(
              controller: _offersPageController,
              itemCount: banners.length,
              onPageChanged: (idx) => setState(() => _currentOfferIndex = idx),
              itemBuilder: (context, index) {
                final banner = banners[index];
                final imagePath = banner['image'] as String?;
                return InkWell(
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const OffersScreen()),
                    );
                  },
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 16),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.12),
                          blurRadius: 14,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(20),
                      child: imagePath != null
                          ? Image.asset(
                              imagePath,
                              width: double.infinity,
                              height: double.infinity,
                              fit: BoxFit.cover,
                              errorBuilder: (ctx, err, stack) => _buildFallbackBanner(banner),
                            )
                          : _buildFallbackBanner(banner),
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 8),
          Center(
            child: SmoothPageIndicator(
              controller: _offersPageController,
              count: banners.length,
              effect: const ExpandingDotsEffect(
                activeDotColor: AppColors.primary,
                dotColor: Color(0xFFCBD5E1),
                dotHeight: 6,
                dotWidth: 6,
                expansionFactor: 3,
                spacing: 4,
              ),
            ),
          ),

          const SizedBox(height: 12),

          // ─── مدخل عروض وخصومات المنتجات (Offers Entry مطابقة لصفحة الويب) ───
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: InkWell(
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const OffersScreen()),
                );
              },
              borderRadius: BorderRadius.circular(16),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFFFF7ED), Color(0xFFFFEDD5)],
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFFED7AA)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.orange.withValues(alpha: 0.08),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.local_offer_rounded, color: Colors.white, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                'عروض وتخفيضات اليوم',
                                style: GoogleFonts.cairo(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.navy,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFDC2626),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  'توفير %',
                                  style: GoogleFonts.cairo(
                                    fontSize: 9.5,
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          Text(
                            'تصفح الأصناف المخفّضة المتاحة من المتاجر والسوبر ماركت',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.cairo(
                              fontSize: 10.5,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppColors.primary),
                  ],
                ),
              ),
            ),
          ),

          const SizedBox(height: 16),

          // ─── 2. سلايدر شعارات المحلات والمطاعم (Brands Strip) ───────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  appConfig.storesSectionTitle,
                  style: GoogleFonts.cairo(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: AppColors.navy,
                  ),
                ),
                Text(
                  'الكل (${stores.length})',
                  style: GoogleFonts.cairo(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 98,
            child: stores.isEmpty
                ? Center(
                    child: Text(
                      catalog.isLoading ? 'جاري تحميل المتاجر...' : 'لا توجد متاجر مسجلة حالياً',
                      style: GoogleFonts.cairo(fontSize: 12, color: AppColors.textMuted),
                    ),
                  )
                : ListView.builder(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: stores.length,
                    itemBuilder: (context, index) {
                      final store = stores[index];
                      return Container(
                        width: 78,
                        margin: const EdgeInsets.only(left: 10),
                        child: Column(
                          children: [
                            Container(
                              width: 58,
                              height: 58,
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(18),
                                border: Border.all(
                                  color: store.isOpen ? const Color(0xFFE2E8F0) : Colors.grey.shade300,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.04),
                                    blurRadius: 8,
                                    offset: const Offset(0, 3),
                                  ),
                                ],
                              ),
                              child: AppImage(
                                urlOrPath: store.effectiveLogo,
                                fit: BoxFit.contain,
                                borderRadius: BorderRadius.circular(12),
                                fallbackIcon: Icons.store_rounded,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              store.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              textAlign: TextAlign.center,
                              style: GoogleFonts.cairo(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: AppColors.navy,
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),

          const SizedBox(height: 14),

          // ─── Categories Filter Bar ─────────────────────────────────
          SizedBox(
            height: 42,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _categories.length,
              itemBuilder: (context, index) {
                final cat = _categories[index];
                final catName = cat['name'] as String;
                final isSelected = _selectedCategory == catName;
                return Padding(
                  padding: const EdgeInsets.only(left: 8),
                  child: FilterChip(
                    selected: isSelected,
                    showCheckmark: false,
                    avatar: Icon(
                      cat['icon'] as IconData,
                      size: 15,
                      color: isSelected ? Colors.white : AppColors.navy,
                    ),
                    label: Text(
                      catName,
                      style: GoogleFonts.cairo(
                        fontSize: 12,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                        color: isSelected ? Colors.white : AppColors.navy,
                      ),
                    ),
                    selectedColor: AppColors.primary,
                    backgroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(
                        color: isSelected ? AppColors.primary : const Color(0xFFE2E8F0),
                      ),
                    ),
                    onSelected: (_) {
                      setState(() {
                        _selectedCategory = catName;
                      });
                      catalog.setCategory(catName == 'الكل' ? null : catName);
                    },
                  ),
                );
              },
            ),
          ),

          const SizedBox(height: 18),

          // ─── 3. سلايدر الوجبات الأكثر طلباً (Popular Meals Slider) ──
          Builder(
            builder: (context) {
              final popularMeals = products.where((p) => p.isPopular).toList();
              final displayPopular = popularMeals.isNotEmpty ? popularMeals : products.take(8).toList();

              return Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Text('🔥 ', style: TextStyle(fontSize: 16)),
                            Text(
                              dynamicPopularTitle,
                              style: GoogleFonts.cairo(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: AppColors.navy,
                              ),
                            ),
                          ],
                        ),
                        InkWell(
                          onTap: displayPopular.isEmpty
                              ? null
                              : () => _showAllPopularMealsSheet(
                                    context,
                                    displayPopular,
                                    dynamicPopularTitle,
                                  ),
                          borderRadius: BorderRadius.circular(8),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                            child: Text(
                              'عرض المزيد',
                              style: GoogleFonts.cairo(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: AppColors.primary,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    height: 220,
                child: displayPopular.isEmpty
                    ? Center(
                        child: Text(
                          catalog.isLoading ? 'جاري تحميل الأصناف...' : 'لا توجد أصناف متاحة حالياً',
                          style: GoogleFonts.cairo(fontSize: 12, color: AppColors.textMuted),
                        ),
                      )
                    : ListView.builder(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: displayPopular.length,
                        itemBuilder: (context, index) {
                          final meal = displayPopular[index];
                          return InkWell(
                            onTap: () => _openProductDetails(meal),
                            borderRadius: BorderRadius.circular(18),
                            child: Container(
                              width: 170,
                              margin: const EdgeInsets.only(left: 12),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(18),
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
                                children: [
                                  ClipRRect(
                                    borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
                                    child: Stack(
                                      children: [
                                        AppImage(
                                          urlOrPath: meal.image,
                                          height: 105,
                                          width: double.infinity,
                                          fit: BoxFit.cover,
                                          fallbackIcon: Icons.lunch_dining_rounded,
                                        ),
                                        Positioned(
                                          top: 6,
                                          right: 6,
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: Colors.black.withValues(alpha: 0.65),
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: Row(
                                              children: [
                                                const Icon(Icons.star_rounded, color: Colors.amber, size: 13),
                                                const SizedBox(width: 2),
                                                Text(
                                                  '${meal.rating}',
                                                  style: GoogleFonts.cairo(
                                                    color: Colors.white,
                                                    fontSize: 10,
                                                    fontWeight: FontWeight.bold,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Padding(
                                    padding: const EdgeInsets.all(10),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          meal.name,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: GoogleFonts.cairo(
                                            fontSize: 12,
                                            fontWeight: FontWeight.bold,
                                            color: AppColors.navy,
                                          ),
                                        ),
                                        Text(
                                          meal.storeName,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: GoogleFonts.cairo(
                                            fontSize: 10,
                                            color: AppColors.textMuted,
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Text(
                                              '${meal.price.toStringAsFixed(0)} ج.م',
                                              style: GoogleFonts.cairo(
                                                fontSize: 14,
                                                fontWeight: FontWeight.w900,
                                                color: AppColors.primary,
                                              ),
                                            ),
                                            Container(
                                              padding: const EdgeInsets.all(4),
                                              decoration: BoxDecoration(
                                                color: AppColors.primary,
                                                borderRadius: BorderRadius.circular(8),
                                              ),
                                              child: const Icon(Icons.add, color: Colors.white, size: 16),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                ],
              );
            },
          ),

          const SizedBox(height: 20),

          // ─── 4. قائمة الوجبات (Filtered Meals List) ─────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              '${appConfig.mealsSectionTitle} (${filteredProducts.length})',
              style: GoogleFonts.cairo(
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: AppColors.navy,
              ),
            ),
          ),
          const SizedBox(height: 10),

          if (filteredProducts.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Text(
                  catalog.isLoading ? 'جاري تحميل قائمة الطعام...' : 'لا توجد وجبات مطابقة لهذا التصنيف',
                  style: GoogleFonts.cairo(fontSize: 13, color: AppColors.textMuted),
                ),
              ),
            )
          else
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: filteredProducts.length,
              itemBuilder: (context, index) {
                final meal = filteredProducts[index];
                return InkWell(
                  onTap: () => _openProductDetails(meal),
                  borderRadius: BorderRadius.circular(18),
                  child: Container(
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
                        AppImage(
                          urlOrPath: meal.image,
                          width: 78,
                          height: 78,
                          fit: BoxFit.cover,
                          borderRadius: BorderRadius.circular(14),
                          fallbackIcon: Icons.lunch_dining_rounded,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                meal.name,
                                style: GoogleFonts.cairo(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.navy,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${meal.storeName} • ⏱️ ${meal.prepTime}',
                                style: GoogleFonts.cairo(
                                  fontSize: 11,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                '${meal.price.toStringAsFixed(0)} ج.م',
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
                              id: meal.id,
                              name: meal.name,
                              price: meal.price,
                            );
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                duration: const Duration(seconds: 1),
                                backgroundColor: AppColors.navy,
                                content: Text(
                                  'تمت إضافة ${meal.name} للسلة 🛒',
                                  style: GoogleFonts.cairo(fontSize: 12),
                                ),
                              ),
                            );
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            minimumSize: Size.zero,
                          ),
                          child: const Icon(Icons.add, size: 20),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
        ],
      ),
    );
  }

  // ═════════════════════════════════════════════════════════════════════
  // TAB 1: ORDERS & LIVE TRACKING TAB (مع تفاصيل المدفوعات والفلاتر)
  // ═════════════════════════════════════════════════════════════════════
  Widget _buildOrdersTab(BuildContext context, OrdersProvider orders, CartProvider cart) {
    final allOrders = orders.orders;
    final activeOrders = orders.clientActiveOrders;
    final deliveredOrders = allOrders.where((o) => o.status == OrderStatus.delivered).toList();

    List<OrderModel> displayedOrders;
    if (_ordersFilterIndex == 1) {
      displayedOrders = activeOrders;
    } else if (_ordersFilterIndex == 2) {
      displayedOrders = deliveredOrders;
    } else {
      displayedOrders = allOrders;
    }

    return Column(
      children: [
        // ─── Filter Segmented Badges ───────────────────────────────
        Container(
          color: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              _buildOrderFilterChip(
                label: 'الكل (${allOrders.length})',
                index: 0,
              ),
              const SizedBox(width: 8),
              _buildOrderFilterChip(
                label: 'قيد التوصيل (${activeOrders.length})',
                index: 1,
              ),
              const SizedBox(width: 8),
              _buildOrderFilterChip(
                label: 'المكتملة (${deliveredOrders.length})',
                index: 2,
              ),
            ],
          ),
        ),

        // ─── Orders List ───────────────────────────────────────────
        Expanded(
          child: displayedOrders.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.receipt_long_outlined, size: 60, color: Color(0xFFCBD5E1)),
                      const SizedBox(height: 14),
                      Text(
                        _ordersFilterIndex == 1
                            ? 'لا توجد طلبات جارية الآن'
                            : (_ordersFilterIndex == 2
                                ? 'لا توجد طلبات مكتملة بعد'
                                : 'لا توجد طلبات سابقة'),
                        style: GoogleFonts.cairo(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: AppColors.navy,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'وجباتك المفضلة من فود كورت العاصمة تصل لمكتبك فوراً',
                        style: GoogleFonts.cairo(fontSize: 12, color: AppColors.textMuted),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: displayedOrders.length,
                  itemBuilder: (context, index) {
                    final order = displayedOrders[index];
                    final isDelivered = order.status == OrderStatus.delivered;

                    return InkWell(
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => OrderTrackingScreen(orderId: order.id),
                          ),
                        );
                      },
                      borderRadius: BorderRadius.circular(18),
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(
                            color: order.status.color.withValues(alpha: 0.35),
                          ),
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
                            // Order ID & Status Header
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(6),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF1F5F9),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: const Icon(Icons.receipt_rounded, color: AppColors.navy, size: 16),
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      order.orderNumber.isNotEmpty ? order.orderNumber : order.id.split('_').last,
                                      style: GoogleFonts.cairo(
                                        fontSize: 14,
                                        fontWeight: FontWeight.bold,
                                        color: AppColors.navy,
                                      ),
                                    ),
                                  ],
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: order.status.color.withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Row(
                                    children: [
                                      Icon(order.status.icon, size: 13, color: order.status.color),
                                      const SizedBox(width: 4),
                                      Text(
                                        order.status.arabicLabel,
                                        style: GoogleFonts.cairo(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: order.status.color,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),

                            // Ministry & Office
                            Row(
                              children: [
                                const Icon(Icons.apartment_rounded, size: 14, color: AppColors.textMuted),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    '${order.ministryName} • ${order.floor} - ${order.officeNumber}',
                                    style: GoogleFonts.cairo(fontSize: 11, color: AppColors.textSecondary),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),

                            // Restaurant & Items
                            if (order.restaurantName.isNotEmpty)
                              Row(
                                children: [
                                  const Icon(Icons.storefront_rounded, size: 14, color: AppColors.primary),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      order.restaurantName,
                                      style: GoogleFonts.cairo(
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                        color: AppColors.navy,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            const SizedBox(height: 4),
                            Text(
                              order.itemsSummary.isNotEmpty
                                  ? order.itemsSummary
                                  : '${order.items.length} وجبات بالطلب',
                              style: GoogleFonts.cairo(fontSize: 11, color: AppColors.textMuted),
                            ),

                            const Divider(height: 20, color: Color(0xFFF1F5F9)),

                            // Payment Method & Status Badges Row
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                // Payment Method Badge
                                _buildOrderPaymentBadge(order.paymentMethod),

                                // Payment Status Badge
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: (isDelivered || order.paymentStatus == 'paid')
                                        ? const Color(0xFFF0FDF4)
                                        : const Color(0xFFFEF3C7),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(
                                      color: (isDelivered || order.paymentStatus == 'paid')
                                          ? const Color(0xFFBBF7D0)
                                          : const Color(0xFFFDE68A),
                                    ),
                                  ),
                                  child: Text(
                                    (isDelivered || order.paymentStatus == 'paid')
                                        ? 'تم السداد بنجاح ✅'
                                        : 'بانتظار السداد للمندوب ⏳',
                                    style: GoogleFonts.cairo(
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      color: (isDelivered || order.paymentStatus == 'paid')
                                          ? const Color(0xFF166534)
                                          : const Color(0xFFB45309),
                                    ),
                                  ),
                                ),
                              ],
                            ),

                            const SizedBox(height: 10),

                            // Price & Action Button Row
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'الإجمالي: ${order.total.toStringAsFixed(0)} ج.م',
                                  style: GoogleFonts.cairo(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w900,
                                    color: AppColors.primary,
                                  ),
                                ),
                                if (!isDelivered)
                                  Row(
                                    children: [
                                      if (order.otpCode != null)
                                        Container(
                                          margin: const EdgeInsetsDirectional.only(end: 8),
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: AppColors.primaryContainer,
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            'OTP: ${order.otpCode}',
                                            style: GoogleFonts.cairo(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w900,
                                              color: AppColors.primaryDark,
                                            ),
                                          ),
                                        ),
                                      Text(
                                        'تتبع المسار 🛵 ⬅️',
                                        style: GoogleFonts.cairo(
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                          color: AppColors.primary,
                                        ),
                                      ),
                                    ],
                                  )
                                else
                                  ElevatedButton.icon(
                                    onPressed: () {
                                      // Re-order items
                                      for (final item in order.items) {
                                        for (int q = 0; q < item.quantity; q++) {
                                          cart.addItem(
                                            id: item.productId,
                                            name: item.name,
                                            price: item.price,
                                          );
                                        }
                                      }
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(
                                          backgroundColor: AppColors.navy,
                                          content: Text(
                                            'تمت إضافة أصناف الطلب إلى سلتك بنجاح! 🛒',
                                            style: GoogleFonts.cairo(),
                                          ),
                                        ),
                                      );
                                    },
                                    icon: const Icon(Icons.replay_rounded, size: 14),
                                    label: Text(
                                      'إعادة الطلب',
                                      style: GoogleFonts.cairo(fontSize: 11, fontWeight: FontWeight.bold),
                                    ),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppColors.navy,
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      minimumSize: Size.zero,
                                    ),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildOrderFilterChip({required String label, required int index}) {
    final isSelected = _ordersFilterIndex == index;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _ordersFilterIndex = index),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.primary : const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: GoogleFonts.cairo(
              fontSize: 11,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
              color: isSelected ? Colors.white : AppColors.textSecondary,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildOrderPaymentBadge(String method) {
    switch (method.toLowerCase()) {
      case 'instapay':
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: const Color(0xFFF3E8FF),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFFE9D5FF)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Image.asset(
                'assets/icons/payment/instapay.png',
                width: 14,
                height: 14,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => const Icon(Icons.bolt, size: 12, color: Color(0xFF7E22CE)),
              ),
              const SizedBox(width: 4),
              Text(
                'إنستاباي',
                style: GoogleFonts.cairo(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF7E22CE),
                ),
              ),
            ],
          ),
        );
      case 'vodafone_cash':
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: const Color(0xFFFEE2E2),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFFFECACA)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Image.asset(
                'assets/icons/payment/vodafone cach.png',
                width: 14,
                height: 14,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => const Icon(Icons.phone_android, size: 12, color: Color(0xFFDC2626)),
              ),
              const SizedBox(width: 4),
              Text(
                'فودافون كاش',
                style: GoogleFonts.cairo(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFFDC2626),
                ),
              ),
            ],
          ),
        );
      case 'card':
      case 'visa':
      case 'meeza':
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: const Color(0xFFDBEAFE),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFFBFDBFE)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Image.asset(
                'assets/icons/payment/visa--logo.png',
                width: 16,
                height: 12,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => const Icon(Icons.credit_card, size: 12, color: Color(0xFF1D4ED8)),
              ),
              const SizedBox(width: 4),
              Text(
                'بطاقة بنكية',
                style: GoogleFonts.cairo(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF1D4ED8),
                ),
              ),
            ],
          ),
        );
      case 'wallet':
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: const Color(0xFFFEF3C7),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFFFDE68A)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.account_balance_wallet_rounded, size: 12, color: Color(0xFFB45309)),
              const SizedBox(width: 4),
              Text(
                'محفظة كاش باك النقاط',
                style: GoogleFonts.cairo(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFFB45309),
                ),
              ),
            ],
          ),
        );
      case 'cash':
      default:
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.payments_rounded, size: 12, color: AppColors.navy),
              const SizedBox(width: 4),
              Text(
                'نقداً عند الاستلام',
                style: GoogleFonts.cairo(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: AppColors.navy,
                ),
              ),
            ],
          ),
        );
    }
  }

  Widget _buildFallbackBanner(Map<String, dynamic> banner) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: banner['gradient'] as List<Color>,
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    banner['tag'] as String,
                    style: GoogleFonts.cairo(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  banner['title'] as String,
                  style: GoogleFonts.cairo(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                  ),
                ),
                Text(
                  banner['subtitle'] as String,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.cairo(
                    fontSize: 11,
                    color: Colors.white.withValues(alpha: 0.85),
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            child: Icon(
              banner['icon'] as IconData,
              color: Colors.white,
              size: 30,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Apple / Google Style Smart Auto-Location Detection Sheet
// ─────────────────────────────────────────────────────────────────────────────
class _AutoLocationSheet extends StatefulWidget {
  final String currentMinistry;
  final ValueChanged<String> onResolved;
  final VoidCallback onOpenManualList;

  const _AutoLocationSheet({
    required this.currentMinistry,
    required this.onResolved,
    required this.onOpenManualList,
  });

  @override
  State<_AutoLocationSheet> createState() => _AutoLocationSheetState();
}

class _AutoLocationSheetState extends State<_AutoLocationSheet> with SingleTickerProviderStateMixin {
  bool _isLocating = true;
  String _statusText = 'جاري الاتصال بالأقمار الصناعية ورصد الإحداثيات...';
  MinistryModel? _resolvedMinistry;
  double? _userLat;
  double? _userLng;
  late AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _startAutoDetection();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  double _calculateDistanceKm(double lat1, double lon1, double lat2, double lon2) {
    const p = 0.017453292519943295;
    final a = 0.5 -
        math.cos((lat2 - lat1) * p) / 2 +
        math.cos(lat1 * p) * math.cos(lat2 * p) * (1 - math.cos((lon2 - lon1) * p)) / 2;
    return 12742 * math.asin(math.sqrt(a));
  }

  Future<void> _startAutoDetection() async {
    try {
      await Future.delayed(const Duration(milliseconds: 600));
      if (!mounted) return;
      setState(() {
        _statusText = 'جاري مطابقة الموقع مع مباني الحي الحكومي...';
      });

      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      Position? position;
      if (serviceEnabled &&
          (permission == LocationPermission.always || permission == LocationPermission.whileInUse)) {
        try {
          position = await Geolocator.getCurrentPosition(
            locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.high,
              timeLimit: Duration(seconds: 4),
            ),
          );
        } catch (_) {
          position = await Geolocator.getLastKnownPosition();
        }
      }

      MinistryModel chosen = MinistryModel.allMinistries.firstWhere(
        (m) => m.name == widget.currentMinistry,
        orElse: () => MinistryModel.allMinistries[2], // Default MCIT
      );

      if (position != null) {
        _userLat = position.latitude;
        _userLng = position.longitude;

        MinistryModel? closest;
        double minDistance = double.infinity;
        for (final m in MinistryModel.allMinistries) {
          final d = _calculateDistanceKm(position.latitude, position.longitude, m.latitude, m.longitude);
          if (d < minDistance) {
            minDistance = d;
            closest = m;
          }
        }
        if (closest != null && minDistance < 50) {
          chosen = closest;
        }
      }

      _userLat ??= chosen.latitude;
      _userLng ??= chosen.longitude;

      await Future.delayed(const Duration(milliseconds: 700));
      if (!mounted) return;

      setState(() {
        _resolvedMinistry = chosen;
        _isLocating = false;
        _statusText = 'تم تحديد موقعك بدقة 🎯';
      });

      widget.onResolved(chosen.name);

      await Future.delayed(const Duration(milliseconds: 1800));
      if (mounted) {
        Navigator.of(context).pop();
      }
    } catch (_) {
      if (!mounted) return;
      final fallback = MinistryModel.allMinistries.firstWhere(
        (m) => m.name == widget.currentMinistry,
        orElse: () => MinistryModel.allMinistries[2],
      );
      setState(() {
        _resolvedMinistry = fallback;
        _userLat = fallback.latitude;
        _userLng = fallback.longitude;
        _isLocating = false;
        _statusText = 'تم تأكيد موقعك بالحي الحكومي';
      });
      widget.onResolved(fallback.name);
      await Future.delayed(const Duration(milliseconds: 1800));
      if (mounted) Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Drag indicator
            Container(
              width: 44,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFCBD5E1),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 22),

            // Animated Pulse Radar & Pin Icon
            AnimatedBuilder(
              animation: _pulseController,
              builder: (context, child) {
                final scale = 1.0 + (_pulseController.value * 0.16);
                final color = _isLocating ? AppColors.primary : const Color(0xFF10B981);
                return Stack(
                  alignment: Alignment.center,
                  children: [
                    Container(
                      width: 76 * scale,
                      height: 76 * scale,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: color.withValues(alpha: 0.16 * (1 - _pulseController.value)),
                      ),
                    ),
                    Container(
                      width: 58,
                      height: 58,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: color,
                        boxShadow: [
                          BoxShadow(
                            color: color.withValues(alpha: 0.35),
                            blurRadius: 18,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                      child: Icon(
                        _isLocating ? Icons.near_me_rounded : Icons.check_circle_rounded,
                        color: Colors.white,
                        size: 28,
                      ),
                    ),
                  ],
                );
              },
            ),
            const SizedBox(height: 18),

            Text(
              _isLocating ? 'تحديد موقعك الجغرافي الذكي' : 'تم التقاط الموقع بنجاح',
              style: GoogleFonts.cairo(
                fontSize: 17,
                fontWeight: FontWeight.bold,
                color: AppColors.navy,
              ),
            ),
            const SizedBox(height: 4),

            Text(
              _statusText,
              textAlign: TextAlign.center,
              style: GoogleFonts.cairo(
                fontSize: 13,
                color: _isLocating ? AppColors.textSecondary : const Color(0xFF059669),
                fontWeight: _isLocating ? FontWeight.normal : FontWeight.bold,
              ),
            ),
            const SizedBox(height: 20),

            // Detected Location Card
            if (_resolvedMinistry != null) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: AppColors.primaryContainer.withValues(alpha: 0.5),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.account_balance_rounded,
                        color: AppColors.primary,
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _resolvedMinistry!.name,
                            style: GoogleFonts.cairo(
                              fontSize: 13.5,
                              fontWeight: FontWeight.bold,
                              color: AppColors.navy,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${_resolvedMinistry!.sector} • ${_resolvedMinistry!.buildingNumber}',
                            style: GoogleFonts.cairo(
                              fontSize: 11.5,
                              color: AppColors.textSecondary,
                            ),
                          ),
                          if (_userLat != null && _userLng != null) ...[
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                const Icon(Icons.gps_fixed_rounded, size: 12, color: Color(0xFF10B981)),
                                const SizedBox(width: 4),
                                Text(
                                  'GPS: ${_userLat!.toStringAsFixed(4)}° N, ${_userLng!.toStringAsFixed(4)}° E',
                                  style: GoogleFonts.cairo(
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w600,
                                    color: const Color(0xFF059669),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                    const Icon(Icons.verified_rounded, color: Color(0xFF10B981), size: 22),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'تم ضبط عنوان التوصيل لمكتبك تلقائياً دون أي تدخل منك.',
                textAlign: TextAlign.center,
                style: GoogleFonts.cairo(
                  fontSize: 11.5,
                  color: AppColors.textMuted,
                ),
              ),
            ] else ...[
              const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  color: AppColors.primary,
                ),
              ),
            ],

            const SizedBox(height: 16),
            // Option to switch manually if needed
            TextButton.icon(
              onPressed: widget.onOpenManualList,
              icon: const Icon(Icons.list_alt_rounded, size: 16, color: AppColors.primary),
              label: Text(
                'اختيار مبنى أو جهة حكومية أخرى يدوياً',
                style: GoogleFonts.cairo(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}


