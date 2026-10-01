import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest', // custom service worker in src/sw.js
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      manifest: false, // using public/manifest.json
      injectRegister: false, // registered manually in main.tsx
      injectManifest: {
        rollupFormat: 'iife',
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
      },
    }),
  ],
})
