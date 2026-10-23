import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/constants/colors.dart';
import '../../models/ministry_model.dart';
import '../../providers/auth_provider.dart';

class SavedAddressesScreen extends StatefulWidget {
  const SavedAddressesScreen({super.key});

  @override
  State<SavedAddressesScreen> createState() => _SavedAddressesScreenState();
}

class _SavedAddressesScreenState extends State<SavedAddressesScreen> {
  final List<Map<String, dynamic>> _addresses = [];
  bool _isLocating = false;

  @override
  void initState() {
    super.initState();
    final user = Provider.of<AuthProvider>(context, listen: false).currentUser;
    if (user != null && user.ministry.isNotEmpty && user.ministry != 'غير محدد') {
      _addresses.add({
        'title': user.ministry,
        'sector': 'الحي الحكومي بالعاصمة الإدارية',
        'details': '${user.floorNumber} • ${user.roomNumber}',
        'isDefault': true,
        'lat': 30.0150,
        'lng': 31.7020,
      });
    }
  }

  Future<void> _handleGpsDetectAddress(
    BuildContext ctx,
    String? currentSelected,
    Function(MinistryModel model) onSelected,
  ) async {
    setState(() => _isLocating = true);
    try {
      LocationPermission perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );

      if (!mounted) return;
      setState(() => _isLocating = false);

      // Open the picker bottom sheet with the user's GPS position showing nearest choices with distances!
      _openAddressLocationPickerSheet(
        parentContext: context,
        currentSelected: currentSelected,
        userPosition: pos,
        onSelect: onSelected,
      );
    } catch (e) {
      if (mounted) {
        setState(() => _isLocating = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('تعذر تحديد الموقع بالـ GPS: $e', style: GoogleFonts.cairo()),
            backgroundColor: Colors.red.shade600,
          ),
        );
      }
    }
  }

  void _openAddressLocationPickerSheet({
    required BuildContext parentContext,
    required String? currentSelected,
    Position? userPosition,
    required ValueChanged<MinistryModel> onSelect,
  }) {
    showModalBottomSheet(
      context: parentContext,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetCtx) => _AddressLocationPickerModal(
        currentSelected: currentSelected,
        userPosition: userPosition,
        onSelect: onSelect,
      ),
    );
  }

  void _showAddAddressDialog() {
    String? selectedMinistry;
    String selectedSector = '';
    String selectedBuilding = '';
    final floorCtrl = TextEditingController(text: 'الدور الأرضي');
    final roomCtrl = TextEditingController(text: 'مدخل رئيسي');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          return Container(
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 18,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
            ),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 44,
                      height: 5,
                      decoration: BoxDecoration(
                        color: const Color(0xFFCBD5E1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'إضافة عنوان جديد',
                        style: GoogleFonts.cairo(fontSize: 17, fontWeight: FontWeight.bold, color: AppColors.navy),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close_rounded),
                        onPressed: () => Navigator.of(ctx).pop(),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // GPS Auto-detect Button (Opens choices modal with distance)
                  InkWell(
                    onTap: _isLocating
                        ? null
                        : () {
                            _handleGpsDetectAddress(ctx, selectedMinistry, (model) {
                              setModalState(() {
                                selectedMinistry = model.nameArabic;
                                selectedSector = model.sector;
                                selectedBuilding = model.buildingNumber;
                              });
                            });
                          },
                    borderRadius: BorderRadius.circular(14),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: AppColors.primaryContainer.withValues(alpha: 0.3),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        children: [
                          _isLocating
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                                )
                              : const Icon(Icons.my_location_rounded, color: AppColors.primary, size: 22),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'تحديد المقر تلقائياً من الخريطة (GPS)',
                                  style: GoogleFonts.cairo(
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.primaryDark,
                                  ),
                                ),
                                Text(
                                  'يلتقط موقعك ويعرض أقرب الخيارات لتختار الأنسب لك',
                                  style: GoogleFonts.cairo(fontSize: 11, color: AppColors.textSecondary),
                                ),
                              ],
                            ),
                          ),
                          const Icon(Icons.arrow_forward_ios_rounded, size: 13, color: AppColors.primary),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Apple / Google Minimalist Location Selector Card
                  Text(
                    'المقر أو جهة العمل بالعاصمة',
                    style: GoogleFonts.cairo(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.navy),
                  ),
                  const SizedBox(height: 6),
                  InkWell(
                    onTap: () {
                      _openAddressLocationPickerSheet(
                        parentContext: ctx,
                        currentSelected: selectedMinistry,
                        onSelect: (model) {
                          setModalState(() {
                            selectedMinistry = model.nameArabic;
                            selectedSector = model.sector;
                            selectedBuilding = model.buildingNumber;
                          });
                        },
                      );
                    },
                    borderRadius: BorderRadius.circular(14),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: selectedMinistry != null ? AppColors.primary : const Color(0xFFE2E8F0),
                          width: selectedMinistry != null ? 1.5 : 1.0,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.apartment_rounded,
                            color: selectedMinistry != null ? AppColors.primary : AppColors.textSecondary,
                            size: 24,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  selectedMinistry ?? 'اضغط لاختيار المقر أو الكمبوند أو المدينة',
                                  style: GoogleFonts.cairo(
                                    fontSize: 13.5,
                                    fontWeight: selectedMinistry != null ? FontWeight.bold : FontWeight.w600,
                                    color: selectedMinistry != null ? AppColors.navy : const Color(0xFF94A3B8),
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                if (selectedSector.isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: Colors.white,
                                          borderRadius: BorderRadius.circular(6),
                                          border: Border.all(color: const Color(0xFFCBD5E1)),
                                        ),
                                        child: Text(
                                          selectedBuilding,
                                          style: GoogleFonts.cairo(
                                            fontSize: 10.5,
                                            fontWeight: FontWeight.bold,
                                            color: AppColors.navy,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      Expanded(
                                        child: Text(
                                          selectedSector,
                                          style: GoogleFonts.cairo(fontSize: 10.5, color: AppColors.textSecondary),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: selectedMinistry != null
                                  ? AppColors.primary.withValues(alpha: 0.1)
                                  : const Color(0xFFE2E8F0),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  selectedMinistry != null ? 'تغيير' : 'تحديد',
                                  style: GoogleFonts.cairo(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.bold,
                                    color: selectedMinistry != null ? AppColors.primary : AppColors.navy,
                                  ),
                                ),
                                const SizedBox(width: 2),
                                Icon(
                                  selectedMinistry != null ? Icons.swap_horiz_rounded : Icons.keyboard_arrow_down_rounded,
                                  size: 16,
                                  color: selectedMinistry != null ? AppColors.primary : AppColors.navy,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Floor & Room
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: floorCtrl,
                          decoration: InputDecoration(
                            labelText: 'الدور',
                            hintText: 'الدور الأرضي',
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          ),
                          style: GoogleFonts.cairo(fontSize: 13),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: roomCtrl,
                          decoration: InputDecoration(
                            labelText: 'المكتب / العنوان',
                            hintText: 'مكتب 402 أو شقة',
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          ),
                          style: GoogleFonts.cairo(fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Save Button
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: () {
                        if (selectedMinistry == null) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('يرجى اختيار المقر أو جهة العمل أولاً', style: GoogleFonts.cairo(fontWeight: FontWeight.bold)),
                              backgroundColor: Colors.red.shade700,
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                          return;
                        }
                        setState(() {
                          _addresses.add({
                            'title': selectedMinistry,
                            'sector': '$selectedSector • $selectedBuilding',
                            'details': '${floorCtrl.text.trim()} • ${roomCtrl.text.trim()}',
                            'isDefault': _addresses.isEmpty,
                            'lat': 30.0150,
                            'lng': 31.7020,
                          });
                        });
                        Navigator.of(ctx).pop();
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: 0,
                      ),
                      child: Text(
                        'حفظ العنوان',
                        style: GoogleFonts.cairo(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: false,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.black, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          'Addresses',
          style: GoogleFonts.cairo(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Colors.black,
          ),
        ),
      ),
      body: _addresses.isEmpty ? _buildEmptyState() : _buildAddressList(),
    );
  }

  // ─── Clean Empty State (Pixel-matched to Screenshot 4) ────────────────────
  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Custom Orange Pin with Exclamation Mark
            Container(
              width: 120,
              height: 120,
              alignment: Alignment.center,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Little rays behind the pin
                  Positioned(
                    top: 14,
                    left: 20,
                    child: Transform.rotate(
                      angle: -0.4,
                      child: Container(width: 14, height: 4, decoration: BoxDecoration(color: const Color(0xFF332015), borderRadius: BorderRadius.circular(2))),
                    ),
                  ),
                  Positioned(
                    top: 28,
                    left: 14,
                    child: Transform.rotate(
                      angle: 0.3,
                      child: Container(width: 16, height: 4, decoration: BoxDecoration(color: const Color(0xFF332015), borderRadius: BorderRadius.circular(2))),
                    ),
                  ),
                  // The Pin Body
                  Container(
                    width: 78,
                    height: 96,
                    decoration: const BoxDecoration(
                      color: Color(0xFFFF5722),
                      borderRadius: BorderRadius.only(
                        topLeft: Radius.circular(39),
                        topRight: Radius.circular(39),
                        bottomLeft: Radius.circular(39),
                        bottomRight: Radius.circular(39),
                      ),
                    ),
                    child: Center(
                      child: Container(
                        width: 52,
                        height: 52,
                        decoration: const BoxDecoration(
                          color: Color(0xFFFFF7ED),
                          shape: BoxShape.circle,
                        ),
                        child: const Center(
                          child: Text(
                            '!',
                            style: TextStyle(
                              fontSize: 32,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF332015),
                              height: 1.1,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),

            // Title
            Text(
              'No saved addresses',
              style: GoogleFonts.cairo(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 6),

            // Subtitle
            Text(
              'Start by adding a new address',
              style: GoogleFonts.cairo(
                fontSize: 14,
                color: const Color(0xFF94A3B8),
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 36),

            // Rounded Outline Pill Button
            SizedBox(
              width: 180,
              height: 48,
              child: OutlinedButton(
                onPressed: _showAddAddressDialog,
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Colors.black87, width: 1.2),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(24),
                  ),
                ),
                child: Text(
                  'Add Address',
                  style: GoogleFonts.cairo(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAddressList() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _addresses.length + 1,
      itemBuilder: (ctx, i) {
        if (i == _addresses.length) {
          return Padding(
            padding: const EdgeInsets.only(top: 12),
            child: OutlinedButton.icon(
              onPressed: _showAddAddressDialog,
              icon: const Icon(Icons.add_rounded, color: Colors.black87),
              label: Text(
                'Add Address / إضافة عنوان',
                style: GoogleFonts.cairo(fontWeight: FontWeight.bold, color: Colors.black87),
              ),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Colors.black87),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
            ),
          );
        }

        final addr = _addresses[i];
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.primaryContainer.withValues(alpha: 0.5),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.location_on_rounded, color: AppColors.primary, size: 24),
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
                            addr['title'] ?? '',
                            style: GoogleFonts.cairo(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.navy),
                          ),
                        ),
                        if (addr['isDefault'] == true)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.primary,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              'الرئيسي',
                              style: GoogleFonts.cairo(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      addr['sector'] ?? '',
                      style: GoogleFonts.cairo(fontSize: 12, color: AppColors.textSecondary),
                    ),
                    Text(
                      addr['details'] ?? '',
                      style: GoogleFonts.cairo(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primary),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent, size: 20),
                onPressed: () {
                  setState(() => _addresses.removeAt(i));
                },
              ),
            ],
          ),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Modern Apple/Google Material 3 Address Location Picker Modal Bottom Sheet
// ─────────────────────────────────────────────────────────────────────────────
class _AddressLocationPickerModal extends StatefulWidget {
  final String? currentSelected;
  final Position? userPosition;
  final ValueChanged<MinistryModel> onSelect;

  const _AddressLocationPickerModal({
    required this.currentSelected,
    this.userPosition,
    required this.onSelect,
  });

  @override
  State<_AddressLocationPickerModal> createState() => _AddressLocationPickerModalState();
}

class _AddressLocationPickerModalState extends State<_AddressLocationPickerModal> {
  final _searchController = TextEditingController();
  String _searchQuery = '';
  String _selectedCategory = 'all';

  final List<Map<String, String>> _categories = const [
    {'id': 'all', 'label': 'الكل'},
    {'id': 'government', 'label': '🏢 الحي الحكومي والكيان العسكري'},
    {'id': 'residential', 'label': '🏡 الأحياء السكنية (R3, R5, R7)'},
    {'id': 'surrounding', 'label': '📍 زهرة العاصمة وسكن الموظفين'},
    {'id': 'business', 'label': '🏙️ المال والأعمال والمعرفة'},
    {'id': 'downtown', 'label': '🛍️ الداون تاون والتجاري'},
  ];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final allLocations = MinistryModel.allCapitalLocations;

    // Pre-calculate distances if userPosition is provided
    final Map<String, double> distanceMap = {};
    if (widget.userPosition != null) {
      for (final loc in allLocations) {
        final d = Geolocator.distanceBetween(
          widget.userPosition!.latitude,
          widget.userPosition!.longitude,
          loc.latitude,
          loc.longitude,
        );
        distanceMap[loc.id] = d;
      }
    }

    // Nearest top 3 locations if GPS was captured
    List<MinistryModel> nearestTop3 = [];
    if (widget.userPosition != null && distanceMap.isNotEmpty) {
      final sortedByDist = List<MinistryModel>.from(allLocations)
        ..sort((a, b) => distanceMap[a.id]!.compareTo(distanceMap[b.id]!));
      nearestTop3 = sortedByDist.take(3).toList();
    }

    final filtered = allLocations.where((m) {
      if (_selectedCategory != 'all' && m.category != _selectedCategory) {
        return false;
      }
      if (_searchQuery.trim().isEmpty) return true;
      final q = _searchQuery.trim().toLowerCase();
      return m.nameArabic.toLowerCase().contains(q) ||
          m.buildingNumber.toLowerCase().contains(q) ||
          m.sector.toLowerCase().contains(q);
    }).toList();

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        boxShadow: [
          BoxShadow(
            color: Colors.black26,
            blurRadius: 24,
            offset: Offset(0, -6),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 10),
            // Apple / Google Drag Handle
            Container(
              width: 42,
              height: 5,
              decoration: BoxDecoration(
                color: const Color(0xFFCBD5E1),
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            const SizedBox(height: 14),

            // Header: Title + Subtitle + Close Button
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'تحديد المقر أو جهة العمل (العاصمة والمناطق المجاورة)',
                          style: GoogleFonts.cairo(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: AppColors.navy,
                          ),
                        ),
                        Text(
                          'اختر مقرك أو كمبوندك أو مدينتك لتوصيل دقيق لأقرب نقطة',
                          style: GoogleFonts.cairo(
                            fontSize: 11.5,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded, color: AppColors.textSecondary),
                    style: IconButton.styleFrom(
                      backgroundColor: const Color(0xFFF1F5F9),
                      padding: const EdgeInsets.all(8),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // Live Search Bar (Google M3 & Apple Search Bar)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: TextField(
                  controller: _searchController,
                  onChanged: (val) => setState(() => _searchQuery = val),
                  decoration: InputDecoration(
                    hintText: 'ابحث باسم المقر، الكمبوند، المدينة، أو الوزارة...',
                    hintStyle: GoogleFonts.cairo(fontSize: 12.5, color: const Color(0xFF94A3B8)),
                    prefixIcon: const Icon(Icons.search_rounded, color: AppColors.textSecondary, size: 22),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear_rounded, size: 18),
                            onPressed: () {
                              _searchController.clear();
                              setState(() => _searchQuery = '');
                            },
                          )
                        : null,
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Category Filter Chips
            SizedBox(
              height: 36,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 20),
                itemCount: _categories.length,
                itemBuilder: (context, index) {
                  final cat = _categories[index];
                  final isSelected = _selectedCategory == cat['id'];
                  return Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: InkWell(
                      onTap: () => setState(() => _selectedCategory = cat['id']!),
                      borderRadius: BorderRadius.circular(10),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 180),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        decoration: BoxDecoration(
                          color: isSelected ? AppColors.primary : const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: isSelected ? AppColors.primary : const Color(0xFFCBD5E1),
                          ),
                        ),
                        child: Center(
                          child: Text(
                            cat['label']!,
                            style: GoogleFonts.cairo(
                              fontSize: 11.5,
                              fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                              color: isSelected ? Colors.white : AppColors.navy,
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 10),
            const Divider(height: 1, color: Color(0xFFF1F5F9)),

            // List of Options
            Flexible(
              child: ListView(
                shrinkWrap: true,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                children: [
                  // Nearest GPS Suggestions Card (If GPS position is available)
                  if (nearestTop3.isNotEmpty && _searchQuery.isEmpty && _selectedCategory == 'all') ...[
                    Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.primaryContainer.withValues(alpha: 0.35),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.my_location_rounded, color: AppColors.primary, size: 18),
                              const SizedBox(width: 8),
                              Text(
                                'أقرب الخيارات لموقعك الحالي (اختر الأنسب لك):',
                                style: GoogleFonts.cairo(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.primaryDark,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          ...nearestTop3.map((item) {
                            final distMeters = distanceMap[item.id] ?? 0;
                            final distStr = distMeters >= 1000
                                ? '${(distMeters / 1000).toStringAsFixed(1)} كم'
                                : '${distMeters.round()} م';

                            return InkWell(
                              onTap: () {
                                widget.onSelect(item);
                                Navigator.of(context).pop();
                              },
                              borderRadius: BorderRadius.circular(10),
                              child: Container(
                                margin: const EdgeInsets.only(bottom: 6),
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: const Color(0xFFE2E8F0)),
                                ),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            item.nameArabic,
                                            style: GoogleFonts.cairo(
                                              fontSize: 12.5,
                                              fontWeight: FontWeight.bold,
                                              color: AppColors.navy,
                                            ),
                                          ),
                                          Text(
                                            item.sector,
                                            style: GoogleFonts.cairo(
                                              fontSize: 10.5,
                                              color: AppColors.textSecondary,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ],
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: AppColors.primary.withValues(alpha: 0.1),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        'على بُعد $distStr',
                                        style: GoogleFonts.cairo(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: AppColors.primary,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    const Icon(Icons.arrow_forward_ios_rounded, size: 12, color: AppColors.primary),
                                  ],
                                ),
                              ),
                            );
                          }),
                        ],
                      ),
                    ),
                    Row(
                      children: [
                        Expanded(child: Divider(color: Colors.grey.shade300)),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          child: Text(
                            'أو تصفح جميع مقرات العاصمة',
                            style: GoogleFonts.cairo(fontSize: 11, color: AppColors.textSecondary),
                          ),
                        ),
                        Expanded(child: Divider(color: Colors.grey.shade300)),
                      ],
                    ),
                    const SizedBox(height: 10),
                  ],

                  // All Filtered Items
                  ...filtered.map((item) {
                    final isSelected = item.nameArabic == widget.currentSelected;

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: InkWell(
                        onTap: () {
                          widget.onSelect(item);
                          Navigator.of(context).pop();
                        },
                        borderRadius: BorderRadius.circular(14),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? AppColors.primary.withValues(alpha: 0.06)
                                : Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: isSelected
                                  ? AppColors.primary
                                  : const Color(0xFFE2E8F0),
                              width: isSelected ? 1.8 : 1.0,
                            ),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      item.nameArabic,
                                      style: GoogleFonts.cairo(
                                        fontSize: 13.5,
                                        fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                                        color: isSelected ? AppColors.primary : AppColors.navy,
                                      ),
                                    ),
                                    const SizedBox(height: 3),
                                    Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFF1F5F9),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            item.buildingNumber,
                                            style: GoogleFonts.cairo(
                                              fontSize: 10.5,
                                              fontWeight: FontWeight.bold,
                                              color: AppColors.navy,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        Expanded(
                                          child: Text(
                                            item.sector,
                                            style: GoogleFonts.cairo(
                                              fontSize: 10.5,
                                              color: AppColors.textSecondary,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              if (isSelected)
                                Container(
                                  width: 24,
                                  height: 24,
                                  decoration: const BoxDecoration(
                                    color: AppColors.primary,
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(
                                    Icons.check_rounded,
                                    color: Colors.white,
                                    size: 16,
                                  ),
                                )
                              else
                                const Icon(
                                  Icons.chevron_left_rounded,
                                  color: Color(0xFFCBD5E1),
                                  size: 20,
                                ),
                            ],
                          ),
                        ),
                      ),
                    );
                  }),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }
}
