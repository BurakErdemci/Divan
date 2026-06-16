import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // Electron dist/index.html'i file:// ile yükler → asset path'leri göreli olmalı.
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  }
})
