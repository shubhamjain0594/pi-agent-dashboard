import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vite";
import clientConfig from "../../packages/client/vite.config.js";

export default mergeConfig(clientConfig, defineConfig({
  root: fileURLToPath(new URL("../..", import.meta.url)),
  server: { port: 5187, strictPort: true, host: "0.0.0.0", hmr: { clientPort: 5187 } },
}));
