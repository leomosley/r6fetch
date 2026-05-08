import { Hono } from "hono";
import { isValidPlatform } from "@r6fetch/r6-client";
import { statsRoute } from "~/routes/stats";
import { setupRoute } from "~/routes/setup";
import type { Bindings } from "~/bindings";

const app = new Hono<{ Bindings: Bindings }>();

function buildWelcome(domain: string): string {
  return `
  r6fetch — Rainbow Six Siege stats in your terminal
  ───────────────────────────────────────────────────

  Usage:
    curl ${domain}/<platform>/<username>

  Platforms:
    pc    — Ubisoft Connect
    ps    — PlayStation Network
    xbox  — Xbox Live

  Examples:
    curl ${domain}/pc/GamersClub
    curl ${domain}/ps/Pengu
    curl ${domain}/xbox/Beaulo

  First time? Set up a default player:
    curl ${domain}/setup | sh

  Web: https://${domain}

`;
}

app.get("/", async (c) => {
  const ua = c.req.header("user-agent") ?? "";

  if (ua.toLowerCase().startsWith("curl")) {
    return c.text(buildWelcome(c.env.DOMAIN));
  }

  return c.env.ASSETS.fetch(c.req.raw);
});

app.get("/setup", setupRoute);

app.get("/:platform/:username", async (c) => {
  const platform = c.req.param("platform");

  if (!isValidPlatform(platform)) {
    return c.text(
      `\n  Unknown platform: '${platform}'\n  Must be one of: pc, ps, xbox\n\n  Usage: curl ${c.env.DOMAIN}/<platform>/<username>\n\n`,
      400
    );
  }

  return statsRoute(c);
});

app.get("/:platform", (c) => {
  const platform = c.req.param("platform");
  return c.text(
    `\n  Missing username.\n  Usage: curl ${c.env.DOMAIN}/${platform}/<username>\n\n`,
    400
  );
});

app.all("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
