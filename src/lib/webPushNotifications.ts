import { getApp, getApps, initializeApp } from 'firebase/app';
import { deleteToken, getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { FCM } from '@capacitor-community/fcm';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { authenticatedApi } from './authenticatedApi';

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCTgSsfVgXrd4d79-wpRtCBY-biXnVTeM8',
  authDomain: 'capital-talabat.firebaseapp.com',
  projectId: 'capital-talabat',
  storageBucket: 'capital-talabat.firebasestorage.app',
  messagingSenderId: '462331103510',
  appId: '1:462331103510:web:b48e42c27667fcdee9e837',
};

const fallbackVapidKey =
  'BCgr2RZ4AGXdevo-vMpFY6HXRSLs_shuwCjoFWy8bwFbF-7e_xB6m9w-AY87ABzE5eKotcVcI909jRBlEcorBS0';

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || fallbackVapidKey;
let foregroundListenerInstalled = false;
let nativeListenersInstalled = false;
let nativeRegistrationPromise: Promise<void> | null = null;
let nativeToken: string | null = null;
let registeredNativeToken: string | null = null;
let resolveNativeToken: ((token: string) => void) | null = null;
const nativeTokenReady = new Promise<string>((resolve) => {
  resolveNativeToken = resolve;
});

const NATIVE_TOKEN_KEY = 'sangoub_native_fcm_token';

async function registerNativeToken(token: string, platform: 'android' | 'ios') {
  if (!token) return;
  resolveNativeToken?.(token);
  nativeToken = token;
  try {
    localStorage.setItem(NATIVE_TOKEN_KEY, token);
  } catch {}
  if (token === registeredNativeToken) return;
  try {
    await authenticatedApi('/api/notifications', {
      action: 'register-token',
      token,
      platform,
    });
    registeredNativeToken = token;
  } catch (error) {
    console.debug('Native push token registration deferred until an authenticated session:', error);
  }
}

function openNotificationTarget(data: Record<string, unknown> = {}) {
  const normalized = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, String(value ?? '')]),
  );
  window.location.assign(notificationPath(normalized));
}

async function enableNativePushNotifications(): Promise<string> {
  const platform = Capacitor.getPlatform();
  if (platform !== 'android' && platform !== 'ios') {
    throw new Error('منصة الإشعارات الأصلية غير مدعومة.');
  }

  const permission = await PushNotifications.checkPermissions();
  const result = permission.receive === 'granted'
    ? permission
    : await PushNotifications.requestPermissions();
  if (result.receive !== 'granted') {
    throw new Error('لم يتم السماح بإشعارات سنجوب. يمكنك تفعيلها من إعدادات الجهاز.');
  }

  if (!nativeListenersInstalled) {
    nativeListenersInstalled = true;
    await PushNotifications.addListener('registration', ({ value }) => {
      if (platform === 'android') void registerNativeToken(value, 'android');
    });
    await PushNotifications.addListener('registrationError', (error) => {
      console.warn('Native push registration failed:', error);
    });
    await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
      openNotificationTarget(notification.data);
    });
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      window.dispatchEvent(new CustomEvent('sangoub:native_push_received', { detail: notification }));
    });
    if (platform === 'ios') {
      await FCM.addListener('tokenReceived', ({ token }) => {
        void registerNativeToken(token, 'ios');
      });
    }
  }

  if (platform === 'android') {
    try {
      await PushNotifications.createChannel({
        id: 'capital_orders_channel',
        name: 'إشعارات سنجوب',
        description: 'تحديثات الطلبات والعروض في سنجوب',
        importance: 4,
        visibility: 1,
        vibration: true,
      });
    } catch (error) {
      // Android versions before API 26 use the system's pre-channel behavior.
      console.debug('Notification channel setup skipped:', error);
    }
  }

  if (!nativeRegistrationPromise) {
    nativeRegistrationPromise = PushNotifications.register().catch((error) => {
      nativeRegistrationPromise = null;
      throw error;
    });
  }
  await nativeRegistrationPromise;

  // Android reports FCM tokens through the registration event. On iOS, wait
  // for the APNs-to-FCM exchange before reading its token.
  if (!nativeToken && platform === 'ios') {
    await Promise.race([
      nativeTokenReady,
      new Promise<void>((resolve) => window.setTimeout(resolve, 10000)),
    ]);
    if (!nativeToken) {
      const { token } = await FCM.getToken();
      await registerNativeToken(token, 'ios');
    }
  }
  if (!nativeToken && platform === 'android') {
    const savedToken = localStorage.getItem(NATIVE_TOKEN_KEY);
    if (savedToken) nativeToken = savedToken;
  }
  if (nativeToken) await registerNativeToken(nativeToken, platform);
  return nativeToken || 'native-registration-pending';
}

