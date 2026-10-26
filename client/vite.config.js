import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],

  server: {
    port: 5173,
    proxy: {
      "/api/mcf": {
        target: "https://api.mycareersfuture.gov.sg",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mcf/, ""),
      },
      // Everything else under /api: the Express server. Must match server/.env's PORT.
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});