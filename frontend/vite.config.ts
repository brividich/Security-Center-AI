import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(frontendDir, "..");

function devBackendControlPlugin() {
  return {
    name: "security-center-dev-backend-control",
    configureServer(server) {
      server.middlewares.use("/__security-center-dev/restart-backend", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }

        const scriptPath = resolve(repoRoot, "restart_server.bat");
        const child = spawn(
          "cmd.exe",
          ["/c", "start", "Security Center AI - Backend", "/D", repoRoot, scriptPath, "--noreload"],
          {
            cwd: repoRoot,
            detached: true,
            stdio: "ignore",
            windowsHide: false,
          },
        );
        child.unref();

        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true }));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devBackendControlPlugin()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/security": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/admin": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/static": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
