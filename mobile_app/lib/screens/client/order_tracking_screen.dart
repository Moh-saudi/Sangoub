import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants/colors.dart';
import '../../core/services/firebase_service.dart';
import '../../core/utils/distance_helper.dart';
import '../../models/order_model.dart';
import '../../providers/orders_provider.dart';

class OrderTrackingScreen extends StatefulWidget {
  final String orderId;

  const OrderTrackingScreen({
    super.key,
    required this.orderId,
  });

  @override
  State<OrderTrackingScreen> createState() => _OrderTrackingScreenState();
}

class _OrderTrackingScreenState extends State<OrderTrackingScreen> with SingleTickerProviderStateMixin {
  final FirebaseService _firebaseService = FirebaseService();
  final MapController _mapController = MapController();
  
  bool _isLoadingOtp = false;
  String? _fetchedOtp;
  bool _isMapExpanded = false;
  late AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _fetchOtp();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  Future<void> _fetchOtp() async {
    setState(() => _isLoadingOtp = true);
    try {
      final ordersProvider = Provider.of<OrdersProvider>(context, listen: false);
      final code = await ordersProvider.fetchOrderOtpCode(widget.orderId);
      if (mounted) {
        setState(() {
          _fetchedOtp = code;
          _isLoadingOtp = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingOtp = false);
      }
    }
  }

  void _recenterMap(LatLng target) {
    try {
      _mapController.move(target, 15.0);
    } catch (_) {}
  }

  void _fitMapBounds(LatLng p1, LatLng p2) {
    try {
      final bounds = LatLngBounds.fromPoints([p1, p2]);
      _mapController.fitCamera(
        CameraFit.bounds(
          bounds: bounds,
          padding: const EdgeInsets.all(50),
        ),
      );
    } catch (_) {}
  }

  Future<void> _makePhoneCall(String phoneNumber) async {
    final clean = phoneNumber.replaceAll(RegExp(r'\s+'), '');
    final uri = Uri.parse('tel:$clean');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('تعذر الاتصال بالرقم: $clean', style: GoogleFonts.cairo()),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  Future<void> _openWhatsApp(String phoneNumber) async {
    var clean = phoneNumber.replaceAll(RegExp(r'[^0-9]'), '');
    if (clean.startsWith('01')) {
      clean = '2$clean';
    }
    final uri = Uri.parse('https://wa.me/$clean');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ordersProvider = Provider.of<OrdersProvider>(context);

    return StreamBuilder<OrderModel?>(
      stream: _firebaseService.streamOrderById(widget.orderId),
      builder: (context, snapshot) {
        OrderModel order;
        if (snapshot.hasData && snapshot.data != null) {
          order = snapshot.data!;
        } else {
          // Fallback to provider orders or default fallback
          order = ordersProvider.orders.firstWhere(
            (o) => o.id == widget.orderId,
            orElse: () => OrderModel(
              id: widget.orderId,
              orderNumber: 'CAP-${widget.orderId.substring(0, widget.orderId.length > 6 ? 6 : widget.orderId.length).toUpperCase()}',
              profileId: '',
              customerName: 'موظف العاصمة',
              customerPhone: '01012345678',
              ministryName: 'وزارة الاتصالات وتكنولوجيا المعلومات',
              floor: 'الدور الرابع',
              officeNumber: 'مكتب 402',
              items: const [],
              storeIds: const [],
              kitchenStatus: const {},
              itemsSummary: '',
              subtotal: 180,
              deliveryFee: 15,
              discount: 100,
              total: 95,
              status: OrderStatus.preparing,
              otpCode: _fetchedOtp,
              restaurantName: 'مطبخ العاصمة المركزي (فود كورت)',
              createdAt: DateTime.now(),
            ),
          );
        }

        final String displayOtp = _fetchedOtp ?? ((order.otpCode?.isNotEmpty == true) ? order.otpCode! : '');

        // إحداثيات المسار والنقاط الجغرافية الحقيقية
        final storePos = LatLng(order.effectiveStoreLat, order.effectiveStoreLng);
        final customerPos = LatLng(order.effectiveCustomerLat, order.effectiveCustomerLng);
        final courierPos = LatLng(order.effectiveCourierLat, order.effectiveCourierLng);

        final midLat = (storePos.latitude + customerPos.latitude) / 2;
        final midLng = (storePos.longitude + customerPos.longitude) / 2;
        final centerPos = LatLng(midLat, midLng);

        final distanceKm = DistanceHelper.calculateDistanceKm(
          startLat: (order.status == OrderStatus.withCourier) ? courierPos.latitude : storePos.latitude,
          startLng: (order.status == OrderStatus.withCourier) ? courierPos.longitude : storePos.longitude,
          endLat: customerPos.latitude,
          endLng: customerPos.longitude,
        );
        final distanceLabel = DistanceHelper.formatDistance(distanceKm);
        final remainingTime = (order.status == OrderStatus.delivered)
            ? 'تم التسليم بنجاح'
            : (order.status == OrderStatus.withCourier)
                ? DistanceHelper.formatDeliveryTime(distanceKm)
                : '15-25 دقيقة';

        return Scaffold(
          backgroundColor: const Color(0xFFF8FAFC),
          appBar: AppBar(
            backgroundColor: Colors.white,
            elevation: 0.5,
            centerTitle: true,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.navy, size: 20),
              onPressed: () => Navigator.of(context).pop(),
            ),
            title: Column(
              children: [
                Text(
                  'تتبع طلبك بالخريطة الحية',
                  style: GoogleFonts.cairo(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppColors.navy,
                  ),
                ),
                Text(
                  'كود الطلب: ${order.orderNumber}',
                  style: GoogleFonts.cairo(
                    fontSize: 11,
                    color: AppColors.textMuted,
                  ),
                ),
              ],
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.refresh_rounded, color: AppColors.primary),
                tooltip: 'تحديث الرمز وحالة الطلب',
                onPressed: _fetchOtp,
              ),
            ],
          ),
          body: SingleChildScrollView(
            child: Column(
              children: [
                // ─── 1. خريطة التتبع الحية التفاعلية (FlutterMap) ───────
                AnimatedContainer(
                  duration: const Duration(milliseconds: 350),
                  curve: Curves.easeInOut,
                  height: _isMapExpanded ? 460 : 270,
                  width: double.infinity,
                  child: Stack(
                    children: [
                      FlutterMap(
                        mapController: _mapController,
                        options: MapOptions(
                          initialCenter: (order.status == OrderStatus.withCourier) ? courierPos : centerPos,
                          initialZoom: 14.5,
                          minZoom: 6.0,
                          maxZoom: 18.0,
                        ),
                        children: [
                          // خريطة OpenStreetMap عالية السرعة
                          TileLayer(
                            urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                            userAgentPackageName: 'com.capitaltalabat.app',
                          ),

                          // خط مسار التوصيل (Polyline)
                          PolylineLayer(
                            polylines: [
                              // مسار عام يربط المتجر بالعميل
                              Polyline(
                                points: [storePos, courierPos, customerPos],
                                strokeWidth: 4.5,
                                color: AppColors.primary,
                              ),
                              // خط متقطع إضافي للقسم المتبقي
                              if (order.status == OrderStatus.withCourier)
                                Polyline(
                                  points: [courierPos, customerPos],
                                  strokeWidth: 4.5,
                                  color: Colors.green,
                                ),
                            ],
                          ),

                          // الدبابيس والعلامات التفاعلية (Markers)
                          MarkerLayer(
                            markers: [
                              // 1. دبوس المطبخ / المتجر
                              Marker(
                                point: storePos,
                                width: 90,
                                height: 75,
                                child: _buildMapPin(
                                  icon: Icons.restaurant_rounded,
                                  label: 'المطبخ المركزي',
                                  bgColor: AppColors.navy,
                                  accentColor: AppColors.primary,
                                ),
                              ),

                              // 2. دبوس موقع العميل والوزارة
                              Marker(
                                point: customerPos,
                                width: 110,
                                height: 75,
                                child: _buildMapPin(
                                  icon: Icons.location_on_rounded,
                                  label: order.ministryName.length > 18
                                      ? '${order.ministryName.substring(0, 18)}...'
                                      : order.ministryName,
                                  bgColor: Colors.red.shade700,
                                  accentColor: Colors.white,
                                ),
                              ),

                              // 3. دبوس المندوب المتحرك مع وميض الرادار
                              if (order.status == OrderStatus.withCourier || order.status == OrderStatus.ready)
                                Marker(
                                  point: courierPos,
                                  width: 100,
                                  height: 80,
                                  child: AnimatedBuilder(
                                    animation: _pulseController,
                                    builder: (context, child) {
                                      return _buildCourierMarker(
                                        courierName: order.courierName ?? 'كابتن التوصيل',
                                        pulseValue: _pulseController.value,
                                      );
                                    },
                                  ),
                                ),
                            ],
                          ),
                        ],
                      ),

                      // أدوات التحكم السريعة العائمة أعلى الخريطة
                      Positioned(
                        top: 12,
                        left: 12,
                        child: Column(
                          children: [
                            _buildFloatingMapButton(
                              icon: _isMapExpanded ? Icons.fullscreen_exit_rounded : Icons.fullscreen_rounded,
                              tooltip: _isMapExpanded ? 'تصغير الخريطة' : 'تكبير الخريطة',
                              onTap: () {
                                setState(() => _isMapExpanded = !_isMapExpanded);
                              },
                            ),
                            const SizedBox(height: 8),
                            _buildFloatingMapButton(
                              icon: Icons.center_focus_strong_rounded,
                              tooltip: 'ملاءمة المسار كاملاً',
                              onTap: () => _fitMapBounds(storePos, customerPos),
                            ),
                            const SizedBox(height: 8),
                            _buildFloatingMapButton(
                              icon: Icons.two_wheeler_rounded,
                              tooltip: 'التركيز على المندوب',
                              onTap: () => _recenterMap(courierPos),
                            ),
                          ],
                        ),
                      ),

                      // شريط الملخص اللحظي العائم أسفل الخريطة
                      Positioned(
                        bottom: 12,
                        left: 12,
                        right: 12,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.95),
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.12),
                                blurRadius: 10,
                                offset: const Offset(0, 3),
                              ),
                            ],
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(7),
                                    decoration: BoxDecoration(
                                      color: AppColors.primaryContainer.withValues(alpha: 0.4),
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(Icons.two_wheeler_rounded, color: AppColors.primaryDark, size: 20),
                                  ),
                                  const SizedBox(width: 8),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        'المسافة المتبقية: $distanceLabel',
                                        style: GoogleFonts.cairo(
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                          color: AppColors.navy,
                                        ),
                                      ),
                                      Text(
                                        'الوقت التقديري: $remainingTime ⏱️',
                                        style: GoogleFonts.cairo(
                                          fontSize: 10.5,
                                          color: AppColors.textSecondary,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                decoration: BoxDecoration(
                                  color: order.status.color.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  order.status.arabicLabel,
                                  style: GoogleFonts.cairo(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: order.status.color,
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

                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      // ─── 2. كارت حالة الطلب العامة والشريط الزمني ─────────
                      Container(
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [AppColors.navy, Color(0xFF233554)],
                            begin: Alignment.topRight,
                            end: Alignment.bottomLeft,
                          ),
                          borderRadius: BorderRadius.circular(22),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.navy.withValues(alpha: 0.25),
                              blurRadius: 18,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: order.status.color.withValues(alpha: 0.2),
                                    shape: BoxShape.circle,
                                  ),
                                  child: Icon(order.status.icon, color: order.status.color, size: 28),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        order.status.arabicLabel,
                                        style: GoogleFonts.cairo(
                                          fontSize: 17,
                                          fontWeight: FontWeight.w900,
                                          color: Colors.white,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        'الوقت المتوقع للوصول: $remainingTime',
                                        style: GoogleFonts.cairo(
                                          fontSize: 12,
                                          color: Colors.white.withValues(alpha: 0.85),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: LinearProgressIndicator(
                                value: _calculateProgress(order.status),
                                minHeight: 8,
                                backgroundColor: Colors.white.withValues(alpha: 0.15),
                                valueColor: AlwaysStoppedAnimation<Color>(order.status.color),
                              ),
                            ),
                          ],
                        ),
                      ).animate().slideY(begin: 0.1, end: 0, duration: 400.ms).fadeIn(),

                      const SizedBox(height: 16),

                      // ─── 3. كارت رمز الاستلام السري (OTP) البارز ─────────
                      Container(
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: AppColors.primary.withValues(alpha: 0.35), width: 1.5),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primary.withValues(alpha: 0.08),
                              blurRadius: 14,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: AppColors.primaryContainer.withValues(alpha: 0.4),
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: const Icon(Icons.pin_rounded, color: AppColors.primaryDark, size: 28),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'رمز التحقق والاستلام (OTP):',
                                    style: GoogleFonts.cairo(
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                      color: AppColors.navy,
                                    ),
                                  ),
                                  Text(
                                    'أعطِ هذا الرمز للكابتن فقط عند استلام الوجبة بمكتبك',
                                    style: GoogleFonts.cairo(
                                      fontSize: 11,
                                      color: AppColors.textMuted,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            InkWell(
                              onTap: _fetchOtp,
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                decoration: BoxDecoration(
                                  color: AppColors.primary,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: _isLoadingOtp
                                    ? const SizedBox(
                                        width: 24,
                                        height: 24,
                                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                      )
                                    : Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Text(
                                            displayOtp.isNotEmpty ? displayOtp : 'عرض الرمز',
                                            style: GoogleFonts.cairo(
                                              fontSize: displayOtp.isNotEmpty ? 19 : 12.5,
                                              fontWeight: FontWeight.w900,
                                              color: Colors.white,
                                              letterSpacing: displayOtp.isNotEmpty ? 2 : 0,
                                            ),
                                          ),
                                          if (displayOtp.isNotEmpty) ...[
                                            const SizedBox(width: 6),
                                            GestureDetector(
                                              onTap: () {
                                                Clipboard.setData(ClipboardData(text: displayOtp));
                                                ScaffoldMessenger.of(context).showSnackBar(
                                                  SnackBar(
                                                    content: Text('تم نسخ الرمز: $displayOtp', style: GoogleFonts.cairo()),
                                                    duration: const Duration(seconds: 2),
                                                  ),
                                                );
                                              },
                                              child: const Icon(Icons.copy_rounded, color: Colors.white, size: 16),
                                            ),
                                          ],
                                        ],
                                      ),
                              ),
                            ),
                          ],
                        ),
                      ),

                      // ─── 4. كارت بيانات كابتن التوصيل والتواصل السريع ─────
                      if (order.courierName != null && order.courierName!.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.03),
                                blurRadius: 10,
                                offset: const Offset(0, 3),
                              ),
                            ],
                          ),
                          child: Row(
                            children: [
                              CircleAvatar(
                                radius: 24,
                                backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                                child: const Icon(Icons.two_wheeler_rounded, color: AppColors.primary, size: 26),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      order.courierName!,
                                      style: GoogleFonts.cairo(
                                        fontSize: 14,
                                        fontWeight: FontWeight.bold,
                                        color: AppColors.navy,
                                      ),
                                    ),
                                    Text(
                                      'كابتن العاصمة الإدارية المعتمد',
                                      style: GoogleFonts.cairo(
                                        fontSize: 11,
                                        color: AppColors.textMuted,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              if (order.courierPhone != null && order.courierPhone!.isNotEmpty) ...[
                                IconButton(
                                  icon: const Icon(Icons.phone_in_talk_rounded, color: Colors.green),
                                  tooltip: 'اتصال بالكابتن',
                                  onPressed: () => _makePhoneCall(order.courierPhone!),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.chat_bubble_outline_rounded, color: AppColors.primary),
                                  tooltip: 'واتساب',
                                  onPressed: () => _openWhatsApp(order.courierPhone!),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],

                      const SizedBox(height: 16),

                      // ─── 5. الخطوات والمراحل الزمنية ──────────────────────
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.03),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'مراحل تحضير وتوصيل الطلب',
                              style: GoogleFonts.cairo(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: AppColors.navy,
                              ),
                            ),
                            const SizedBox(height: 18),
                            _buildTimelineStep(
                              title: 'تم استلام وتأكيد الطلب',
                              subtitle: 'تم إرسال تفاصيل الوجبة إلى ${order.restaurantName}',
                              icon: Icons.receipt_long_rounded,
                              isDone: true,
                              isActive: order.status == OrderStatus.received,
                            ),
                            _buildTimelineStep(
                              title: 'قيد التحضير في المطبخ',
                              subtitle: 'يقوم الشيف بتجهيز وجبتك الطازجة وتغليفها حرارياً',
                              icon: Icons.outdoor_grill_rounded,
                              isDone: order.status != OrderStatus.received,
                              isActive: order.status == OrderStatus.preparing,
                            ),
                            _buildTimelineStep(
                              title: 'في الطريق مع كابتن العاصمة',
                              subtitle: 'استلم المندوب وجبتك وهو في طريقه لمقر وزارتك',
                              icon: Icons.two_wheeler_rounded,
                              isDone: order.status == OrderStatus.withCourier || order.status == OrderStatus.delivered,
                              isActive: order.status == OrderStatus.withCourier,
                            ),
                            _buildTimelineStep(
                              title: 'تم التوصيل والتسليم',
                              subtitle: 'تم التحقق برمز OTP وتسليم الوجبة بنجاح لمكتبك',
                              icon: Icons.task_alt_rounded,
                              isDone: order.status == OrderStatus.delivered,
                              isActive: order.status == OrderStatus.delivered,
                              isLast: true,
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 16),

                      // ─── 6. كارت عنوان التسليم بالحي الحكومي ───────────────
                      Container(
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.03),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.location_on_rounded, color: AppColors.primary, size: 20),
                                const SizedBox(width: 8),
                                Text(
                                  'عنوان التسليم المعتمد',
                                  style: GoogleFonts.cairo(
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.navy,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Text(
                              order.ministryName,
                              style: GoogleFonts.cairo(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: AppColors.navy,
                              ),
                            ),
                            if (order.floor.isNotEmpty || order.officeNumber.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text(
                                  '${order.floor} • ${order.officeNumber}',
                                  style: GoogleFonts.cairo(
                                    fontSize: 12,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  // ─── مكوّن دبوس الخريطة المخصص ──────────────────────────────
  Widget _buildMapPin({
    required IconData icon,
    required String label,
    required Color bgColor,
    required Color accentColor,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.25),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.cairo(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
        ),
        const SizedBox(height: 2),
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: bgColor,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2),
          ),
          child: Icon(icon, color: accentColor, size: 16),
        ),
      ],
    );
  }

  // ─── مكوّن دبوس المندوب مع نبض الرادار ──────────────────────────
  Widget _buildCourierMarker({
    required String courierName,
    required double pulseValue,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(
            color: AppColors.primary,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            'الكابتن في الطريق 🛵',
            style: GoogleFonts.cairo(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.white),
          ),
        ),
        const SizedBox(height: 2),
        Stack(
          alignment: Alignment.center,
          children: [
            // هالة النبض المتسعة
            Container(
              width: 38 + (pulseValue * 14),
              height: 38 + (pulseValue * 14),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.primary.withValues(alpha: (1.0 - pulseValue) * 0.4),
              ),
            ),
            // أيقونة الموتوسيكل الرئيسية
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.4),
                    blurRadius: 8,
                  ),
                ],
              ),
              child: const Icon(Icons.two_wheeler_rounded, color: Colors.white, size: 18),
            ),
          ],
        ),
      ],
    );
  }

  // ─── زر تحكم عائم على الخريطة ────────────────────────────────
  Widget _buildFloatingMapButton({
    required IconData icon,
    required String tooltip,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.95),
          borderRadius: BorderRadius.circular(10),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.15),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Icon(icon, color: AppColors.navy, size: 20),
      ),
    );
  }

  double _calculateProgress(OrderStatus status) {
    switch (status) {
      case OrderStatus.received:
        return 0.25;
      case OrderStatus.preparing:
        return 0.50;
      case OrderStatus.ready:
        return 0.70;
      case OrderStatus.withCourier:
        return 0.85;
      case OrderStatus.delivered:
        return 1.0;
      case OrderStatus.cancelled:
        return 0.0;
    }
  }

  Widget _buildTimelineStep({
    required String title,
    required String subtitle,
    required IconData icon,
    required bool isDone,
    required bool isActive,
    bool isLast = false,
  }) {
    final color = isDone ? AppColors.primary : const Color(0xFFCBD5E1);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: isDone ? AppColors.primary : Colors.white,
                shape: BoxShape.circle,
                border: Border.all(color: color, width: 2),
              ),
              child: Icon(
                icon,
                color: isDone ? Colors.white : const Color(0xFF94A3B8),
                size: 18,
              ),
            ),
            if (!isLast)
              Container(
                width: 2,
                height: 40,
                color: isDone ? AppColors.primary : const Color(0xFFE2E8F0),
              ),
          ],
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 4, bottom: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.cairo(
                    fontSize: 14,
                    fontWeight: isDone ? FontWeight.bold : FontWeight.w600,
                    color: isDone ? AppColors.navy : const Color(0xFF64748B),
                  ),
                ),
                Text(
                  subtitle,
                  style: GoogleFonts.cairo(
                    fontSize: 11,
                    color: AppColors.textMuted,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
