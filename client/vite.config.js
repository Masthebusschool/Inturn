import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // Must match the Express server's PORT (server/.env) - change it if PORT changes.
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
