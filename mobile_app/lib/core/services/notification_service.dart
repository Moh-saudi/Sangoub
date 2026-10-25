import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../../screens/client/order_tracking_screen.dart';

/// معالج الإشعارات في الخلفية عند غلق التطبيق (Top-level function مطلوب من FCM)
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  debugPrint('📩 FCM Background message received: ${message.messageId}');
}

class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();

  GlobalKey<NavigatorState>? _navigatorKey;
  bool _isInitialized = false;

  /// قناة إشعارات أندرويد ذات الأولوية القصوى والصوت
  static const AndroidNotificationChannel _orderChannel = AndroidNotificationChannel(
    'capital_orders_channel',
    'إشعارات طلبات العاصمة',
    description: 'تنبيهات فورية بمراحل الطلب، تحضير الشيف، وحركة المندوب',
    importance: Importance.max,
    playSound: true,
    enableVibration: true,
  );

  /// تهيئة خدمة الإشعارات وربطها بالواجهة
  Future<void> initialize({GlobalKey<NavigatorState>? navigatorKey}) async {
    if (_isInitialized) return;
    _navigatorKey = navigatorKey;

    try {
      // 1. طلب إذن الإشعارات من المستخدم
      final settings = await _fcm.requestPermission(
        alert: true,
        announcement: false,
        badge: true,
        carPlay: false,
        criticalAlert: false,
        provisional: false,
        sound: true,
      );

      debugPrint('🔔 FCM Notification authorization: ${settings.authorizationStatus}');

      // 2. إعدادات الإشعار في الواجهة الأمامية لنظام iOS / Android
      await _fcm.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );

      // 3. تهيئة إشعارات أندرويد المحلية
      const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
      const iosInit = DarwinInitializationSettings(
        requestAlertPermission: true,
        requestBadgePermission: true,
        requestSoundPermission: true,
      );

      const initSettings = InitializationSettings(
        android: androidInit,
        iOS: iosInit,
      );

      await _localNotifications.initialize(
        initSettings,
        onDidReceiveNotificationResponse: (response) {
          _handleNotificationTap(response.payload);
        },
      );

      // 4. إنشاء قناة الإشعارات في نظام أندرويد
      final androidPlatform = _localNotifications.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      if (androidPlatform != null) {
        await androidPlatform.createNotificationChannel(_orderChannel);
      }

      // 5. تسجيل معالج الرسائل في الخلفية
      FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

      // 6. الاستماع للإشعارات أثناء تشغيل التطبيق في المقدمة (Foreground)
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        debugPrint('🔔 FCM Foreground message: ${message.notification?.title}');
        final notification = message.notification;
        final android = message.notification?.android;

        if (notification != null) {
          final orderId = message.data['orderId']?.toString() ?? '';
          _localNotifications.show(
            notification.hashCode,
            notification.title,
            notification.body,
            NotificationDetails(
              android: AndroidNotificationDetails(
                _orderChannel.id,
                _orderChannel.name,
                channelDescription: _orderChannel.description,
                icon: android?.smallIcon ?? '@mipmap/ic_launcher',
                importance: Importance.max,
                priority: Priority.high,
                color: const Color(0xFFF59E0B),
              ),
              iOS: const DarwinNotificationDetails(
                presentAlert: true,
                presentBadge: true,
                presentSound: true,
              ),
            ),
            payload: orderId,
          );
        }
      });

      // 7. الاستماع للنقر على الإشعار وفتح التطبيق من الخلفية
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        final orderId = message.data['orderId']?.toString();
        if (orderId != null && orderId.isNotEmpty) {
          _navigateToOrder(orderId);
        }
      });

      // 8. فحص ما إذا تم تشغيل التطبيق بالضغط على إشعار من حالة الإغلاق التام
      final initialMessage = await _fcm.getInitialMessage();
      if (initialMessage != null) {
        final orderId = initialMessage.data['orderId']?.toString();
        if (orderId != null && orderId.isNotEmpty) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            _navigateToOrder(orderId);
          });
        }
      }

      _isInitialized = true;
      debugPrint('✅ تم تهيئة نظام الإشعارات FCM بنجاح');
    } catch (e) {
      debugPrint('⚠️ Notification service init error: $e');
    }
  }

  /// جلب رمز الجهاز (FCM Token) وحفظه في ملف المستخدم بـ Firestore
  Future<String?> syncTokenWithUser(String uid) async {
    try {
      final token = await _fcm.getToken();
      if (token != null && token.isNotEmpty) {
        await FirebaseFirestore.instance.collection('users').doc(uid).set({
          'fcmToken': token,
          'fcmPlatform': defaultTargetPlatform.name,
          'fcmUpdatedAt': FieldValue.serverTimestamp(),
        }, SetOptions(merge: true));

        debugPrint('📱 تم ربط رمز FCM بنجاح للمستخدم: $uid');
      }

      // الاستماع لأي تجديد تلقائي لرمز الجهاز
      _fcm.onTokenRefresh.listen((newToken) {
        FirebaseFirestore.instance.collection('users').doc(uid).set({
          'fcmToken': newToken,
          'fcmUpdatedAt': FieldValue.serverTimestamp(),
        }, SetOptions(merge: true));
      });

      return token;
    } catch (e) {
      debugPrint('Sync FCM token error: $e');
      return null;
    }
  }

  /// إظهار تنبيه محلي فوري عند تغير حالة الطلب
  Future<void> showOrderStageAlert({
    required String orderId,
    required String title,
    required String body,
  }) async {
    try {
      await _localNotifications.show(
        orderId.hashCode,
        title,
        body,
        NotificationDetails(
          android: AndroidNotificationDetails(
            _orderChannel.id,
            _orderChannel.name,
            channelDescription: _orderChannel.description,
            importance: Importance.max,
            priority: Priority.high,
            color: const Color(0xFFF59E0B),
            playSound: true,
            enableVibration: true,
          ),
          iOS: const DarwinNotificationDetails(
            presentAlert: true,
            presentBadge: true,
            presentSound: true,
          ),
        ),
        payload: orderId,
      );
    } catch (e) {
      debugPrint('Error showing local alert: $e');
    }
  }

  void _handleNotificationTap(String? payload) {
    if (payload != null && payload.isNotEmpty) {
      _navigateToOrder(payload);
    }
  }

  void _navigateToOrder(String orderId) {
    if (_navigatorKey?.currentState != null) {
      _navigatorKey!.currentState!.push(
        MaterialPageRoute(
          builder: (_) => OrderTrackingScreen(orderId: orderId),
        ),
      );
    }
  }
}
