import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],

  server: {
    proxy: {
      "/api/mcf": {
        target: "https://api.mycareersfuture.gov.sg",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mcf/, ""),
      },
    },
  },
});