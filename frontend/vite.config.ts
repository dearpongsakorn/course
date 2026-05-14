import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    open: true,
    proxy: {
      '/api': 'http://127.0.0.1:4001',
      '/uploads': 'http://127.0.0.1:4001',
    },
  },
})
