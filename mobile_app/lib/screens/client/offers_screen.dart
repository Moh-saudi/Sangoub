import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/constants/colors.dart';
import '../../models/product_model.dart';
import '../../providers/cart_provider.dart';
import '../../providers/catalog_provider.dart';
import '../../widgets/app_image.dart';
import 'product_details_screen.dart';

/// شاشة عروض وتخفيضات المنتجات المتزامنة مع صفحة الويب ولوحة التحكم
/// مطابقة تماماً لمنطق PublicOffers.tsx على الويب
class OffersScreen extends StatefulWidget {
  final String? initialStoreId;

  const OffersScreen({
    super.key,
    this.initialStoreId,
  });

  @override
  State<OffersScreen> createState() => _OffersScreenState();
}

class _OffersScreenState extends State<OffersScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  String? _selectedStoreId;
  String _sortBy = 'discount'; // 'discount' | 'price' | 'name'

  @override
  void initState() {
    super.initState();
    _selectedStoreId = widget.initialStoreId;
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final catalog = Provider.of<CatalogProvider>(context);
    final cart = Provider.of<CartProvider>(context);

    // المنتجات المخفضة المتوفرة من المتاجر المفتوحة (مطابق لـ availableOffers على الويب)
    final openStoreIds = catalog.stores
        .where((s) => s.isOpen)
        .map((s) => s.id)
        .toSet();

    // إذا لم تكن المتاجر تحمل حالة status صراحة نعتبر المتاجر المتاحة مفتوحة
    final effectiveOpenStoreIds = openStoreIds.isNotEmpty
        ? openStoreIds
        : catalog.stores.map((s) => s.id).toSet();

    final allOffers = catalog.products.where((p) {
      if (!p.isAvailable) return false;
      if (!p.hasDiscount) return false;
      if (effectiveOpenStoreIds.isNotEmpty && !effectiveOpenStoreIds.contains(p.storeId)) {
        return false;
      }
      return true;
    }).toList();

    // قائمة المتاجر التي لديها عروض حالياً
    final storesWithOffers = catalog.stores
        .where((s) => allOffers.any((p) => p.storeId == s.id))
        .toList();

    // التصفية والفرز
    final query = _searchQuery.trim().toLowerCase();
    final filteredOffers = allOffers.where((p) {
      if (_selectedStoreId != null && _selectedStoreId!.isNotEmpty && p.storeId != _selectedStoreId) {
        return false;
      }
      if (query.isNotEmpty) {
        final matchName = p.name.toLowerCase().contains(query);
        final matchDesc = p.description.toLowerCase().contains(query);
        final matchStore = p.storeName.toLowerCase().contains(query);
        if (!matchName && !matchDesc && !matchStore) return false;
      }
      return true;
    }).toList();

    // الترتيب
    filteredOffers.sort((a, b) {
      if (_sortBy == 'price') {
        return a.price.compareTo(b.price);
      } else if (_sortBy == 'name') {
        return a.name.compareTo(b.name);
      } else {
        // discount
        return b.discountPercentage.compareTo(a.discountPercentage);
      }
    });

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.navy, size: 20),
            onPressed: () => Navigator.of(context).pop(),
          ),
          centerTitle: true,
          title: Text(
            'عروض وخصومات حصرية',
            style: GoogleFonts.cairo(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: AppColors.navy,
            ),
          ),
          actions: [
            // سلة الشراء مع شارة العدد
            Stack(
              alignment: Alignment.center,
              children: [
                IconButton(
                  icon: const Icon(Icons.shopping_bag_outlined, color: AppColors.navy, size: 24),
                  onPressed: () => Navigator.of(context).pop(),
                ),
                if (cart.itemCount > 0)
                  Positioned(
                    top: 8,
                    left: 8,
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
            const SizedBox(width: 8),
          ],
        ),
        body: Column(
          children: [
            // ─── البانر الترويجي العلوي (مطابق لهيدر الويب) ───
            Container(
              margin: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
                  begin: Alignment.topRight,
                  end: Alignment.bottomLeft,
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.15),
                    blurRadius: 14,
                    offset: const Offset(0, 5),
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
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.25),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            '🔥 خصومات مباشرة متجددة',
                            style: GoogleFonts.cairo(
                              color: const Color(0xFFFF9E66),
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'اختياراتك المفضلة، بسعر أحلى.',
                          style: GoogleFonts.cairo(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'تصفح الأصناف المخفّضة المتاحة من المتاجر والسوبر ماركت.',
                          style: GoogleFonts.cairo(
                            color: const Color(0xFF94A3B8),
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Container(
                    width: 54,
                    height: 54,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.4),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Center(
                      child: Icon(Icons.local_offer_rounded, color: Colors.white, size: 28),
                    ),
                  ),
                ],
              ),
            ),

            // ─── شريط البحث في العروض ───
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: TextField(
                  controller: _searchController,
                  onChanged: (val) => setState(() => _searchQuery = val),
                  style: GoogleFonts.cairo(fontSize: 13, color: AppColors.navy),
                  decoration: InputDecoration(
                    hintText: 'ابحث في العروض (اسم الصنف أو المتجر)...',
                    hintStyle: GoogleFonts.cairo(fontSize: 12, color: AppColors.textMuted),
                    prefixIcon: const Icon(Icons.search_rounded, color: AppColors.primary, size: 20),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear_rounded, size: 18, color: AppColors.textMuted),
                            onPressed: () {
                              _searchController.clear();
                              setState(() => _searchQuery = '');
                            },
                          )
                        : null,
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                  ),
                ),
              ),
            ),

            // ─── أزرار التصفية حسب المتجر والترتيب ───
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Row(
                children: [
                  // اختيار المتجر
                  Expanded(
                    flex: 6,
                    child: Container(
                      height: 38,
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String?>(
                          value: _selectedStoreId,
                          isExpanded: true,
                          icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 18, color: AppColors.navy),
                          style: GoogleFonts.cairo(fontSize: 12, color: AppColors.navy, fontWeight: FontWeight.w600),
                          items: [
                            DropdownMenuItem<String?>(
                              value: null,
                              child: Text('كل المتاجر (${allOffers.length})'),
                            ),
                            ...storesWithOffers.map((store) {
                              final count = allOffers.where((p) => p.storeId == store.id).length;
                              return DropdownMenuItem<String?>(
                                value: store.id,
                                child: Text('${store.name} ($count)'),
                              );
                            }),
                          ],
                          onChanged: (val) => setState(() => _selectedStoreId = val),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),

                  // الترتيب
                  Expanded(
                    flex: 5,
                    child: Container(
                      height: 38,
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _sortBy,
                          isExpanded: true,
                          icon: const Icon(Icons.sort_rounded, size: 18, color: AppColors.navy),
                          style: GoogleFonts.cairo(fontSize: 12, color: AppColors.navy, fontWeight: FontWeight.w600),
                          items: const [
                            DropdownMenuItem(value: 'discount', child: Text('أكبر خصم ٪')),
                            DropdownMenuItem(value: 'price', child: Text('الأقل سعراً')),
                            DropdownMenuItem(value: 'name', child: Text('اسم الصنف')),
                          ],
                          onChanged: (val) {
                            if (val != null) setState(() => _sortBy = val);
                          },
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 6),

            // ─── شبكة عرض الأصناف المخفضة ───
            Expanded(
              child: catalog.isLoading
                  ? const Center(
                      child: CircularProgressIndicator(color: AppColors.primary),
                    )
                  : filteredOffers.isEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(32),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  width: 72,
                                  height: 72,
                                  decoration: BoxDecoration(
                                    color: Colors.orange.shade50,
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(
                                    Icons.local_offer_outlined,
                                    size: 36,
                                    color: AppColors.primary,
                                  ),
                                ),
                                const SizedBox(height: 16),
                                Text(
                                  allOffers.isNotEmpty ? 'لا توجد عروض مطابقة للبحث' : 'العروض قادمة قريباً',
                                  style: GoogleFonts.cairo(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.navy,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  allOffers.isNotEmpty
                                      ? 'جرّب البحث باسم آخر أو اختر متجراً مختلفاً.'
                                      : 'تابعنا لمعرفة الأصناف المخفّضة فور توافرها في المتاجر.',
                                  textAlign: TextAlign.center,
                                  style: GoogleFonts.cairo(
                                    fontSize: 12,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                                if (_searchQuery.isNotEmpty || _selectedStoreId != null) ...[
                                  const SizedBox(height: 16),
                                  ElevatedButton(
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppColors.primary,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                    ),
                                    onPressed: () {
                                      setState(() {
                                        _searchController.clear();
                                        _searchQuery = '';
                                        _selectedStoreId = null;
                                      });
                                    },
                                    child: Text(
                                      'عرض كل العروض',
                                      style: GoogleFonts.cairo(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        )
                      : GridView.builder(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                          physics: const BouncingScrollPhysics(),
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            childAspectRatio: 0.68,
                            crossAxisSpacing: 12,
                            mainAxisSpacing: 12,
                          ),
                          itemCount: filteredOffers.length,
                          itemBuilder: (context, index) {
                            final product = filteredOffers[index];
                            return _buildOfferCard(context, product, cart);
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOfferCard(BuildContext context, ProductModel product, CartProvider cart) {
    final discountPercent = product.discountPercentage;

    return InkWell(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => ProductDetailsScreen(product: product),
          ),
        );
      },
      borderRadius: BorderRadius.circular(18),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // صورة المنتج مع شارة الخصم
            Stack(
              children: [
                ClipRRect(
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
                  child: AspectRatio(
                    aspectRatio: 1.25,
                    child: AppImage(
                      urlOrPath: product.effectiveImageUrl,
                      fit: BoxFit.cover,
                      fallbackIcon: Icons.shopping_basket_rounded,
                    ),
                  ),
                ),
                // شارة الخصم بالنسبة المئوية
                if (discountPercent > 0)
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDC2626),
                        borderRadius: BorderRadius.circular(10),
                        boxShadow: const [
                          BoxShadow(color: Colors.black26, blurRadius: 4, offset: Offset(0, 2)),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.local_offer, color: Colors.white, size: 11),
                          const SizedBox(width: 3),
                          Text(
                            'خصم $discountPercent٪',
                            style: GoogleFonts.cairo(
                              color: Colors.white,
                              fontSize: 10.5,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),

            // تفاصيل المنتج
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // اسم المتجر
                    Row(
                      children: [
                        const Icon(Icons.store_rounded, size: 12, color: AppColors.textMuted),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            product.storeName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.cairo(
                              fontSize: 10.5,
                              color: AppColors.textMuted,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),

                    // اسم الصنف
                    Text(
                      product.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.cairo(
                        fontSize: 12.5,
                        fontWeight: FontWeight.bold,
                        color: AppColors.navy,
                        height: 1.25,
                      ),
                    ),

                    const Spacer(),

                    // الأسعار (السعر الحالي مع المشطوب)
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          '${product.price.toStringAsFixed(0)} ج.م',
                          style: GoogleFonts.cairo(
                            fontSize: 13.5,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primary,
                          ),
                        ),
                        const SizedBox(width: 6),
                        if (product.originalPrice != null)
                          Text(
                            '${product.originalPrice!.toStringAsFixed(0)} ج.م',
                            style: GoogleFonts.cairo(
                              fontSize: 11,
                              color: const Color(0xFF94A3B8),
                              decoration: TextDecoration.lineThrough,
                              decorationColor: const Color(0xFFDC2626),
                            ),
                          ),
                      ],
                    ),

                    const SizedBox(height: 6),

                    // زر الإضافة للسلة بلمسة واحدة
                    SizedBox(
                      width: double.infinity,
                      height: 32,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.navy,
                          elevation: 0,
                          padding: EdgeInsets.zero,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        onPressed: () {
                          cart.addProduct(product);
                          ScaffoldMessenger.of(context).hideCurrentSnackBar();
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                'تمت إضافة "${product.name}" إلى السلة بنجاح',
                                style: GoogleFonts.cairo(fontSize: 12),
                              ),
                              backgroundColor: AppColors.navy,
                              duration: const Duration(seconds: 2),
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        },
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.add_shopping_cart_rounded, size: 14, color: Colors.white),
                            const SizedBox(width: 4),
                            Text(
                              'أضف للسلة',
                              style: GoogleFonts.cairo(
                                color: Colors.white,
                                fontSize: 11,
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
            ),
          ],
        ),
      ),
    );
  }
}
