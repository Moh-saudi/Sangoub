import { execFileSync } from "node:child_process";
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  let buildId = process.env.CF_PAGES_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA;
  if (!buildId) { try { buildId = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(); } catch { buildId = 'build-'+Date.now(); } }
  const builtAt = new Date().toISOString();
  return {
    css: {
      preprocessorOptions: {
        scss: { quietDeps: true, silenceDeprecations: ["import", "global-builtin", "color-functions"] },
      },
    },
    define: { 'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId) },
    plugins: [
      { name: 'capital-build-info', generateBundle() { this.emitFile({type:'asset',fileName:'build-info.json',source:JSON.stringify({id:buildId,builtAt})}); } },
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        // The Workbox glob below already includes public icons. Adding them
        // through the manifest as well produces conflicting cache revisions.
        includeManifestIcons: false,
        manifest: {
          id: '/',
          name: 'سنجوب',
          short_name: 'سنجوب',
          description:
            'سنجوب لخدمة موظفي الحي الحكومي.',
          theme_color: '#10213f',
          background_color: '#f8fafc',
          display: 'standalone',
          orientation: 'any',
          dir: 'rtl',
          lang: 'ar',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/brand/sangoub-logo-256x256.png',
              sizes: '256x256',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/brand/sangoub-logo-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
          ],
        },
        workbox: {
          // Only Vite's hashed chunks are immutable; public/assets images are not.
          dontCacheBustURLsMatching: /^assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:js|css)$/,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,woff,woff2}'],
          // Fetch current HTML on navigation instead of pinning visitors to precached releases.
          globIgnores: ['**/index.html'],
          navigateFallback: null,
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) => request.mode === 'navigate' && url.origin === self.location.origin,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'capital-page-navigation',
                networkTimeoutSeconds: 4,
                cacheableResponse: { statuses: [200] },
                expiration: { maxEntries: 12, maxAgeSeconds: 24 * 60 * 60 },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio to prevent WebSocket connection errors and flickering.
      hmr: false,
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
