import { defineConfig } from "astro/config";

export default defineConfig({
  // Wrangler serves the web build from the API's static asset directory.
  outDir: "../api/public",
  build: {
    assets: "_assets",
  },
});
