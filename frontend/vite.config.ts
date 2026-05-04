import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    {
      name: "spa-fallback",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Serve index.html for all non-API routes
          if (req.url && !req.url.startsWith("/api") && !req.url.startsWith("/security/api")) {
            // Check if it's a file request
            if (req.url.includes(".")) {
              next();
              return;
            }
            // Serve index.html for SPA routes
            const indexPath = path.resolve(__dirname, "index.html");
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(fs.readFileSync(indexPath));
            return;
          }
          next();
        });
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/security/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
        },
      },
    },
  },
});
