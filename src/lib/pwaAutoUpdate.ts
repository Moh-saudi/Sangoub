// ==============================================================================
// 🚀 SANGOUB - PWA AUTO UPDATE & CACHE INVALDATION CONTROLLER
// Ensures users always run the newest deployed release without stale caches
// ==============================================================================

let isRefreshing = false;

export function initPwaAutoUpdate() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  // 1. Immediately reload when a new service worker takes over control
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!isRefreshing) {
      isRefreshing = true;
      console.log('[PWA] New service worker activated. Reloading to apply update…');
      window.location.reload();
    }
  });

  // 2. Helper to check for SW updates
  const checkForSwUpdate = async () => {
    if (document.hidden || !navigator.onLine) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        // If there is already a worker waiting, tell it to skip waiting immediately
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          return;
        }

        // Trigger network check for /sw.js
        await reg.update();

        // Listen if an installing worker appears
        if (reg.installing) {
          reg.installing.addEventListener('statechange', () => {
            if (reg.installing?.state === 'installed') {
              reg.installing.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        }
      }
    } catch (e) {
      // silent
    }

    // 3. Compare with /build-info.json
    try {
      const res = await fetch(`/build-info.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store' }
      });
      if (res.ok) {
        const info = await res.json();
        const currentBuild = import.meta.env.VITE_BUILD_ID;
        if (info?.id && currentBuild && info.id !== currentBuild) {
          console.log(`[PWA] Detected new build ${info.id} (current: ${currentBuild}). Updating…`);
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            await reg.update();
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
              return;
            }
          }
          // If no SW or already handled, reload after short delay
          setTimeout(() => {
            if (!isRefreshing) {
              isRefreshing = true;
              window.location.reload();
            }
          }, 1500);
        }
      }
    } catch {}
  };

  // Run on startup after page settles
  setTimeout(() => void checkForSwUpdate(), 2000);

  // Check whenever user returns to the tab or app
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void checkForSwUpdate();
  });
  window.addEventListener('focus', () => void checkForSwUpdate());

  // Periodically check every 45 seconds when online
  setInterval(() => {
    if (navigator.onLine && !document.hidden) {
      void checkForSwUpdate();
    }
  }, 45000);
}

/**
 * Manual Force Update Trigger (Can be invoked from any 1-click update button)
 */
export async function triggerPwaUpdate(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update();
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      }
    }
    // Clear storage caches
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(k => k.includes('navigation') || k.includes('precache')).map(k => caches.delete(k))
      );
    }
  } catch {}
  // Hard reload
  window.location.reload();
}

