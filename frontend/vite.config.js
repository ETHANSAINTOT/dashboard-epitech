import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API_TARGET = process.env.VITE_PROXY_TARGET ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 8080,
    strictPort: true,
    watch: { usePolling: true },
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true, xfwd: true },
      "/about.json": { target: API_TARGET, changeOrigin: true, xfwd: true },
    },
  },
});
