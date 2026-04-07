import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
    middlewareMode: false,
    hmr: {
      protocol: 'http',
      host: '10.204.104.102',
      port: 5173,
    },
    // Proxy API requests to backend
    proxy: {
      '/api': {
            target: 'http://10.204.104.102:9000',
            changeOrigin: true,
            secure: false,
            rejectUnauthorized: false,
            ws: true,
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
