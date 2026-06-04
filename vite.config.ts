import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  root: "web",
  plugins: [solid()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022"
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      "/api": "http://127.0.0.1:3000"
    }
  },
  preview: {
    port: 4173,
    strictPort: false
  }
});
