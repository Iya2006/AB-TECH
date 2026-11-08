import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  envDir: '../..',
  plugins: [react(), tailwindcss()],
  // `@/…` = src/… : l'import attendu par les composants shadcn / 21st.dev
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },
})
