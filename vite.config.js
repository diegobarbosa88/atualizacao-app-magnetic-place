import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'

const versionPlugin = {
  name: 'version-plugin',
  buildStart() {
    fs.writeFileSync('public/version.json', JSON.stringify({ version: Date.now().toString() }));
  }
};

export default defineConfig({
  plugins: [
    versionPlugin,
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['version.json'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192x192.png', 'icon-512x512.png'],
      manifest: {
        name: 'Magnetic Place',
        short_name: 'Magnetic Place',
        description: 'Gestão de equipas e clientes Magnetic',
        theme_color: '#111827',
        background_color: '#111827',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'pt',
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      },
    }),
  ],
  server: {
    host: true,
    port: process.env.PORT ? Number(process.env.PORT) : 4179,
    strictPort: false,
    proxy: {
      // TEMPORÁRIO — a apontar para o vercel dev local (porta 3000) para
      // testar contra o ambiente de Qualidade da PSI. Reverter para
      // 'https://trabalhador.magneticplace.pt' (produção) depois dos testes.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
