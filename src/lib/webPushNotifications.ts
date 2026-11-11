import { getApp, getApps, initializeApp } from 'firebase/app';
import { deleteToken, getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
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
  try {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
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
