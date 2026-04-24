import { defineConfig } from "astro/config";

export default defineConfig({
  // Build directly into the api public folder so wrangler picks it up as static assets
  outDir: "../api/public",
  build: {
    assets: "_assets",
  },
});
