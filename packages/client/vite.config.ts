import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
// Import via a relative workspace path so vite's esbuild config-loader bundles
// the plugin (and its transitive .ts deps) into the temp config bundle. Using
// the package specifier "@blackbelt-technology/dashboard-plugin-runtime"
// instead would externalize the module and hit ERR_MODULE_NOT_FOUND because
// the runtime ships raw .ts (no compiled dist) and Node can't resolve
// `.js`-extensioned internal imports back to `.ts` at runtime.
import { viteDashboardPluginsPlugin } from "../dashboard-plugin-runtime/src/vite-plugin/index.js";

/**
 * Resolve the dashboard HTTP port for Vite proxy targets.
 *
 * Resolution order:
 *   1. PI_DASHBOARD_PORT env var (if set and parseable as 1–65535)
 *   2. /tmp/dash-dev-port marker file (dash-dev.sh writes this)
 *   3. port field from ~/.pi/dashboard/config.json
 *   4. Fallback: 8000
 *
 * Errors (missing config, bad JSON, invalid env) are silently swallowed;
 * the dev server starts with the fallback port.
 */
function resolveDashboardPort(): number {
  // 1. Env var
  const envPort = process.env.PI_DASHBOARD_PORT;
  if (envPort !== undefined) {
    const parsed = parseInt(envPort, 10);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 65535) {
      return parsed;
    }
  }
  // 2. dash-dev.sh marker file
  try {
    const raw = fs.readFileSync("/tmp/dash-dev-port", "utf-8").trim();
    const parsed = parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 65535) {
      return parsed;
    }
  } catch {
    // File missing or unreadable — fall through
  }
  // 3. Config file
  try {
    const configPath = path.join(os.homedir(), ".pi", "dashboard", "config.json");
    const raw = fs.readFileSync(configPath, "utf-8");
    const cfg = JSON.parse(raw);
    if (typeof cfg.port === "number" && Number.isFinite(cfg.port) && cfg.port >= 1 && cfg.port <= 65535) {
      return cfg.port;
    }
  } catch {
    // Missing file, bad JSON, wrong shape — fall through
  }
  // 4. Fallback
  return 8000;
}

const DASHBOARD_PORT = resolveDashboardPort();

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteDashboardPluginsPlugin(path.resolve(__dirname, "../..")),
  ],
  root: "src",
  // publicDir is resolved relative to `root` (= packages/client/src/), so three
  // `../` hops are needed to reach the project-root public/ directory which
  // holds icon-192.png, manifest.json, sw.js, etc.
  publicDir: "../../../public",
  resolve: {
    alias: {
      "@blackbelt-technology/pi-dashboard-shared": path.resolve(__dirname, "../shared/src"),
      "@blackbelt-technology/pi-dashboard-client-utils": path.resolve(__dirname, "../client-utils/src"),
      // app-kit ships dist-only exports; `<EmbeddedApp>` (runtime
      // `./embedded-app`) imports its React half, so resolve it to source
      // (no prebuilt dist needed). `/react` MUST precede the bare key (alias
      // matches by prefix). See change: add-plugin-app-host.
      "@blackbelt-technology/pi-dashboard-app-kit/react": path.resolve(__dirname, "../app-kit/src/react/index.ts"),
      "@blackbelt-technology/pi-dashboard-app-kit": path.resolve(__dirname, "../app-kit/src/index.ts"),
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    // Split the main bundle so no single chunk exceeds ~500 KB. This avoids
    // zrok / free-tunnel aborts on large static assets and improves caching
    // (only changed chunks invalidate).
    // Vite 8 / rolldown ignores `manualChunks` once `codeSplitting` is set.
    // Groups are the split that keeps the rich diff viewer off the cold landing.
    modulePreload: {
      resolveDependencies(_filename, deps, { hostType }) {
        if (hostType !== "html") return deps;
        // Dynamic-import chunks must not be linked from index.html. The
        // runtime still preloads them when the import actually runs.
        return deps.filter((dep) => !/(?:^|\/)(?:diff|xterm)-/.test(dep));
      },
    },
    rollupOptions: {
      output: {
        codeSplitting: {
          // Do not pull a group's dependencies into the chunk. Otherwise a
          // shared module lands in `diff` and the entry imports that chunk.
          includeDependenciesRecursively: false,
          groups: [
            // D1: npm `diff` (including a copy nested under @git-diff-view)
            // is its own chunk. The name must not start with `diff-` — the
            // landing-page guard matches /^diff-/. Higher priority than the
            // rich-viewer group so the nested copy is not swallowed.
            { name: "jsdiff", test: (id: string) => id.includes("/node_modules/diff/"), priority: 30 },
            {
              name: "diff",
              test: (id: string) => id.includes("/node_modules/@git-diff-view/") && !id.includes("/node_modules/diff/"),
              priority: 20,
            },
            { name: "react-vendor", test: /\/node_modules\/react(?:-dom)?\//, priority: 10 },
            // react-syntax-highlighter stays with markdown: a separate syntax
            // chunk recreated a syntax → markdown → syntax cycle.
            // Prism theme objects (`/styles/`) stay out. The entry imports
            // them for tool cards; folding them in made the entry import this
            // chunk, which imports the entry back, and module init threw
            // before React mounted.
            // Language grammars are their own chunk so they are not folded
            // into markdown (size cap) or into RichDiff.
            {
              name: "hljs",
              test: /\/node_modules\/(?:highlight\.js|lowlight|refractor)\//,
              priority: 15,
            },
            {
              name: "markdown",
              test: (id: string) =>
                !id.includes("/styles/") &&
                /\/node_modules\/(?:react-markdown|remark-gfm|rehype-raw|dompurify|react-syntax-highlighter)\//.test(id),
              priority: 10,
            },
            { name: "xterm", test: /\/node_modules\/@xterm\//, priority: 10 },
            { name: "dnd", test: /\/node_modules\/@dnd-kit\//, priority: 10 },
            { name: "util", test: /\/node_modules\/(?:fuse\.js|qrcode|wouter|ansi-to-react)\//, priority: 10 },
            { name: "monaco", test: /\/node_modules\/(?:monaco-editor|@monaco-editor)\//, priority: 10 },
            // No katex group: it pulled hast helpers (and katex) into the
            // landing graph. No @mdi/js group: named icons tree-shake into
            // the entry, and the full set loads lazily.
          ],
        },
      },
    },
    // Raise the warning limit — mermaid and cytoscape chunks are already
    // code-split by vite's dynamic-import detection and don't need further
    // splitting.
    chunkSizeWarningLimit: 700,
  },
  server: {
    port: 3000,
    hmr: {
      // HMR WebSocket must connect directly to Vite's port, not the dashboard's.
      clientPort: 3000,
    },
    proxy: {
      "/api": `http://localhost:${DASHBOARD_PORT}`,
      "/ws": {
        target: `ws://localhost:${DASHBOARD_PORT}`,
        ws: true,
      },
    },
  },
});
