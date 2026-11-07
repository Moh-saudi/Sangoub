// @ts-nocheck
import { clientsClaim } from 'workbox-core';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { getApps, initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging/sw';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string | null }>;
};

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

registerRoute(
  ({ request, url }) => request.destination === 'image' && url.origin === self.location.origin,
  new StaleWhileRevalidate({
    cacheName: 'sangoub-images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  }),
);

registerRoute(
  ({ request, url }) => request.mode === 'navigate' && url.origin === self.location.origin,
  new NetworkFirst({
    cacheName: 'capital-page-navigation',
    networkTimeoutSeconds: 4,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 12, maxAgeSeconds: 24 * 60 * 60 }),
    ],
  }),
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  }),
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  }),
);

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const isValidValue = (v: any): boolean =>
  typeof v === 'string' && v.trim().length > 3 && v !== 'undefined' && v !== 'null';

// Only initialize Firebase Messaging if complete and valid Firebase configuration is provided
if (
  isValidValue(firebaseConfig.apiKey) &&
  isValidValue(firebaseConfig.projectId) &&
  isValidValue(firebaseConfig.messagingSenderId) &&
  isValidValue(firebaseConfig.appId)
) {
  try {
    const firebaseApp = getApps().length
      ? getApps()[0]
      : initializeApp(firebaseConfig);

    // Firebase owns background push delivery and notification-click handling when configured
    getMessaging(firebaseApp);
  } catch (err) {
    console.warn('Firebase Messaging SW initialization bypassed safely:', err);
  }
}

// Native Web Push and background notification handlers (works natively across all modern browsers)
self.addEventListener('push', (event: any) => {
  if (!event.data) return;
  try {
    let title = 'سنجوب | Sangoub';
    let body = '';
    let icon = '/brand/sangoub-mark-white-256.png';
    let badge = '/brand/sangoub-mark-white-64.png';
    let data: any = {};

    try {
      const json = event.data.json();
      title = json.notification?.title || json.title || title;
      body = json.notification?.body || json.body || body;
      icon = json.notification?.icon || json.imageUrl || icon;
      data = json.data || json;
    } catch {
      body = event.data.text() || body;
    }

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon,
        badge,
        data,
        dir: 'rtl',
        lang: 'ar',
      })
    );
  } catch (err) {
    console.warn('Push event handling safely caught:', err);
  }
});

self.addEventListener('notificationclick', (event: any) => {
  try {
    event.notification.close();
    const screen = event.notification?.data?.screen || event.notification?.data?.targetScreen;
    let targetUrl = '/';
    if (screen === 'orders' || screen === 'track') {
      targetUrl = '/my-orders';
    } else if (screen === 'offers' || screen === 'coupons') {
      targetUrl = '/offers';
    }

    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            if ('navigate' in client) client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
    );
  } catch (err) {
    console.warn('Notification click handling safely caught:', err);
  }
});
