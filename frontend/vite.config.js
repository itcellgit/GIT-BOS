import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Development: the React app runs on http://localhost:5173 and forwards /api to the Express API on :4000,
// so the browser sees one origin (cookies and sign-in work exactly as in production).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: { "/api": { target: "http://localhost:4000", changeOrigin: false } },
  },
  build: { outDir: "dist", sourcemap: true },
});
