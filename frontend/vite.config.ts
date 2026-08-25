import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

// Build identifier for the version-refresh banner: the build timestamp. It
// changes on every build with zero config (no env var, no git), which is all the
// banner needs — it only checks whether the deployed build differs from the one
// the user loaded. Computed once and shared by both the emitted /version.json
// (polled at runtime) and the bundle's inlined baseline (see `define` below).
const BUILD_ID = String(Date.now());

// Emit /version.json so the running SPA can poll its own build id.
function versionJson(): Plugin {
  return {
    name: "emit-version-json",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ version: BUILD_ID }) + "\n",
      });
    },
  };
}

// Same-origin dev proxy that replicates production ingress: both /rag-api/* and
// /api/auth/* go through nginx (API_URL), which fans them out to FastAPI and the
// auth-server respectively. This mirrors the Next proxy, which also routed
// everything through API_URL, so the browser, the JWT cookie, and the API share
// one origin (no CORS). API_URL is the name Doppler/the deployment already use
// (local dev: http://localhost:8000). FASTAPI_URL / AUTH_URL still override the
// individual targets for anyone running the services bare without nginx.
const API_URL = process.env.API_URL ?? "http://localhost:8000";
const FASTAPI_URL = process.env.FASTAPI_URL ?? API_URL;
const AUTH_URL = process.env.AUTH_URL ?? API_URL;

export default defineConfig({
  plugins: [
    // Router plugin must run before the React plugin.
    tanstackRouter({
      target: "react",
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
      autoCodeSplitting: true,
    }),
    react(),
    versionJson(),
  ],
  // Inline the build id as the bundle's baseline version. The banner compares
  // this against the polled /version.json; they share BUILD_ID so a fresh deploy
  // (new build → new timestamp in version.json) is detected as an update.
  define: {
    "import.meta.env.VITE_RELEASE": JSON.stringify(BUILD_ID),
  },
  // Resolve the `@/*` path alias from tsconfig.json. This is Vite 8's native
  // tsconfig-paths support (`resolve.tsconfigPaths`), which requires Vite >= 8.1
  // — the version pinned in package.json.
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 3000,
    proxy: {
      "/rag-api": { target: FASTAPI_URL, changeOrigin: true },
      "/api/auth": { target: AUTH_URL, changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
  },
});
