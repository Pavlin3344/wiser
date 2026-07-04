import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "path"
import fs from "fs"

// Локалните dev сертификати (mkcert) са gitignored и ги няма в Docker build-а —
// зареждаме ги само ако съществуват, иначе dev server-ът върви на http.
const keyPath = path.resolve(__dirname, "./localhost-key.pem")
const certPath = path.resolve(__dirname, "./localhost-cert.pem")
const https =
  fs.existsSync(keyPath) && fs.existsSync(certPath)
    ? { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }
    : undefined

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
    https,
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
