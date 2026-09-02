import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'],
      manifest: {
        name: 'Ideal Seg — Captação de Leads',
        short_name: 'Ideal Seg Leads',
        description: 'Cadastro de clientes prospectados em campo pelos vendedores da Ideal Seg.',
        // Identidade oficial da Ideal Seg: preto/carvão + dourado #F2C200 —
        // mesma logo já usada no ERP (idealseg.com). Ver src/styles/theme.css.
        theme_color: '#141414',
        background_color: '#141414',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Navegação (rotas do React Router) sempre cai no shell da app quando
        // offline; dados (API) NÃO são cacheados aqui — a fila de sincronização
        // (próxima etapa) é quem cuida de leitura/escrita offline de verdade.
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3333',
        changeOrigin: true,
      },
    },
  },
});
