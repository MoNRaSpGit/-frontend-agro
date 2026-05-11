import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
var packageJson = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8"));
var frontendVersion = packageJson.version || "0.1.0";
function resolveGitShortSha() {
    try {
        return execSync("git rev-parse --short HEAD", {
            cwd: __dirname,
            stdio: ["ignore", "pipe", "ignore"]
        })
            .toString()
            .trim();
    }
    catch (_a) {
        return "local";
    }
}
var frontendReleaseSha = process.env.VITE_RELEASE_SHA || process.env.RELEASE_SHA || resolveGitShortSha();
var frontendReleaseCreatedAt = process.env.VITE_RELEASE_CREATED_AT || process.env.RELEASE_CREATED_AT || new Date().toISOString();
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var appBuildMeta = JSON.stringify({
        version: frontendVersion,
        releaseSha: frontendReleaseSha,
        releaseCreatedAt: frontendReleaseCreatedAt,
        environment: mode
    }, null, 2);
    return {
        base: "/-frontend-agro/",
        plugins: [
            react(),
            {
                name: "agro-app-build-meta",
                configureServer: function (server) {
                    server.middlewares.use("/app-build.json", function (_request, response) {
                        response.setHeader("Content-Type", "application/json; charset=utf-8");
                        response.setHeader("Cache-Control", "no-store");
                        response.end(appBuildMeta);
                    });
                },
                generateBundle: function () {
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