function isFcmSupportedForHost(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (
      localStorage.getItem('sangoub_fcm_unauthorized') === 'true' ||
      sessionStorage.getItem('sangoub_fcm_unauthorized') === 'true'
    ) {
      return false;
    }
  } catch {}

  // A custom VAPID key configured specifically for this domain
  if (Boolean(import.meta.env.VITE_FIREBASE_VAPID_KEY)) {
    return true;
  }

  const host = window.location.hostname;
  // Fallback VAPID credentials are only authorized for localhost or original capital-talabat domains
  return host === 'localhost' || host === '127.0.0.1' || host.includes('capital-talabat');
}

function markFcmUnauthorized() {
  try {
    localStorage.setItem('sangoub_fcm_unauthorized', 'true');
    sessionStorage.setItem('sangoub_fcm_unauthorized', 'true');
  } catch {}
}

function firebaseMessaging() {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
    appId: import.meta.env.VITE_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId,
  };
  const app = getApps().length ? getApp() : initializeApp(config);
  return getMessaging(app);
}

function notificationPath(data: Record<string, string>) {
  switch (data.screen) {
    case 'offers':
      return '/offers';
    case 'orders':
      return '/my-orders';
    case 'store':
      return data.targetId ? `/stores/${encodeURIComponent(data.targetId)}` : '/stores';
    default:
      return '/';
  }
}

export async function enableWebPushNotifications(): Promise<string> {
  if (Capacitor.isNativePlatform()) return enableNativePushNotifications();
  if (!('Notification' in window)) {
    throw new Error('هذا المتصفح لا يدعم نظام إشعارات الويب.');
  }

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('لم يتم السماح بإشعارات المتصفح. يمكنك تفعيلها من إعدادات المتصفح.');
  }

  if (!('serviceWorker' in navigator)) {
    return 'browser-permission-only';
  }

  try {
    if (!isFcmSupportedForHost()) {
      return 'browser-permission-only';
    }

    const supported = await isSupported().catch(() => false);
    if (!supported) {
      return 'browser-permission-only';
    }

    const registration = await navigator.serviceWorker.ready;
    const messaging = firebaseMessaging();
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    }).catch((err) => {
      if (
        err?.code === 'messaging/token-subscribe-failed' ||
        String(err?.message || err).includes('401') ||
        String(err?.message || err).includes('authentication credential')
      ) {
        markFcmUnauthorized();
      }
      console.debug('FCM token registration skipped on current host:', err?.message || err);
      return null;
    });

    if (token) {
      try {
        await authenticatedApi('/api/notifications', {
          action: 'register-token',
          token,
          platform: 'web',
        });
      } catch (err) {
        console.debug('Push token registration skipped:', err);
      }

      if (!foregroundListenerInstalled) {
        foregroundListenerInstalled = true;
        onMessage(messaging, (payload) => {
          const title = payload.notification?.title || 'سنجوب';
          const body = payload.notification?.body || '';
          const data = (payload.data || {}) as Record<string, string>;
          try {
            const notification = new Notification(title, {
              body,
              icon: '/brand/sangoub-mark-white-256.png',
              badge: '/brand/sangoub-mark-white-64.png',
              tag: data.campaignId || `sangoub-${Date.now()}`,
              data,
            });
            notification.onclick = () => {
              window.focus();
              window.location.assign(notificationPath(data));
              notification.close();
            };
          } catch {
            // Some browsers only allow service-worker notifications in the foreground.
          }
        });
      }

      return token;
    }
  } catch (err) {
    console.warn('Firebase Messaging registration error, fallback to browser notifications:', err);
  }

  return 'browser-permission-only';
}

export async function disableWebPushNotifications(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const token = nativeToken || localStorage.getItem(NATIVE_TOKEN_KEY);
    if (token) {
      try {
        await authenticatedApi('/api/notifications', { action: 'unregister-token', token });
      } catch (error) {
        console.debug('Native push token removal deferred:', error);
      }
    }
    try {
      await PushNotifications.unregister();
      await FCM.deleteInstance();
    } catch (error) {
      console.debug('Native push disable skipped:', error);
    }
    nativeToken = null;
    registeredNativeToken = null;
    nativeRegistrationPromise = null;
    try {
      localStorage.removeItem(NATIVE_TOKEN_KEY);
    } catch {}
    return;
  }
  try {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
    if (!isFcmSupportedForHost()) return;
    const supported = await isSupported().catch(() => false);
    if (!supported) return;

    const registration = await navigator.serviceWorker.ready;
    const messaging = firebaseMessaging();
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    }).catch(() => null);

    if (token) {
      try {
        await authenticatedApi('/api/notifications', { action: 'unregister-token', token });
      } catch {}
      await deleteToken(messaging).catch(() => false);
    }
  } catch (err) {
    console.debug('disableWebPushNotifications silent fallback:', err);
  }
}
