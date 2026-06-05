// Config de build para o modo OFFLINE (arquivo único HTML).
// Uso: npm run build:offline → gera dist-offline/index.html
// Abrir com 2 cliques no navegador, sem servidor nem internet.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    viteSingleFile(),
    // PWA/service-worker desativado: não faz sentido em file://
  ],
  base: './',
  define: {
    // Variáveis do base44 que app-params lê — valores dummy (não usados offline)
    'import.meta.env.VITE_BASE44_APP_ID': JSON.stringify('offline'),
    'import.meta.env.VITE_BASE44_FUNCTIONS_VERSION': JSON.stringify('offline'),
    'import.meta.env.VITE_BASE44_APP_BASE_URL': JSON.stringify(''),
  },
  resolve: {
    // A ordem importa: o alias específico do gate vem ANTES do '@' genérico.
    // Isso troca o stub de produção (gate.js) pela versão real (gate.offline.js),
    // ativando o modo offline só neste build.
    alias: [
      {
        find: '@/api/offline/gate.js',
        replacement: path.resolve(import.meta.dirname ?? process.cwd(), './src/api/offline/gate.offline.js'),
      },
      { find: '@', replacement: path.resolve(import.meta.dirname ?? process.cwd(), './src') },
    ],
  },
  build: {
    outDir: 'dist-offline',
    emptyOutDir: true,
    // singlefile inline tudo — não há chunking útil
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
