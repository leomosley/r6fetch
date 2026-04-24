import { Hono } from "hono";
import { isValidPlatform } from "@r6fetch/r6-client";
import { statsRoute } from "./routes/stats";
import { setupRoute } from "./routes/setup";
import type { Bindings } from "./bindings";

const app = new Hono<{ Bindings: Bindings }>();

// ── Welcome text shown to curl users at / ────────────────────────────────────
const WELCOME = `
  r6fetch — Rainbow Six Siege stats in your terminal
  ───────────────────────────────────────────────────

  Usage:
    curl r6.mosly.dev/<platform>/<username>

  Platforms:
    pc    — Ubisoft Connect
    ps    — PlayStation Network
    xbox  — Xbox Live

  Examples:
    curl r6.mosly.dev/pc/GamersClub
    curl r6.mosly.dev/ps/Pengu
    curl r6.mosly.dev/xbox/Beaulo

  First time? Set up a default player:
    curl r6.mosly.dev/setup | sh

  Web: https://r6.mosly.dev

`;

// ── Root ─────────────────────────────────────────────────────────────────────
app.get("/", async (c) => {
  const ua = c.req.header("user-agent") ?? "";

  // Serve ANSI welcome text to curl; serve the Astro landing page to browsers
  if (ua.toLowerCase().startsWith("curl")) {
    return c.text(WELCOME);
  }

  return c.env.ASSETS.fetch(c.req.raw);
});

// ── Setup script ─────────────────────────────────────────────────────────────
app.get("/setup", setupRoute);

// ── Stats ─────────────────────────────────────────────────────────────────────
app.get("/:platform/:username", async (c) => {
  const platform = c.req.param("platform");

  if (!isValidPlatform(platform)) {
    return c.text(
      `\n  Unknown platform: '${platform}'\n  Must be one of: pc, ps, xbox\n\n  Usage: curl r6.mosly.dev/<platform>/<username>\n\n`,
      400,
    );
  }

  return statsRoute(c);
});

// ── Missing username ──────────────────────────────────────────────────────────
app.get("/:platform", (c) => {
  const platform = c.req.param("platform");
  return c.text(
    `\n  Missing username.\n  Usage: curl r6.mosly.dev/${platform}/<username>\n\n`,
    400,
  );
});

// ── Fallthrough to static assets (CSS, JS, images for the web app) ───────────
app.all("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
