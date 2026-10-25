import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/constants/colors.dart';
import '../../models/product_model.dart';
import '../../providers/cart_provider.dart';
import '../../widgets/app_image.dart';

class ProductDetailsScreen extends StatefulWidget {
  final ProductModel product;

  const ProductDetailsScreen({
    super.key,
    required this.product,
  });

  @override
  State<ProductDetailsScreen> createState() => _ProductDetailsScreenState();
}

class _ProductDetailsScreenState extends State<ProductDetailsScreen> {
  int _quantity = 1;
  late ProductOption _selectedSize;
  final Set<ProductOption> _selectedAddOns = {};
  final TextEditingController _notesController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _selectedSize = widget.product.sizes.isNotEmpty
        ? widget.product.sizes.firstWhere((s) => s.isDefault, orElse: () => widget.product.sizes.first)
        : const ProductOption(name: 'حجم عادي');
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  double get _calculatedUnitPrice {
    double total = widget.product.price + _selectedSize.additionalPrice;
    for (final addon in _selectedAddOns) {
      total += addon.additionalPrice;
    }
    return total;
  }

  double get _calculatedTotalPrice => _calculatedUnitPrice * _quantity;

  void _addToCart() {
    final cart = Provider.of<CartProvider>(context, listen: false);

    String fullName = widget.product.name;
    if (_selectedSize.name != 'حجم عادي') {
      fullName += ' (${_selectedSize.name})';
    }
    if (_selectedAddOns.isNotEmpty) {
      final addonsStr = _selectedAddOns.map((a) => a.name).join(' + ');
      fullName += ' + [$addonsStr]';
    }
    if (_notesController.text.trim().isNotEmpty) {
      fullName += ' • ملاحظة: ${_notesController.text.trim()}';
    }

    for (int i = 0; i < _quantity; i++) {
      cart.addItem(
        id: '${widget.product.id}_${DateTime.now().microsecondsSinceEpoch}_$i',
        productId: widget.product.id,
        storeId: widget.product.storeId.isNotEmpty ? widget.product.storeId : 'capital-central-kitchen',
        name: fullName,
        price: _calculatedUnitPrice,
      );
    }

    Navigator.of(context).pop();

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: AppColors.navy,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        content: Row(
          children: [
            const Icon(Icons.check_circle_rounded, color: Colors.greenAccent, size: 22),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'تمت إضافة $_quantity × ${widget.product.name} إلى السلة بنجاح!',
                style: GoogleFonts.cairo(fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: CustomScrollView(
        slivers: [
          // ─── Sliver App Bar with Hero Image ────────────────────────
          SliverAppBar(
            expandedHeight: 260,
            pinned: true,
            backgroundColor: AppColors.navy,
            leading: IconButton(
              icon: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.85),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: AppColors.navy),
              ),
              onPressed: () => Navigator.of(context).pop(),
            ),
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                fit: StackFit.expand,
                children: [
                  AppImage(
                    urlOrPath: widget.product.image,
                    fit: BoxFit.cover,
                  ),
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.black.withValues(alpha: 0.35),
                          Colors.transparent,
                          Colors.black.withValues(alpha: 0.65),
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 16,
                    right: 16,
                    left: 16,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            widget.product.category,
                            style: GoogleFonts.cairo(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.6),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.star_rounded, color: Colors.amber, size: 16),
                              const SizedBox(width: 4),
                              Text(
                                '${widget.product.rating}',
                                style: GoogleFonts.cairo(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ─── Details Body ──────────────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title and Price
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          widget.product.name,
                          style: GoogleFonts.cairo(
                            fontSize: 19,
                            fontWeight: FontWeight.w900,
                            color: AppColors.navy,
                            height: 1.3,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            '${widget.product.price.toStringAsFixed(0)} ج.م',
                            style: GoogleFonts.cairo(
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              color: AppColors.primary,
                            ),
                          ),
                          Text(
                            'السعر الأساسي',
                            style: GoogleFonts.cairo(fontSize: 10, color: AppColors.textMuted),
                          ),
                        ],
                      ),
                    ],
                  ),

                  const SizedBox(height: 8),

                  // Restaurant & Meta Badges
                  Row(
                    children: [
                      const Icon(Icons.storefront_rounded, size: 16, color: AppColors.primary),
                      const SizedBox(width: 6),
                      Text(
                        widget.product.restaurantName,
                        style: GoogleFonts.cairo(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const Spacer(),
                      const Icon(Icons.timer_outlined, size: 15, color: AppColors.textMuted),
                      const SizedBox(width: 4),
                      Text(
                        widget.product.prepTime,
                        style: GoogleFonts.cairo(fontSize: 12, color: AppColors.textMuted),
                      ),
                      const SizedBox(width: 12),
                      const Icon(Icons.local_fire_department_rounded, size: 15, color: Colors.orange),
                      const SizedBox(width: 2),
                      Text(
                        '${widget.product.calories} سعرة',
                        style: GoogleFonts.cairo(fontSize: 12, color: AppColors.textMuted),
                      ),
                    ],
                  ),

                  const SizedBox(height: 14),

                  // Description
                  Text(
                    widget.product.description,
                    style: GoogleFonts.cairo(
                      fontSize: 13,
                      color: AppColors.textPrimary,
                      height: 1.6,
                    ),
                  ),

                  const SizedBox(height: 24),
                  const Divider(height: 1),
                  const SizedBox(height: 16),

                  // ─── Option 1: Sizes ──────────────────────────────
                  if (widget.product.sizes.isNotEmpty) ...[
                    Row(
                      children: [
                        Text(
                          'اختيار الحجم',
                          style: GoogleFonts.cairo(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: AppColors.navy,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '(اختياري)',
                          style: GoogleFonts.cairo(fontSize: 12, color: AppColors.textMuted),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Column(
                      children: widget.product.sizes.map((size) {
                        final isSelected = _selectedSize.name == size.name;
                        return InkWell(
                          onTap: () => setState(() => _selectedSize = size),
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            decoration: BoxDecoration(
                              color: isSelected ? AppColors.primaryContainer.withValues(alpha: 0.3) : const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: isSelected ? AppColors.primary : AppColors.border,
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
                                const SizedBox(width: 10),
                                Text(
                                  size.name,
                                  style: GoogleFonts.cairo(
                                    fontSize: 13,
                                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                                    color: isSelected ? AppColors.navy : AppColors.textPrimary,
                                  ),
                                ),
                                const Spacer(),
                                if (size.additionalPrice > 0)
                                  Text(
                                    '+${size.additionalPrice.toStringAsFixed(0)} ج.م',
                                    style: GoogleFonts.cairo(
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                      color: AppColors.primary,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // ─── Option 2: Add-ons ────────────────────────────
                  if (widget.product.addOns.isNotEmpty) ...[
                    Row(
                      children: [
                        Text(
                          'إضافات ونكهات خاصة',
                          style: GoogleFonts.cairo(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: AppColors.navy,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '(يمكنك اختيار أكثر من خيار)',
                          style: GoogleFonts.cairo(fontSize: 12, color: AppColors.textMuted),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Column(
                      children: widget.product.addOns.map((addon) {
                        final isSelected = _selectedAddOns.contains(addon);
                        return InkWell(
                          onTap: () {
                            setState(() {
                              if (isSelected) {
                                _selectedAddOns.remove(addon);
                              } else {
                                _selectedAddOns.add(addon);
                              }
                            });
                          },
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            decoration: BoxDecoration(
                              color: isSelected ? AppColors.primaryContainer.withValues(alpha: 0.3) : const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: isSelected ? AppColors.primary : AppColors.border,
                                width: isSelected ? 1.5 : 1,
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  isSelected ? Icons.check_box_rounded : Icons.check_box_outline_blank_rounded,
                                  color: isSelected ? AppColors.primary : AppColors.textMuted,
                                  size: 20,
                                ),
                                const SizedBox(width: 10),
                                Text(
                                  addon.name,
                                  style: GoogleFonts.cairo(
                                    fontSize: 13,
                                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                                    color: isSelected ? AppColors.navy : AppColors.textPrimary,
                                  ),
                                ),
                                const Spacer(),
                                if (addon.additionalPrice > 0)
                                  Text(
                                    '+${addon.additionalPrice.toStringAsFixed(0)} ج.م',
                                    style: GoogleFonts.cairo(
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                      color: AppColors.primary,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // ─── Special Instructions for Chef ────────────────
                  Text(
                    'ملاحظات خاصة للشيف',
                    style: GoogleFonts.cairo(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: AppColors.navy,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _notesController,
                    maxLines: 2,
                    style: GoogleFonts.cairo(fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'مثال: بدون بصل، زيادة صوص على الجانب، الخبز محمص...',
                      hintStyle: GoogleFonts.cairo(fontSize: 12, color: AppColors.textMuted),
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: AppColors.primary),
                      ),
                    ),
                  ),

                  const SizedBox(height: 100), // Space for floating button
                ],
              ),
            ),
          ),
        ],
      ),

      // ─── Bottom Floating Add-To-Cart Bar ───────────────────────────
      bottomSheet: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 20,
              offset: const Offset(0, -6),
            ),
          ],
        ),
        child: SafeArea(
          child: Row(
            children: [
              // Quantity stepper
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.remove, size: 18),
                      color: _quantity > 1 ? AppColors.navy : AppColors.textMuted,
                      onPressed: () {
                        if (_quantity > 1) {
                          setState(() => _quantity--);
                        }
                      },
                    ),
                    Text(
                      '$_quantity',
                      style: GoogleFonts.cairo(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: AppColors.navy,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.add, size: 18),
                      color: AppColors.primary,
                      onPressed: () => setState(() => _quantity++),
                    ),
                  ],
                ),
              ),

              const SizedBox(width: 14),

              // Add to cart button
              Expanded(
                child: ElevatedButton(
                  onPressed: _addToCart,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    minimumSize: const Size.fromHeight(52),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    elevation: 3,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'إضافة إلى السلة',
                        style: GoogleFonts.cairo(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        '${_calculatedTotalPrice.toStringAsFixed(0)} ج.م',
                        style: GoogleFonts.cairo(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
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
    );
  }
}
