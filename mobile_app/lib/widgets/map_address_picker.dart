import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import '../core/constants/colors.dart';
import '../core/utils/distance_helper.dart';

class QuickMapArea {
  final String name;
  final double lat;
  final double lng;
  final IconData icon;

  const QuickMapArea({
    required this.name,
    required this.lat,
    required this.lng,
    this.icon = Icons.location_city_rounded,
  });
}

class PlaceSearchResult {
  final String displayName;
  final double lat;
  final double lng;

  const PlaceSearchResult({
    required this.displayName,
    required this.lat,
    required this.lng,
  });
}

/// شاشة اختيار وتحديد الموقع الحقيقي مباشرة من الخريطة بالـ GPS والإحداثيات الدقيقة (X, Y)
/// مع ميزة البحث الفوري عن المدن والأحياء وأزرار الانتقال السريع لمناطق الشروق والعاصمة
class MapAddressPickerScreen extends StatefulWidget {
  final double? initialLat;
  final double? initialLng;
  final String? initialTitle;
  final String? initialDetails;

  const MapAddressPickerScreen({
    super.key,
    this.initialLat,
    this.initialLng,
    this.initialTitle,
    this.initialDetails,
  });

  @override
  State<MapAddressPickerScreen> createState() => _MapAddressPickerScreenState();
}

class _MapAddressPickerScreenState extends State<MapAddressPickerScreen> {
  late final MapController _mapController;
  late LatLng _selectedLocation;
  bool _isLocating = false;
  bool _isGeocoding = false;
  Timer? _debounceTimer;

  // البحث عن العناوين والأماكن
  final TextEditingController _searchController = TextEditingController();
  List<PlaceSearchResult> _searchResults = [];
  bool _isSearching = false;
  Timer? _searchDebounceTimer;

  String _detectedAddressText = '';
  String _detectedCity = '';
  String _detectedDistrict = '';
  String _detectedStreet = '';
  final TextEditingController _titleController = TextEditingController(text: 'المنزل');
  final TextEditingController _detailsController = TextEditingController();
  final TextEditingController _notesController = TextEditingController();
  bool _isDefault = true;

  final List<String> _quickLabels = ['المنزل', 'العمل', 'استراحة', 'أخرى'];

  // المناطق الأكثر طلباً للانتقال السريع بلمسة واحدة بأسمائها الجغرافية الحقيقية الموثقة
  static const List<QuickMapArea> _popularAreas = [
    QuickMapArea(
      name: 'العاصمة الإدارية (الحي الحكومي)',
      lat: 30.0150,
      lng: 31.7450,
      icon: Icons.account_balance_rounded,
    ),
    QuickMapArea(
      name: 'الحي السكني R3 (كابيتال ريزيدنس)',
      lat: 30.0280,
      lng: 31.7200,
      icon: Icons.home_work_rounded,
    ),
    QuickMapArea(
      name: 'الحي السكني R5 (جاردن سيتي)',
      lat: 30.0050,
      lng: 31.7100,
      icon: Icons.villa_rounded,
    ),
    QuickMapArea(
      name: 'حي المال والأعمال (البرج الأيقوني)',
      lat: 30.0180,
      lng: 31.7350,
      icon: Icons.business_rounded,
    ),
    QuickMapArea(
      name: 'الكيان العسكري (الأوكتاجون)',
      lat: 30.0050,
      lng: 31.6750,
      icon: Icons.shield_rounded,
    ),
    QuickMapArea(
      name: 'مدينة الشروق',
      lat: 30.1375,
      lng: 31.6215,
      icon: Icons.apartment_rounded,
    ),
    QuickMapArea(
      name: 'زهراء العاصمة',
      lat: 30.1250,
      lng: 31.7350,
      icon: Icons.holiday_village_rounded,
    ),
    QuickMapArea(
      name: 'مدينتي',
      lat: 30.0980,
      lng: 31.6450,
      icon: Icons.park_rounded,
    ),
    QuickMapArea(
      name: 'مدينة بدر',
      lat: 30.1350,
      lng: 31.7300,
      icon: Icons.location_city_rounded,
    ),
    QuickMapArea(
      name: 'التجمع الخامس / القاهرة الجديدة',
      lat: 30.0100,
      lng: 31.4300,
      icon: Icons.business_rounded,
    ),
  ];

