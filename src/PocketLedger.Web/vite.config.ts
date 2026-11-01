import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    open: false,
    proxy: {
      '/api': {
        target: process.env.API_BASE_URL ?? 'http://localhost:5187',
        changeOrigin: true,
      },
    },
  },
})
