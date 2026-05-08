import { defineConfig } from "astro/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Build directly into the api public folder so wrangler picks it up as static assets
  outDir: "../api/public",
  build: {
    assets: "_assets",
  },
  vite: {
    resolve: {
      alias: {
        // Resolve ~ aliases for workspace packages
        "~": path.resolve(__dirname, "../../packages/renderer/src"),
      },
    },
  },
});
