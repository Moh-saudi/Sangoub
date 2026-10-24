import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import '../../core/constants/colors.dart';
import '../../core/services/location_service.dart';
import '../../models/ministry_model.dart';

/// ─── شاشة اختيار الموقع بالخريطة الحقيقية (OpenStreetMap) ──────────────────
/// - تعرض خريطة تفاعلية حقيقية مجانية
/// - تضع علامات لجميع الوزارات والمواقع
/// - تحدد الموقع تلقائياً بـ GPS
/// - تحسب رسوم التوصيل بناءً على المسافة الفعلية
class MapPickerScreen extends StatefulWidget {
  final String? currentMinistry;
  final Function(MinistryModel ministry, DeliveryInfo delivery) onConfirm;

  const MapPickerScreen({
    super.key,
    this.currentMinistry,
    required this.onConfirm,
  });

  @override
  State<MapPickerScreen> createState() => _MapPickerScreenState();
}

class _MapPickerScreenState extends State<MapPickerScreen>
    with TickerProviderStateMixin {
  final MapController _mapController = MapController();
  late AnimationController _pulseController;

  // الموقع الحالي للمستخدم
  LatLng? _userPosition;
  bool _isLocating = false;
  bool _gpsDone = false;

  // الموقع المختار
  MinistryModel? _selectedMinistry;
  DeliveryInfo? _deliveryInfo;

  // فلترة قائمة المواقع
  String _filterCategory = 'all';
  final TextEditingController _searchCtrl = TextEditingController();
  String _searchQuery = '';

  // نقطة الفود كورت
  static const LatLng _foodCourtLatLng = LatLng(
    LocationService.kFoodCourtLat,
    LocationService.kFoodCourtLng,
  );

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();

    // تحميل الموقع المختار مسبقاً
    if (widget.currentMinistry != null) {
      _selectedMinistry = MinistryModel.allMinistries.firstWhere(
        (m) => m.nameArabic == widget.currentMinistry,
        orElse: () => MinistryModel.allMinistries.first,
      );
      _deliveryInfo = LocationService.getDeliveryInfo(_selectedMinistry!);
    }

    // بدء تحديد الموقع تلقائياً
    WidgetsBinding.instance.addPostFrameCallback((_) => _detectLocation());
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _mapController.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  // ─── تحديد موقع المستخدم ───────────────────────────────────────────────
  Future<void> _detectLocation() async {
    if (_isLocating) return;
    setState(() => _isLocating = true);

    final pos = await LocationService.instance.getCurrentPosition();

    if (!mounted) return;

    if (pos != null) {
      final userLatLng = LatLng(pos.latitude, pos.longitude);
      final nearest = LocationService.findNearest(pos.latitude, pos.longitude);
      final delivery = LocationService.getDeliveryInfo(nearest);

      setState(() {
        _userPosition = userLatLng;
        _isLocating = false;
        _gpsDone = true;
        _selectedMinistry = nearest;
        _deliveryInfo = delivery;
      });

      // تحريك الخريطة لموقع المستخدم
      _mapController.move(
        LatLng(
          (pos.latitude + nearest.latitude) / 2,
          (pos.longitude + nearest.longitude) / 2,
        ),
        12.5,
      );
    } else {
      // إذا فشل GPS، اذهب للحي الحكومي
      setState(() {
        _isLocating = false;
        _gpsDone = false;
      });
      _mapController.move(_foodCourtLatLng, 13.0);
    }
  }

  void _selectMinistry(MinistryModel m) {
    final delivery = LocationService.getDeliveryInfo(
      m,
      storeCount: 1, // سيُعاد الحساب عند التأكيد
    );
    setState(() {
      _selectedMinistry = m;
      _deliveryInfo = delivery;
    });
    // تحريك الخريطة للموقع المختار
    _mapController.move(LatLng(m.latitude, m.longitude), 14.5);
  }

  Future<void> _selectCustomPoint(LatLng point) async {
    final km = LocationService.haversineKm(
      LocationService.kFoodCourtLat,
      LocationService.kFoodCourtLng,
      point.latitude,
      point.longitude,
    );
    final delivery = LocationService.getDeliveryInfoByDistance(km, storeCount: 1);
    final nearest = LocationService.findNearest(point.latitude, point.longitude);

    String locationName = nearest.nameArabic;
    setState(() {
      _selectedMinistry = MinistryModel(
        id: 'pin_${point.latitude.toStringAsFixed(4)}_${point.longitude.toStringAsFixed(4)}',
        nameArabic: locationName,
        sector: delivery.zoneName,
        buildingNumber: 'موقع محدد على الخريطة',
        totalOffices: 100,
        icon: 'pin_drop',
        category: nearest.category,
        latitude: point.latitude,
        longitude: point.longitude,
      );
      _deliveryInfo = delivery;
    });

    // جلب الاسم الحقيقي للموقع باللغة العربية في الخلفية
    final realName = await LocationService.instance.reverseGeocode(point.latitude, point.longitude);
    if (realName != null && mounted) {
      setState(() {
        _selectedMinistry = MinistryModel(
          id: _selectedMinistry!.id,
          nameArabic: realName,
          sector: delivery.zoneName,
          buildingNumber: 'موقع محدد على الخريطة',
          totalOffices: 100,
          icon: 'pin_drop',
          category: nearest.category,
          latitude: point.latitude,
          longitude: point.longitude,
        );
      });
    }
  }

  Future<void> _confirm() async {
    if (_selectedMinistry == null || _deliveryInfo == null) return;
    if (!_deliveryInfo!.isAvailable) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'هذا الموقع خارج نطاق التوصيل المتاح حالياً.',
            style: GoogleFonts.cairo(),
          ),
          backgroundColor: Colors.red.shade700,
        ),
      );
      return;
    }

    await LocationService.instance.saveSelectedLocation(
      name: _selectedMinistry!.nameArabic,
      lat: _selectedMinistry!.latitude,
      lng: _selectedMinistry!.longitude,
    );

    widget.onConfirm(_selectedMinistry!, _deliveryInfo!);
    if (mounted) Navigator.of(context).pop();
  }

  // ─── فلترة المواقع ─────────────────────────────────────────────────────
  List<MinistryModel> get _filtered {
    return MinistryModel.allMinistries.where((m) {
      final catMatch = _filterCategory == 'all' || m.category == _filterCategory;
      final searchMatch = _searchQuery.isEmpty ||
          m.nameArabic.contains(_searchQuery) ||
          m.sector.contains(_searchQuery);
      return catMatch && searchMatch;
    }).toList();
  }

  // ─── لون علامة الخريطة حسب الفئة ──────────────────────────────────────
  Color _markerColor(MinistryModel m) {
    final isSelected = _selectedMinistry?.id == m.id;
    if (isSelected) return AppColors.primary;
    switch (m.category) {
      case 'government':
        return const Color(0xFF1E3A5F);
      case 'business':
        return const Color(0xFF6366F1);
      case 'residential':
        return const Color(0xFF10B981);
      case 'surrounding':
        return const Color(0xFFF59E0B);
      case 'downtown':
        return const Color(0xFFEC4899);
      default:
        return AppColors.navy;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // ─── الخريطة الحقيقية ─────────────────────────────────────────
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _foodCourtLatLng,
              initialZoom: 13.0,
              minZoom: 9.0,
              maxZoom: 18.0,
              onTap: (_, point) {
                _selectCustomPoint(point);
              },
            ),
            children: [
              // طبقة خريطة OpenStreetMap (مجانية)
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.capitaltalabat.app',
                maxNativeZoom: 19,
              ),

              // خط بين الفود كورت والموقع المختار
              if (_selectedMinistry != null)
                PolylineLayer(
                  polylines: [
                    Polyline(
                      points: [
                        _foodCourtLatLng,
                        LatLng(_selectedMinistry!.latitude, _selectedMinistry!.longitude),
                      ],
                      color: AppColors.primary.withValues(alpha: 0.55),
                      strokeWidth: 2.5,
                      pattern: StrokePattern.dashed(segments: const [8, 4]),
                    ),
                  ],
                ),

              // علامات الوزارات والمواقع
              MarkerLayer(
                markers: [
                  // علامة الفود كورت (مصدر التوصيل)
                  Marker(
                    point: _foodCourtLatLng,
                    width: 44,
                    height: 52,
                    child: _FoodCourtMarker(pulseCtrl: _pulseController),
                  ),

                  // علامات جميع المواقع
                  ..._filtered.map((m) {
                    final isSelected = _selectedMinistry?.id == m.id;
                    return Marker(
                      point: LatLng(m.latitude, m.longitude),
                      width: isSelected ? 52 : 38,
                      height: isSelected ? 60 : 44,
                      child: GestureDetector(
                        onTap: () => _selectMinistry(m),
                        child: _MinistryMarker(
                          ministry: m,
                          isSelected: isSelected,
                          color: _markerColor(m),
                        ),
                      ),
                    );
                  }),

                  // علامة GPS الخاصة بالمستخدم
                  if (_userPosition != null)
                    Marker(
                      point: _userPosition!,
                      width: 20,
                      height: 20,
                      child: Container(
                        decoration: BoxDecoration(
                          color: const Color(0xFF3B82F6),
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 3),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF3B82F6).withValues(alpha: 0.4),
                              blurRadius: 8,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),

          // ─── شريط العنوان العلوي ─────────────────────────────────────────
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              bottom: false,
              child: Container(
                margin: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.12),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    // صف العنوان
                    Padding(
                      padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
                      child: Row(
                        children: [
                          InkWell(
                            onTap: () => Navigator.of(context).pop(),
                            borderRadius: BorderRadius.circular(10),
                            child: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Icon(Icons.arrow_back_ios_new_rounded,
                                  size: 16, color: AppColors.navy),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'اختر موقع التوصيل',
                              style: GoogleFonts.cairo(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: AppColors.navy,
                              ),
                            ),
                          ),
                          // زر GPS
                          InkWell(
                            onTap: _detectLocation,
                            borderRadius: BorderRadius.circular(10),
                            child: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: _gpsDone
                                    ? AppColors.primary.withValues(alpha: 0.12)
                                    : const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: _gpsDone
                                      ? AppColors.primary.withValues(alpha: 0.3)
                                      : Colors.transparent,
                                ),
                              ),
                              child: _isLocating
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: AppColors.primary,
                                      ),
                                    )
                                  : Icon(
                                      Icons.my_location_rounded,
                                      size: 18,
                                      color: _gpsDone
                                          ? AppColors.primary
                                          : AppColors.navy,
                                    ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    // شريط البحث
                    Padding(
                      padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                      child: TextField(
                        controller: _searchCtrl,
                        onChanged: (v) => setState(() => _searchQuery = v),
                        textAlign: TextAlign.right,
                        style: GoogleFonts.cairo(fontSize: 13),
                        decoration: InputDecoration(
                          hintText: 'ابحث عن وزارة أو حي أو كمبوند...',
                          hintStyle: GoogleFonts.cairo(
                            fontSize: 12.5,
                            color: AppColors.textSecondary,
                          ),
                          prefixIcon: const Icon(Icons.search_rounded,
                              size: 18, color: AppColors.textSecondary),
                          filled: true,
                          fillColor: const Color(0xFFF8FAFC),
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 10),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(
                                color: Color(0xFFE2E8F0)),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(
                                color: Color(0xFFE2E8F0)),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(
                                color: AppColors.primary),
                          ),
                        ),
                      ),
                    ),

                    // فلتر الفئات
                    SizedBox(
                      height: 36,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                        children: [
                          _FilterChip(
                              label: 'الكل',
                              value: 'all',
                              current: _filterCategory,
                              onTap: (v) =>
                                  setState(() => _filterCategory = v)),
                          _FilterChip(
                              label: 'الوزارات',
                              value: 'government',
                              current: _filterCategory,
                              color: const Color(0xFF1E3A5F),
                              onTap: (v) =>
                                  setState(() => _filterCategory = v)),
                          _FilterChip(
                              label: 'الأعمال',
                              value: 'business',
                              current: _filterCategory,
                              color: const Color(0xFF6366F1),
                              onTap: (v) =>
                                  setState(() => _filterCategory = v)),
                          _FilterChip(
                              label: 'السكني',
                              value: 'residential',
                              current: _filterCategory,
                              color: const Color(0xFF10B981),
                              onTap: (v) =>
                                  setState(() => _filterCategory = v)),
                          _FilterChip(
                              label: 'المجاور',
                              value: 'surrounding',
                              current: _filterCategory,
                              color: const Color(0xFFF59E0B),
                              onTap: (v) =>
                                  setState(() => _filterCategory = v)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // ─── بطاقة الموقع المختار (أسفل) ────────────────────────────────
          if (_selectedMinistry != null)
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: SafeArea(
                top: false,
                child: Container(
                  margin: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.14),
                        blurRadius: 20,
                        offset: const Offset(0, -4),
                      ),
                    ],
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // معلومات الموقع المختار
                        Row(
                          children: [
                            Container(
                              width: 46,
                              height: 46,
                              decoration: BoxDecoration(
                                color:
                                    AppColors.primary.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(
                                Icons.location_on_rounded,
                                color: AppColors.primary,
                                size: 24,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    _selectedMinistry!.nameArabic,
                                    style: GoogleFonts.cairo(
                                      fontSize: 13.5,
                                      fontWeight: FontWeight.bold,
                                      color: AppColors.navy,
                                    ),
                                  ),
                                  Text(
                                    _selectedMinistry!.sector,
                                    style: GoogleFonts.cairo(
                                      fontSize: 11.5,
                                      color: AppColors.textSecondary,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 12),

                        // بيانات التوصيل (المسافة + السعر + الوقت)
                        if (_deliveryInfo != null) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 10),
                            decoration: BoxDecoration(
                              color: _deliveryInfo!.isAvailable
                                  ? Color(_deliveryInfo!.zoneColor)
                                      .withValues(alpha: 0.08)
                                  : Colors.red.shade50,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: _deliveryInfo!.isAvailable
                                    ? Color(_deliveryInfo!.zoneColor)
                                        .withValues(alpha: 0.3)
                                    : Colors.red.shade200,
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  _deliveryInfo!.isAvailable
                                      ? Icons.electric_moped_rounded
                                      : Icons.block_rounded,
                                  color: _deliveryInfo!.isAvailable
                                      ? Color(_deliveryInfo!.zoneColor)
                                      : Colors.red.shade600,
                                  size: 20,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        _deliveryInfo!.isAvailable
                                            ? _deliveryInfo!.zoneName
                                            : 'خارج نطاق التوصيل',
                                        style: GoogleFonts.cairo(
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                          color: _deliveryInfo!.isAvailable
                                              ? Color(
                                                  _deliveryInfo!.zoneColor)
                                              : Colors.red.shade700,
                                        ),
                                      ),
                                      if (_deliveryInfo!.isAvailable)
                                        Text(
                                          'وقت الوصول: ${_deliveryInfo!.etaMinutes} دقيقة',
                                          style: GoogleFonts.cairo(
                                            fontSize: 11,
                                            color: AppColors.textSecondary,
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      _deliveryInfo!.distanceLabel,
                                      style: GoogleFonts.cairo(
                                        fontSize: 11,
                                        color: AppColors.textSecondary,
                                      ),
                                    ),
                                    Text(
                                      _deliveryInfo!.isAvailable
                                          ? '${_deliveryInfo!.feePerStore.toStringAsFixed(0)} جنيه / متجر'
                                          : '—',
                                      style: GoogleFonts.cairo(
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.bold,
                                        color: _deliveryInfo!.isAvailable
                                            ? Color(_deliveryInfo!.zoneColor)
                                            : Colors.red.shade700,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                        ],

                        // زر التأكيد
                        SizedBox(
                          width: double.infinity,
                          height: 50,
                          child: ElevatedButton.icon(
                            onPressed: _deliveryInfo?.isAvailable == true
                                ? _confirm
                                : null,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              disabledBackgroundColor:
                                  const Color(0xFFCBD5E1),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                              elevation: 0,
                            ),
                            icon: const Icon(Icons.check_circle_rounded,
                                color: Colors.white, size: 20),
                            label: Text(
                              _deliveryInfo?.isAvailable == true
                                  ? 'تأكيد موقع التوصيل'
                                  : 'هذا الموقع غير متاح للتوصيل',
                              style: GoogleFonts.cairo(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ─── علامة الفود كورت ────────────────────────────────────────────────────────
class _FoodCourtMarker extends StatelessWidget {
  final AnimationController pulseCtrl;
  const _FoodCourtMarker({required this.pulseCtrl});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: pulseCtrl,
      builder: (_, __) {
        final scale = 1.0 + pulseCtrl.value * 0.2;
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 34 * scale,
              height: 34 * scale,
              decoration: BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2.5),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.4),
                    blurRadius: 12,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: const Icon(Icons.storefront_rounded,
                  color: Colors.white, size: 16),
            ),
            Container(
              width: 2,
              height: 8,
              color: AppColors.primary,
            ),
          ],
        );
      },
    );
  }
}

// ─── علامة الوزارة/الموقع ────────────────────────────────────────────────────
class _MinistryMarker extends StatelessWidget {
  final MinistryModel ministry;
  final bool isSelected;
  final Color color;

  const _MinistryMarker({
    required this.ministry,
    required this.isSelected,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final size = isSelected ? 40.0 : 28.0;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            border: Border.all(
              color: Colors.white,
              width: isSelected ? 3 : 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: isSelected ? 0.5 : 0.25),
                blurRadius: isSelected ? 14 : 6,
                spreadRadius: isSelected ? 2 : 0,
              ),
            ],
          ),
          child: Icon(
            _categoryIcon(ministry.category),
            color: Colors.white,
            size: isSelected ? 18 : 12,
          ),
        ),
        Container(
          width: 2,
          height: isSelected ? 10 : 6,
          color: color,
        ),
      ],
    );
  }

  IconData _categoryIcon(String cat) {
    switch (cat) {
      case 'government':
        return Icons.account_balance_rounded;
      case 'business':
        return Icons.domain_rounded;
      case 'residential':
        return Icons.home_rounded;
      case 'surrounding':
        return Icons.location_city_rounded;
      case 'downtown':
        return Icons.shopping_bag_rounded;
      default:
        return Icons.place_rounded;
    }
  }
}

// ─── شريحة فلتر الفئة ────────────────────────────────────────────────────────
class _FilterChip extends StatelessWidget {
  final String label;
  final String value;
  final String current;
  final Color color;
  final Function(String) onTap;

  const _FilterChip({
    required this.label,
    required this.value,
    required this.current,
    this.color = AppColors.primary,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final active = current == value;
    return GestureDetector(
      onTap: () => onTap(value),
      child: Container(
        margin: const EdgeInsetsDirectional.only(end: 6),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        decoration: BoxDecoration(
          color: active ? color : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: active ? color : Colors.transparent,
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.cairo(
            fontSize: 11.5,
            fontWeight: FontWeight.w600,
            color: active ? Colors.white : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}
