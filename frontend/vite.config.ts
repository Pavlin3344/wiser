import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "path"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Proxy configuration required for local development to bypass CORS restrictions
  // when querying Copernicus EFFIS WMS layers, matching production Nginx routing.
  server: {
    proxy: {
      "/effis-wms": {
        target: "https://maps.effis.emergency.copernicus.eu",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/effis-wms/, "/effis"),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("Referer", "https://forest-fire.emergency.copernicus.eu/")
          })
        },
      },
    },
  },
})