  @override
  void initState() {
    super.initState();
    _mapController = MapController();

    // إحداثيات مبدئية: إما الممررة أو العاصمة الإدارية
    final lat = widget.initialLat ?? 30.0150;
    final lng = widget.initialLng ?? 31.7450;
    _selectedLocation = LatLng(lat, lng);

    if (widget.initialTitle != null && widget.initialTitle!.isNotEmpty) {
      _titleController.text = widget.initialTitle!;
    }
    if (widget.initialDetails != null && widget.initialDetails!.isNotEmpty) {
      _detailsController.text = widget.initialDetails!;
      _detectedAddressText = widget.initialDetails!;
    }

    // إذا لم تُمرر إحداثيات سابقة صريحة، نطلب الموقع الحي مباشرة بالـ GPS الحقيقي
    if (widget.initialLat == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _getCurrentLocation(animate: true);
      });
    } else {
      _reverseGeocode(_selectedLocation.latitude, _selectedLocation.longitude);
    }
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _searchDebounceTimer?.cancel();
    _searchController.dispose();
    _titleController.dispose();
    _detailsController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  /// البحث الحي عن الأماكن والمدن والأحياء
  void _onSearchChanged(String query) {
    _searchDebounceTimer?.cancel();
    final trimmed = query.trim();
    if (trimmed.isEmpty) {
      setState(() {
        _searchResults = [];
        _isSearching = false;
      });
      return;
    }

    _searchDebounceTimer = Timer(const Duration(milliseconds: 400), () async {
      if (!mounted) return;
      setState(() => _isSearching = true);
      try {
        final uri = Uri.parse(
          'https://nominatim.openstreetmap.org/search?q=${Uri.encodeComponent(trimmed)}&countrycodes=eg&format=json&limit=5&accept-language=ar',
        );
        final response = await http.get(
          uri,
          headers: {'User-Agent': 'CapitalTalabatApp/1.0 (support@capitaltalabat.com)'},
        ).timeout(const Duration(seconds: 5));

        if (response.statusCode == 200 && mounted) {
          final list = jsonDecode(response.body) as List<dynamic>;
          final results = list
              .map((item) {
                final m = item as Map<String, dynamic>;
                return PlaceSearchResult(
                  displayName: m['display_name'] as String? ?? '',
                  lat: double.tryParse(m['lat']?.toString() ?? '') ?? 0.0,
                  lng: double.tryParse(m['lon']?.toString() ?? '') ?? 0.0,
                );
              })
              .where((r) => r.lat != 0.0 && r.lng != 0.0)
              .toList();

          setState(() {
            _searchResults = results;
            _isSearching = false;
          });
        }
      } catch (e) {
        debugPrint('Search error: $e');
        if (mounted) setState(() => _isSearching = false);
      }
    });
  }

  void _selectSearchResult(PlaceSearchResult result) {
    final location = LatLng(result.lat, result.lng);
    setState(() {
      _selectedLocation = location;
      _searchResults = [];
      _searchController.clear();
      FocusScope.of(context).unfocus();
    });
    _mapController.move(location, 16.0);
    _reverseGeocode(result.lat, result.lng);
  }

  void _selectQuickArea(QuickMapArea area) {
    final location = LatLng(area.lat, area.lng);
    setState(() {
      _selectedLocation = location;
      _searchResults = [];
      _searchController.clear();
      FocusScope.of(context).unfocus();
    });
    _mapController.move(location, 16.0);
    _reverseGeocode(area.lat, area.lng);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: AppColors.navy,
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        content: Row(
          children: [
            const Icon(Icons.check_circle_rounded, color: Colors.greenAccent, size: 20),
            const SizedBox(width: 8),
            Text(
              'تم الانتقال إلى: ${area.name}',
              style: GoogleFonts.cairo(fontSize: 12, fontWeight: FontWeight.bold),
            ),
          ],
        ),
      ),
    );
  }

  /// التقاط موقع المستخدم الحقيقي عبر الـ GPS بدقة عالية
  Future<void> _getCurrentLocation({bool animate = true}) async {
    setState(() => _isLocating = true);
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.deniedForever) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'يرجى تفعيل إذن الموقع من إعدادات الهاتف لتحديد موقعك تلقائياً',
              style: GoogleFonts.cairo(),
            ),
            backgroundColor: Colors.red.shade700,
          ),
        );
        setState(() => _isLocating = false);
        return;
      }

      Position? position;
      // 1. فحص فوري لآخر موقع مسجل بالجهاز بدون تعليق
      try {
        position = await Geolocator.getLastKnownPosition();
      } catch (_) {}

      // 2. إذا لم يتوفر، طلب الموقع الحالي بمهلة 5 ثوانٍ
      position ??= await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 5),
        ),
      );

      // نعتمد الإحداثيات الحقيقية المباشرة من نظام تحديد المواقع بدقة 100%
      final newLocation = LatLng(position.latitude, position.longitude);

      if (mounted) {
        setState(() {
          _selectedLocation = newLocation;
          _isLocating = false;
        });

        if (animate) {
          _mapController.move(newLocation, 16.0);
        }

        _reverseGeocode(newLocation.latitude, newLocation.longitude);
      }
    } catch (e) {
      debugPrint('Geolocator error or timeout: $e');
      if (mounted) {
        setState(() => _isLocating = false);
        // في حال تعذر التقاط إشارة GPS، نبقى على الموقع الحالي ونقرأ عنوانه
        _reverseGeocode(_selectedLocation.latitude, _selectedLocation.longitude);
      }
    }
  }

  /// جلب اسم الشارع / الحي / المدينة تلقائياً من خريطة OpenStreetMap الحقيقية بدون أي تعديل أو اختلاق
  Future<void> _reverseGeocode(double lat, double lng) async {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 500), () async {
      if (!mounted) return;
      setState(() => _isGeocoding = true);
      try {
        final uri = Uri.parse(
          'https://nominatim.openstreetmap.org/reverse?format=json&lat=$lat&lon=$lng&zoom=18&addressdetails=1&accept-language=ar',
        );
        final response = await http.get(
          uri,
          headers: {'User-Agent': 'CapitalTalabatApp/1.0 (support@capitaltalabat.com)'},
        ).timeout(const Duration(seconds: 5));

        if (response.statusCode == 200 && mounted) {
          final data = jsonDecode(response.body) as Map<String, dynamic>;
          final address = data['address'] as Map<String, dynamic>?;

          String generated = '';
          if (address != null) {
            _detectedStreet = (address['road'] ?? address['street'] ?? address['amenity'] ?? address['building'] ?? '').toString().trim();
            _detectedDistrict = (address['suburb'] ?? address['neighbourhood'] ?? address['quarter'] ?? address['residential'] ?? address['city_district'] ?? '').toString().trim();
            _detectedCity = (address['city'] ?? address['town'] ?? address['village'] ?? address['municipality'] ?? address['county'] ?? address['state'] ?? '').toString().trim();

            final parts = [_detectedStreet, _detectedDistrict, _detectedCity].where((s) => s.isNotEmpty).toSet().toList();
            if (parts.isNotEmpty) {
              generated = parts.join('، ');
            }
          }

          if (generated.isEmpty) {
            generated = (data['display_name'] as String?) ?? 'الموقع المحدد على الخريطة';
          }

          setState(() {
            _detectedAddressText = generated;
            _detailsController.text = generated;
          });
        }
      } catch (e) {
        debugPrint('Reverse geocode error: $e');
      } finally {
        if (mounted) {
          setState(() => _isGeocoding = false);
        }
      }
    });
  }

  void _onConfirmAddress() {
    final details = _detailsController.text.trim().isNotEmpty
        ? _detailsController.text.trim()
        : (_detectedAddressText.isNotEmpty ? _detectedAddressText : 'الموقع المحدد على الخريطة');

    final title = _titleController.text.trim().isNotEmpty
        ? _titleController.text.trim()
        : (_detectedDistrict.isNotEmpty
            ? _detectedDistrict
            : (_detectedCity.isNotEmpty ? _detectedCity : details));

    final result = {
      'title': title,
      'city': _detectedCity,
      'district': _detectedDistrict,
      'street': _detectedStreet,
      'address': details,
      'details': details,
      'lat': _selectedLocation.latitude,  // Y
      'lng': _selectedLocation.longitude, // X
      'notes': _notesController.text.trim(),
      'isDefault': _isDefault,
    };

    Navigator.of(context).pop(result);
  }

  @override
  Widget build(BuildContext context) {
    // حساب المسافة الحقيقية من المركز
    final distanceToCenterKm = DistanceHelper.distanceToCustomer(
      customerLat: _selectedLocation.latitude,
      customerLng: _selectedLocation.longitude,
    );
    final distanceText = DistanceHelper.formatDistance(distanceToCenterKm);
    final deliveryEstimate = DistanceHelper.formatDeliveryTime(distanceToCenterKm);
    final zoneName = DistanceHelper.getZoneName(
      customerLat: _selectedLocation.latitude,
      customerLng: _selectedLocation.longitude,
      addressHint: _detectedCity.isNotEmpty ? _detectedCity : _detectedAddressText,
    );

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.navy, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          'تحديد موقع التوصيل على الخريطة',
          style: GoogleFonts.cairo(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: AppColors.navy,
          ),
        ),
        actions: [
          IconButton(
            icon: _isLocating
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                  )
                : const Icon(Icons.my_location_rounded, color: AppColors.primary),
            tooltip: 'موقعي الحالي (GPS)',
            onPressed: _isLocating ? null : () => _getCurrentLocation(animate: true),
          ),
        ],
      ),
      body: Column(
        children: [
          // ─── الجزء العلوي: خريطة تفاعلية حية مع شريط البحث والمناطق السريعة ───
          Expanded(
            flex: 6,
            child: Stack(
              children: [
                FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: _selectedLocation,
                    initialZoom: 15.0,
                    minZoom: 5.0,
                    maxZoom: 18.0,
                    onPositionChanged: (camera, hasGesture) {
                      if (hasGesture) {
                        setState(() {
                          _selectedLocation = camera.center;
                        });
                        _reverseGeocode(camera.center.latitude, camera.center.longitude);
                      }
                    },
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.capitaltalabat.app',
                    ),
                  ],
                ),

                // دبوس التوصيل الثابت في المنتصف (مع توجيه رأس الدبوس لمركز الخريطة بدقة 100%)
                Center(
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // نقطة ظل الارتكاز على الأرض
                      Container(
                        width: 8,
                        height: 5,
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.35),
                          borderRadius: BorderRadius.circular(5),
                        ),
                      ),
                      // رأس الدبوس ينتهي تماماً عند مركز الشاشة
                      FractionalTranslation(
                        translation: const Offset(0.0, -0.5),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppColors.navy,
                                borderRadius: BorderRadius.circular(20),
                                boxShadow: const [
                                  BoxShadow(color: Colors.black26, blurRadius: 8, offset: Offset(0, 3)),
                                ],
                              ),
                              child: Text(
                                'الموقع المحدد للتوصيل',
                                style: GoogleFonts.cairo(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                            const SizedBox(height: 4),
                            const Icon(
                              Icons.location_on_rounded,
                              size: 46,
                              color: AppColors.primary,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                // ─── شريط البحث السريع عن الأماكن والمدن ───
                Positioned(
                  top: 10,
                  left: 12,
                  right: 12,
                  child: Column(
                    children: [
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: const [
                            BoxShadow(color: Colors.black12, blurRadius: 10, offset: Offset(0, 3)),
                          ],
                        ),
                        child: TextField(
                          controller: _searchController,
                          onChanged: _onSearchChanged,
                          style: GoogleFonts.cairo(fontSize: 13, color: AppColors.navy),
                          decoration: InputDecoration(
                            hintText: 'ابحث عن مدينة، حي، شارع (مثال: مدينة الشروق)...',
                            hintStyle: GoogleFonts.cairo(fontSize: 12, color: AppColors.textMuted),
                            prefixIcon: const Icon(Icons.search_rounded, color: AppColors.primary, size: 22),
                            suffixIcon: _searchController.text.isNotEmpty
                                ? IconButton(
                                    icon: const Icon(Icons.clear_rounded, size: 18, color: AppColors.textMuted),
                                    onPressed: () {
                                      _searchController.clear();
                                      setState(() => _searchResults = []);
                                    },
                                  )
                                : (_isSearching
                                    ? const Padding(
                                        padding: EdgeInsets.all(12),
                                        child: SizedBox(
                                          width: 16,
                                          height: 16,
                                          child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                                        ),
                                      )
                                    : null),
                            border: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          ),
                        ),
                      ),

                      // نتائج البحث المقترحة
                      if (_searchResults.isNotEmpty)
                        Container(
                          margin: const EdgeInsets.only(top: 6),
                          constraints: const BoxConstraints(maxHeight: 200),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            boxShadow: const [
                              BoxShadow(color: Colors.black26, blurRadius: 12, offset: Offset(0, 4)),
                            ],
                          ),
                          child: ListView.separated(
                            shrinkWrap: true,
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            itemCount: _searchResults.length,
                            separatorBuilder: (_, _) => const Divider(height: 1),
                            itemBuilder: (context, index) {
                              final item = _searchResults[index];
                              return ListTile(
                                dense: true,
                                leading: const Icon(Icons.location_on_outlined, color: AppColors.primary, size: 20),
                                title: Text(
                                  item.displayName,
                                  style: GoogleFonts.cairo(fontSize: 12, fontWeight: FontWeight.w600),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                onTap: () => _selectSearchResult(item),
                              );
                            },
                          ),
                        ),

                      const SizedBox(height: 8),

                      // أزرار الانتقال السريع للمناطق الشهيرة (الشروق، العاصمة، بدر، مدينتي...)
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        physics: const BouncingScrollPhysics(),
                        child: Row(
                          children: _popularAreas.map((area) {
                            final isNearby = (area.lat - _selectedLocation.latitude).abs() < 0.03 &&
                                (area.lng - _selectedLocation.longitude).abs() < 0.03;

                            return Padding(
                              padding: const EdgeInsets.only(left: 6),
                              child: ActionChip(
                                avatar: Icon(
                                  area.icon,
                                  size: 15,
                                  color: isNearby ? Colors.white : AppColors.primary,
                                ),
                                label: Text(area.name),
                                backgroundColor: isNearby ? AppColors.primary : Colors.white.withValues(alpha: 0.95),
                                labelStyle: GoogleFonts.cairo(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.bold,
                                  color: isNearby ? Colors.white : AppColors.navy,
                                ),
                                elevation: 2,
                                pressElevation: 4,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(20),
                                  side: BorderSide(
                                    color: isNearby ? AppColors.primary : const Color(0xFFE2E8F0),
                                  ),
                                ),
                                onPressed: () => _selectQuickArea(area),
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                    ],
                  ),
                ),

                // شارة توثيق الموقع الجغرافي دون إظهار أرقام X, Y التقنية
                Positioned(
                  bottom: 16,
                  right: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.95),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      boxShadow: const [
                        BoxShadow(color: Colors.black12, blurRadius: 6, offset: Offset(0, 2)),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: Colors.green,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          _detectedDistrict.isNotEmpty
                              ? '📍 $_detectedDistrict${_detectedCity.isNotEmpty ? '، $_detectedCity' : ''}'
                              : (_detectedCity.isNotEmpty ? '📍 $_detectedCity' : '📍 موقع جغرافي موثق بالخريطة'),
                          style: GoogleFonts.cairo(
                            fontSize: 11.5,
                            fontWeight: FontWeight.bold,
                            color: AppColors.navy,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // زر موقعي الحالي (Floating GPS Action Button)
                Positioned(
                  bottom: 16,
                  left: 12,
                  child: FloatingActionButton.extended(
                    heroTag: 'gps_fab_btn',
                    onPressed: _isLocating ? null : () => _getCurrentLocation(animate: true),
                    backgroundColor: Colors.white,
                    elevation: 4,
                    icon: _isLocating
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                          )
                        : const Icon(Icons.my_location_rounded, color: AppColors.primary, size: 20),
                    label: Text(
                      'موقعي الحالي',
                      style: GoogleFonts.cairo(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: AppColors.navy,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // ─── الجزء السفلي: تفاصيل العنوان واسمه وتأكيد الحفظ ───
          Expanded(
            flex: 5,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                boxShadow: [
                  BoxShadow(color: Colors.black12, blurRadius: 16, offset: Offset(0, -4)),
                ],
              ),
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // شريط معلومات المسافة ووقت التوصيل التقديري
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.primaryContainer.withValues(alpha: 0.4),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.two_wheeler_rounded, color: AppColors.primary, size: 22),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'نطاق التغطية: $zoneName (المسافة لأقرب فرع: $distanceText)',
                                  style: GoogleFonts.cairo(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.navy,
                                  ),
                                ),
                                Text(
                                  'معدل وقت التوصيل للمندوب: $deliveryEstimate',
                                  style: GoogleFonts.cairo(
                                    fontSize: 11,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),

                    // اختيار تسمية العنوان
                    Text(
                      'تسمية العنوان',
                      style: GoogleFonts.cairo(
                        fontSize: 12.5,
                        fontWeight: FontWeight.bold,
                        color: AppColors.navy,
                      ),
                    ),
                    const SizedBox(height: 6),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: _quickLabels.map((lbl) {
                          final isSelected = _titleController.text.trim() == lbl;
                          return Padding(
                            padding: const EdgeInsets.only(left: 8),
                            child: ChoiceChip(
                              label: Text(lbl),
                              selected: isSelected,
                              selectedColor: AppColors.primary,
                              labelStyle: GoogleFonts.cairo(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: isSelected ? Colors.white : AppColors.navy,
                              ),
                              backgroundColor: const Color(0xFFF1F5F9),
                              onSelected: (_) {
                                setState(() => _titleController.text = lbl);
                              },
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                    const SizedBox(height: 10),

                    // حقل العنوان بالتفصيل (اسم الشارع، المبنى، الدور، الشقة/المكتب)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'العنوان بالتفصيل',
                          style: GoogleFonts.cairo(
                            fontSize: 12.5,
                            fontWeight: FontWeight.bold,
                            color: AppColors.navy,
                          ),
                        ),
                        if (_isGeocoding)
                          Row(
                            children: [
                              const SizedBox(
                                width: 12,
                                height: 12,
                                child: CircularProgressIndicator(strokeWidth: 1.5, color: AppColors.primary),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                'جاري كشف اسم المنطقة...',
                                style: GoogleFonts.cairo(fontSize: 10.5, color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _detailsController,
                      maxLines: 2,
                      decoration: InputDecoration(
                        hintText: 'اسم الشارع، رقم المبنى/الفيلا، الدور، رقم الشقة أو المكتب...',
                        hintStyle: GoogleFonts.cairo(fontSize: 12, color: const Color(0xFF94A3B8)),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                        ),
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                      style: GoogleFonts.cairo(fontSize: 13, color: AppColors.navy),
                    ),
                    const SizedBox(height: 10),

                    // ملاحظات إضافية للمندوب
                    Text(
                      'ملاحظات إضافية لمندوب التوصيل (اختياري)',
                      style: GoogleFonts.cairo(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: AppColors.navy,
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _notesController,
                      decoration: InputDecoration(
                        hintText: 'مثال: رن الجرس، الاتصال عند البوابة، ترك الطلب عند الأمن...',
                        hintStyle: GoogleFonts.cairo(fontSize: 12, color: const Color(0xFF94A3B8)),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                        ),
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      ),
                      style: GoogleFonts.cairo(fontSize: 12.5),
                    ),
                    const SizedBox(height: 8),

                    // تعيين كعنوان رئيسي
                    Row(
                      children: [
                        Checkbox(
                          value: _isDefault,
                          activeColor: AppColors.primary,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                          onChanged: (val) => setState(() => _isDefault = val ?? false),
                        ),
                        Text(
                          'تعيين كعنوان رئيسي للتوصيل',
                          style: GoogleFonts.cairo(fontSize: 12.5, fontWeight: FontWeight.bold, color: AppColors.navy),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    // زر حفظ وتأكيد العنوان
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton(
                        onPressed: _onConfirmAddress,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          elevation: 0,
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
                            const SizedBox(width: 8),
                            Text(
                              'تأكيد وحفظ العنوان',
                              style: GoogleFonts.cairo(
                                fontSize: 14.5,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
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
          ),
        ],
      ),
    );
  }
}
