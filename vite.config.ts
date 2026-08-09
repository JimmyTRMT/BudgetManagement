/// <reference types="vitest/config" />
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Configuration Vite du projet.
 *
 * `base` dépend du mode : '/' en dev (npm run dev) pour que les assets se
 * chargent normalement en local, et '/<repo>/' en prod (npm run build) car
 * GitHub Pages sert le site depuis un sous-chemin (https://user.github.io/repo/).
 * VITE_BASE_PATH permet de le surcharger sans toucher au code si le repo
 * est renommé ou déployé ailleurs.
 *
 * Le bloc `manifest` de VitePWA est complété avec les champs qui comptent
 * pour iOS (display, start_url, scope, couleurs) ; les icônes réelles
 * arrivent à l'étape 6 (PWA). Sur iOS, c'est surtout index.html (meta tags
 * apple-mobile-web-app-*) qui pilote le rendu standalone, pas le manifest.
 */
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? (process.env.VITE_BASE_PATH ?? '/BudgetManagement/') : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180.png'],
      manifest: {
        name: 'Comptes Perso',
        short_name: 'Comptes',
        description: 'Gestionnaire de comptes personnels, 100% local.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#2563eb',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
}));
