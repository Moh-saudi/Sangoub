import { getApp, getApps, initializeApp } from 'firebase/app';
import { deleteToken, getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { authenticatedApi } from './authenticatedApi';

const fallbackVapidKey =
  'BCgr2RZ4AGXdevo-vMpFY6HXRSLs_shuwCjoFWy8bwFbF-7e_xB6m9w-AY87ABzE5eKotcVcI909jRBlEcorBS0';

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || fallbackVapidKey;
let foregroundListenerInstalled = false;

function firebaseMessaging() {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
  if (Object.values(config).some((value) => !value)) {
    throw new Error('إعدادات إشعارات الويب غير مكتملة في Firebase.');
  }
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

export async function enableWebPushNotifications() {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    throw new Error('هذا المتصفح لا يدعم إشعارات الويب.');
  }
  if (!(await isSupported())) {
    throw new Error('إشعارات الويب غير مدعومة على هذا الجهاز أو المتصفح.');
  }

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('لم تسمح بإشعارات سنجوب. فعّل الإذن من إعدادات المتصفح.');
  }

  const registration = await navigator.serviceWorker.ready;
  const messaging = firebaseMessaging();
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error('تعذر تسجيل هذا الجهاز لاستقبال الإشعارات.');

  try {
    await authenticatedApi('/api/notifications', {
      action: 'register-token',
      token,
      platform: 'web',
    });
  } catch (err) {
    // Graceful fallback for static SPA hosting
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

export async function disableWebPushNotifications() {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
  if (!(await isSupported())) return;
  const messaging = firebaseMessaging();
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: await navigator.serviceWorker.ready,
  });
  if (token) {
    await authenticatedApi('/api/notifications', { action: 'unregister-token', token });
  }
  await deleteToken(messaging);
}
