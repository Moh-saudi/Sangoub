// ==============================================================================
// 🚀 SANGOUB - PWA AUTO UPDATE & CACHE INVALIDATION CONTROLLER
// Ensures users run new releases safely without disrupting active dashboards
// ==============================================================================

let isRefreshing = false;

function isDashboardRoute(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  return path.startsWith('/admin') || path.startsWith('/merchant') || path.startsWith('/courier');
}

export function initPwaAutoUpdate() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  // 1. Service Worker update event (never reload active dashboards automatically)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // If the user is on an active dashboard, do NOT interrupt their work with sudden reloads
    if (isDashboardRoute()) {
      console.log('[PWA] Service worker updated in background. Retaining current dashboard view.');
      return;
    }

    if (!isRefreshing) {
      isRefreshing = true;
      console.log('[PWA] New service worker activated. Reloading to apply update…');
      window.location.reload();
    }
  });

  // 2. Helper to check for SW updates safely
  const checkForSwUpdate = async () => {
    if (document.hidden || !navigator.onLine || isDashboardRoute()) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          return;
        }
        await reg.update();
      }
    } catch {}

    // Check build-info safely without infinite loops
    try {
      const res = await fetch(`/build-info.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store' }
      });
      if (res.ok) {
        const info = await res.json();
        const currentBuild = import.meta.env.VITE_BUILD_ID;
        const lastReloadKey = 'sangoub_pwa_reloaded_build';
        const alreadyReloadedFor = sessionStorage.getItem(lastReloadKey);

        if (info?.id && currentBuild && info.id !== currentBuild && info.id !== alreadyReloadedFor) {
          console.log(`[PWA] Detected new build ${info.id} (current: ${currentBuild}).`);
          sessionStorage.setItem(lastReloadKey, info.id);

          // Only reload if not currently on dashboard
          if (!isDashboardRoute()) {
            setTimeout(() => {
              if (!isRefreshing) {
                isRefreshing = true;
                window.location.reload();
              }
            }, 2000);
          }
        }
      }
    } catch {}
  };

  // Check once on startup after page settles
  setTimeout(() => void checkForSwUpdate(), 5000);
}

/**
 * Manual Force Update Trigger (Invoked when user explicitly clicks the update button)
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
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(k => k.includes('navigation') || k.includes('precache')).map(k => caches.delete(k))
      );
    }
  } catch {}
  window.location.reload();
}

