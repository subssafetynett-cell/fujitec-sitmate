import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, '')
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:4000'
  let basePath = env.VITE_BASE_PATH || '/'
  if (basePath !== '/') {
    if (!basePath.startsWith('/')) basePath = `/${basePath}`
    if (!basePath.endsWith('/')) basePath = `${basePath}/`
  }

  return {
    base: basePath,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: [
          'favicon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
        ],
        manifest: {
          id: basePath,
          name: 'Site-mateai',
          short_name: 'Site Mate',
          description: 'Site Mate — site packs, forms, and safety management',
          theme_color: '#1A202C',
          background_color: '#1A202C',
          display: 'standalone',
          display_override: ['standalone', 'minimal-ui', 'browser'],
          orientation: 'any',
          start_url: basePath,
          scope: basePath,
          icons: [
            {
              src: 'apple-touch-icon.png',
              sizes: '180x180',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // Large SPA chunks (charts/export) — raise limit so SW precache succeeds
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          // Avoid workbox-build terser crashes in CI / constrained environments
          mode: 'development',
          importScripts: ['offline-sync-sw.js'],
          navigateFallback: `${basePath}index.html`,
          navigateFallbackDenylist: [/^\/api/, /^\/uploads/],
          runtimeCaching: [
            // Auth-sensitive API traffic is handled in-app (IndexedDB + write queue).
            // Keep the SW NetworkOnly here so Workbox never serves another user's JSON.
            {
              urlPattern: ({ url }) =>
                url.pathname.startsWith('/api') ||
                url.pathname.includes('/api/'),
              handler: 'NetworkOnly',
            },
            {
              urlPattern: ({ url }) =>
                url.pathname.startsWith('/uploads') ||
                url.pathname.includes('/uploads/'),
              handler: 'NetworkOnly',
            },
            {
              urlPattern: ({ url }) =>
                url.hostname === 'fonts.googleapis.com' ||
                url.hostname === 'fonts.gstatic.com',
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: ({ request }) =>
                request.destination === 'image' ||
                request.destination === 'font' ||
                request.destination === 'style',
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'static-assets',
                expiration: {
                  maxEntries: 80,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
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
    envDir: repoRoot,
    resolve: {
      dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'recharts'],
    },
    build: {
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        output: {
          // Only split heavy PDF/export libs. Recharts/MUI must stay with React's module
          // graph — a separate "charts" chunk causes "Cannot set properties of undefined
          // (setting 'Children')" in production when chunks load in the wrong order.
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (
              id.includes('html2canvas') ||
              id.includes('jspdf') ||
              id.includes('docx') ||
              id.includes('file-saver')
            ) {
              return 'export'
            }
          },
        },
      },
    },
    server: {
      proxy: {
        '/api': { target: proxyTarget, changeOrigin: true },
        '/uploads': { target: proxyTarget, changeOrigin: true },
      },
    },
  }
})
