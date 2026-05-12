import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const packageJson = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8")) as { version?: string };
const frontendVersion = packageJson.version || "0.1.0";

function resolveGitShortSha() {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: __dirname,
      stdio: ["ignore", "pipe", "ignore"]
    })
      .toString()
      .trim();
  } catch {
    return "local";
  }
}

const frontendReleaseSha = process.env.VITE_RELEASE_SHA || process.env.RELEASE_SHA || resolveGitShortSha();
const frontendReleaseCreatedAt = process.env.VITE_RELEASE_CREATED_AT || process.env.RELEASE_CREATED_AT || new Date().toISOString();
const DEV_SERVER_PORT = 5173;
const PREVIEW_SERVER_PORT = 4173;

export default defineConfig(({ mode }) => {
  const appBuildMeta = JSON.stringify(
    {
      version: frontendVersion,
      releaseSha: frontendReleaseSha,
      releaseCreatedAt: frontendReleaseCreatedAt,
      environment: mode
    },
    null,
    2
  );

  return {
    base: "/-frontend-agro/",
    server: {
      port: DEV_SERVER_PORT,
      strictPort: true
    },
    preview: {
      port: PREVIEW_SERVER_PORT,
      strictPort: true
    },
    plugins: [
      react(),
      {
        name: "agro-app-build-meta",
        configureServer(server) {
          server.middlewares.use("/app-build.json", (_request, response) => {
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.setHeader("Cache-Control", "no-store");
            response.end(appBuildMeta);
          });
        },
        generateBundle() {
          this.emitFile({
            type: "asset",
            fileName: "app-build.json",
            source: appBuildMeta
          });
        }
      }
    ],
    define: {
      __APP_VERSION__: JSON.stringify(frontendVersion),
      __APP_RELEASE_SHA__: JSON.stringify(frontendReleaseSha),
      __APP_RELEASE_CREATED_AT__: JSON.stringify(frontendReleaseCreatedAt)
    }
  };
});
