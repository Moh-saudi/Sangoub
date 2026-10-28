import '../../core/services/api_service.dart';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/constants/colors.dart';
import '../../core/utils/distance_helper.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/map_address_picker.dart';

class SavedAddressesScreen extends StatefulWidget {
  const SavedAddressesScreen({super.key});

  @override
  State<SavedAddressesScreen> createState() => _SavedAddressesScreenState();
}

class _SavedAddressesScreenState extends State<SavedAddressesScreen> {
  final List<Map<String, dynamic>> _addresses = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadAddresses();
  }

  /// تحميل العناوين المحفوظة محلياً أو من الحساب
  Future<void> _loadAddresses() async {
    setState(() => _isLoading = true);
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedJson = prefs.getString('saved_user_addresses');

      if (savedJson != null && savedJson.isNotEmpty) {
        final List<dynamic> decoded = jsonDecode(savedJson);
        _addresses.clear();
        for (final item in decoded) {
          if (item is Map<String, dynamic>) {
            _addresses.add(Map<String, dynamic>.from(item));
          }
        }
      }

      // إذا كانت القائمة فارغة وكان هناك عنوان مسجل في بروفايل المستخدم
      if (_addresses.isEmpty && mounted) {
        final user = Provider.of<AuthProvider>(context, listen: false).currentUser;
        if (user != null) {
          final lat = user.coordinates?['latitude'] ?? DistanceHelper.defaultCapitalLat;
          final lng = user.coordinates?['longitude'] ?? DistanceHelper.defaultCapitalLng;
          final title = user.ministry.isNotEmpty && user.ministry != 'غير محدد'
              ? user.ministry
              : 'عنواني الأساسي';
          final details = [
            if (user.floorNumber.isNotEmpty && user.floorNumber != 'غير محدد') user.floorNumber,
            if (user.roomNumber.isNotEmpty && user.roomNumber != 'غير محدد') user.roomNumber,
          ].join(' • ');

          _addresses.add({
            'title': title,
            'address': details.isNotEmpty ? details : 'العاصمة الإدارية',
            'details': details.isNotEmpty ? details : 'العاصمة الإدارية',
            'lat': lat,
            'lng': lng,
            'isDefault': true,
          });
          await _persistAddresses();
        }
      }
    } catch (e) {
      debugPrint('Error loading saved addresses: $e');
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  /// حفظ قائمة العناوين في التخزين الدائم
  Future<void> _persistAddresses() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('saved_user_addresses', jsonEncode(_addresses));
    } catch (e) {
      debugPrint('Error persisting addresses: $e');
    }
  }

  /// فتح شاشة الخريطة الحية لاختيار الموقع الحقيقي وتأكيد الإحداثيات (X, Y)
  Future<void> _openMapAddressPicker({Map<String, dynamic>? existingAddress, int? editIndex}) async {
    final result = await Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute(
        builder: (_) => MapAddressPickerScreen(
          initialLat: (existingAddress?['lat'] as num?)?.toDouble(),
          initialLng: (existingAddress?['lng'] as num?)?.toDouble(),
          initialTitle: existingAddress?['title'] as String?,
          initialDetails: (existingAddress?['details'] ?? existingAddress?['address']) as String?,
        ),
      ),
    );

    if (result != null && mounted) {
      setState(() {
        final isDefault = result['isDefault'] == true || _addresses.isEmpty;

        if (isDefault) {
          for (final a in _addresses) {
            a['isDefault'] = false;
          }
        }

        final entry = {
          'title': result['title'],
          'city': result['city'] ?? '',
          'district': result['district'] ?? '',
          'street': result['street'] ?? '',
          'address': result['address'],
          'details': result['details'],
          'lat': result['lat'], // Y
          'lng': result['lng'], // X
          'notes': result['notes'],
          'isDefault': isDefault,
        };

        if (editIndex != null && editIndex < _addresses.length) {
          _addresses[editIndex] = entry;
        } else {
          _addresses.add(entry);
        }
      });

      await _persistAddresses();
      String saveMessage = 'تم حفظ العنوان على هذا الجهاز.';

      // تسجيل وتحديث العنوان في بروفايل المستخدم بـ Firestore ليكون مرجعاً أساسياً
      if (mounted) {
        try {
          final auth = Provider.of<AuthProvider>(context, listen: false);
          if (auth.currentUser != null) {
            final addressData = {
              'title': result['title'],
              'city': result['city'] ?? '',
              'district': result['district'] ?? '',
              'street': result['street'] ?? '',
              'fullAddress': result['address'] ?? result['details'],
              'details': result['details'],
              'coordinates': {'lat': result['lat'], 'lng': result['lng']},
              'notes': result['notes'] ?? '',
            };

            final bool isDef = result['isDefault'] == true || _addresses.length == 1;
            if (isDef) {
              final safeAddress = Map<String, dynamic>.from(addressData);
              await ApiService().saveDefaultAddress(safeAddress);
              saveMessage = 'تم حفظ العنوان الافتراضي في حسابك.';
            }
          }
        } catch (e) {
          saveMessage = 'حُفظ محلياً؛ تعذرت مزامنة العنوان مع حسابك.';
          debugPrint('Error updating user profile with address reference: $e');
        }
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
                const SizedBox(width: 8),
                Text(
                  saveMessage,
                  style: GoogleFonts.cairo(fontWeight: FontWeight.bold),
                ),
              ],
            ),
            backgroundColor: const Color(0xFF16A34A),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  /// تعيين عنوان كافتراضي
  Future<void> _setDefaultAddress(int index) async {
    setState(() {
      for (int i = 0; i < _addresses.length; i++) {
        _addresses[i]['isDefault'] = (i == index);
      }
    });
    await _persistAddresses();

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('تم تعيين العنوان كعنوان رئيسي للتوصيل', style: GoogleFonts.cairo()),
          backgroundColor: AppColors.navy,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  /// حذف عنوان
  Future<void> _deleteAddress(int index) async {
    setState(() {
      _addresses.removeAt(index);
      if (_addresses.isNotEmpty && !_addresses.any((a) => a['isDefault'] == true)) {
        _addresses.first['isDefault'] = true;
      }
    });
    await _persistAddresses();
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
          'Addresses / عناويني',
          style: GoogleFonts.cairo(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Colors.black,
          ),
        ),
        actions: [
          if (_addresses.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(left: 12),
              child: IconButton(
                icon: const Icon(Icons.add_location_alt_rounded, color: AppColors.primary),
                tooltip: 'إضافة عنوان من الخريطة',
                onPressed: () => _openMapAddressPicker(),
              ),
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : (_addresses.isEmpty ? _buildEmptyState() : _buildAddressList()),
    );
  }

  // ─── واجهة العناوين الفارغة مع زر الإضافة المباشر من الخريطة ───
  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Custom Pin Icon
            Container(
              width: 110,
              height: 110,
              alignment: Alignment.center,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    width: 78,
                    height: 96,
                    decoration: const BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.all(Radius.circular(39)),
                    ),
                    child: Center(
                      child: Container(
                        width: 48,
                        height: 48,
                        decoration: const BoxDecoration(
                          color: Color(0xFFFFF7ED),
                          shape: BoxShape.circle,
                        ),
                        child: const Center(
                          child: Icon(Icons.location_on_rounded, size: 30, color: AppColors.primary),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            Text(
              'لا توجد عناوين مسجلة',
              style: GoogleFonts.cairo(
                fontSize: 19,
                fontWeight: FontWeight.bold,
                color: AppColors.navy,
              ),
            ),
            const SizedBox(height: 6),

            Text(
              'حدد موقعك بدقة من الخريطة بالـ GPS لحساب مسافة التوصيل وأجر المندوب بدقة',
              textAlign: TextAlign.center,
              style: GoogleFonts.cairo(
                fontSize: 13,
                color: const Color(0xFF94A3B8),
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 32),

            // زر إضافة العنوان من الخريطة
            SizedBox(
              height: 48,
              child: ElevatedButton.icon(
                onPressed: () => _openMapAddressPicker(),
                icon: const Icon(Icons.map_rounded, color: Colors.white, size: 20),
                label: Text(
                  'تحديد الموقع من الخريطة (GPS)',
                  style: GoogleFonts.cairo(
                    fontSize: 13.5,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(24),
                  ),
                  elevation: 0,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── قائمة العناوين المحفوظة مع الإحداثيات الحقيقية والمسافات ───
  Widget _buildAddressList() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _addresses.length + 1,
      itemBuilder: (ctx, i) {
        if (i == _addresses.length) {
          return Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 20),
            child: OutlinedButton.icon(
              onPressed: () => _openMapAddressPicker(),
              icon: const Icon(Icons.add_location_alt_rounded, color: AppColors.primary),
              label: Text(
                'إضافة عنوان جديد من الخريطة (GPS)',
                style: GoogleFonts.cairo(fontWeight: FontWeight.bold, color: AppColors.primary),
              ),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.primary, width: 1.5),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
            ),
          );
        }

        final addr = _addresses[i];
        final lat = (addr['lat'] as num?)?.toDouble() ?? DistanceHelper.defaultCapitalLat;
        final lng = (addr['lng'] as num?)?.toDouble() ?? DistanceHelper.defaultCapitalLng;
        final isDefault = addr['isDefault'] == true;

        // حساب المسافة الحقيقية من مطاعم العاصمة بناءً على الـ X والـ Y
        final distanceKm = DistanceHelper.distanceToCustomer(
          customerLat: lat,
          customerLng: lng,
        );
        final distanceStr = DistanceHelper.formatDistance(distanceKm);
        final deliveryTimeStr = DistanceHelper.formatDeliveryTime(distanceKm);

        final city = (addr['city'] as String?)?.trim() ?? '';
        final district = (addr['district'] as String?)?.trim() ?? '';
        final street = (addr['street'] as String?)?.trim() ?? '';
        final areaLocation = [city, district, street].where((s) => s.isNotEmpty).join(' • ');

        final title = (addr['title'] as String?)?.trim().isNotEmpty == true
            ? addr['title'] as String
            : 'عنوان مسجل';
        final rawDetails = (addr['details'] ?? addr['address'] ?? '').toString().trim();
        final displayAddress = rawDetails.isNotEmpty && rawDetails != 'الموقع المحدد على الخريطة'
            ? rawDetails
            : (areaLocation.isNotEmpty ? areaLocation : 'الموقع المحدد على الخريطة');

        IconData iconData = Icons.location_on_rounded;
        if (title.contains('منزل') || title.contains('البيت')) {
          iconData = Icons.home_rounded;
        } else if (title.contains('عمل') || title.contains('مكتب') || title.contains('وزارة')) {
          iconData = Icons.apartment_rounded;
        }

        return Container(
          margin: const EdgeInsets.only(bottom: 14),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDefault ? AppColors.primaryContainer.withValues(alpha: 0.15) : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isDefault ? AppColors.primary.withValues(alpha: 0.5) : const Color(0xFFE2E8F0),
              width: isDefault ? 1.5 : 1.0,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: isDefault ? AppColors.primary : const Color(0xFFE2E8F0),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      iconData,
                      color: isDefault ? Colors.white : AppColors.navy,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              title,
                              style: GoogleFonts.cairo(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: AppColors.navy,
                              ),
                            ),
                            if (isDefault) ...[
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppColors.primary,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  'الرئيسي للتوصيل',
                                  style: GoogleFonts.cairo(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 3),
                        Text(
                          displayAddress,
                          style: GoogleFonts.cairo(
                            fontSize: 12.5,
                            color: AppColors.navy.withValues(alpha: 0.8),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  PopupMenuButton<String>(
                    icon: const Icon(Icons.more_vert_rounded, color: AppColors.textSecondary),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    onSelected: (val) {
                      if (val == 'default') {
                        _setDefaultAddress(i);
                      } else if (val == 'edit') {
                        _openMapAddressPicker(existingAddress: addr, editIndex: i);
                      } else if (val == 'delete') {
                        _deleteAddress(i);
                      }
                    },
                    itemBuilder: (ctx) => [
                      if (!isDefault)
                        PopupMenuItem(
                          value: 'default',
                          child: Row(
                            children: [
                              const Icon(Icons.check_circle_outline_rounded, size: 18, color: AppColors.primary),
                              const SizedBox(width: 8),
                              Text('تعيين كرئيسي', style: GoogleFonts.cairo(fontSize: 12.5)),
                            ],
                          ),
                        ),
                      PopupMenuItem(
                        value: 'edit',
                        child: Row(
                          children: [
                            const Icon(Icons.edit_location_alt_rounded, size: 18, color: AppColors.navy),
                            const SizedBox(width: 8),
                            Text('تعديل على الخريطة', style: GoogleFonts.cairo(fontSize: 12.5)),
                          ],
                        ),
                      ),
                      PopupMenuItem(
                        value: 'delete',
                        child: Row(
                          children: [
                            const Icon(Icons.delete_outline_rounded, size: 18, color: Colors.redAccent),
                            const SizedBox(width: 8),
                            Text('حذف', style: GoogleFonts.cairo(fontSize: 12.5, color: Colors.redAccent)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 10),

              // بطاقة توثيق الموقع الجغرافي ومعدل التوصيل الحقيقي دون إظهار أرقام X, Y
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.verified_rounded, size: 15, color: Colors.green),
                        const SizedBox(width: 5),
                        Text(
                          city.isNotEmpty ? '📍 $city' : '📍 موقع موثق بالخريطة',
                          style: GoogleFonts.cairo(
                            fontSize: 11.5,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFF1E293B),
                          ),
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        const Icon(Icons.two_wheeler_rounded, size: 14, color: AppColors.primaryDark),
                        const SizedBox(width: 4),
                        Text(
                          '$distanceStr • $deliveryTimeStr',
                          style: GoogleFonts.cairo(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primaryDark,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
