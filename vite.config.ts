import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl(), // HTTPS (required for GPS/geolocation outside localhost, e.g. on a phone)
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'GeoCollect EUDR',
        short_name: 'GeoCollect',
        description: "Collecte SIG et conformité EUDR pour coopératives cacao/café",
        theme_color: '#16a34a',
        background_color: '#14532d',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'fr',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache map tiles & app shell for offline field use
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,   // supprime les anciens caches à chaque mise à jour
        clientsClaim: true,            // le nouveau SW prend le contrôle immédiatement
        skipWaiting: true,             // pas d'attente : la nouvelle version s'active tout de suite
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/mt1\.google\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,   // expose on the local network (0.0.0.0) → accessible from your phone
    port: 5173,
  },
  build: {
    // Noms de fichiers uniques par build (évite les collisions de cache CDN entre déploiements)
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
        chunkFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
        assetFileNames: `assets/[name]-[hash]-${Date.now()}[extname]`,
      },
    },
  },
})
