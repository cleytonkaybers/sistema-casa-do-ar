import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  base: process.env.VITE_BASE_URL || '/',
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      visualEditAgent: true
    }),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'manifest.json'],
      manifest: {
        name: 'Casa do Ar Climatização',
        short_name: 'Casa do Ar',
        description: 'Sistema de gerenciamento de serviços de climatização',
        theme_color: '#0ea5e9',
        background_color: '#0d1826',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'https://media.base44.com/images/public/698ea42a04e403662faedcb4/20ff2fc9c_logocasadoar.jpg',
            sizes: '192x192',
            type: 'image/jpeg',
          },
          {
            src: 'https://media.base44.com/images/public/698ea42a04e403662faedcb4/20ff2fc9c_logocasadoar.jpg',
            sizes: '512x512',
            type: 'image/jpeg',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ]
});