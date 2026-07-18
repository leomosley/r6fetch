import { Hono } from "hono";
import { isValidPlatform } from "@r6fetch/r6-client";
import { statsRoute } from "~/routes/stats";
import { setupRoute } from "~/routes/setup";
import { testRoute } from "~/routes/test";
import type { Bindings } from "~/bindings";

const app = new Hono<{ Bindings: Bindings }>();

function getOrigin(domain: string): string {
  return isLocalDomain(domain) ? `http://${domain}` : `https://${domain}`;
}

function buildWelcome(domain: string): string {
  const origin = getOrigin(domain);
  return `
  r6fetch — Rainbow Six Siege stats in your terminal
  ───────────────────────────────────────────────────

  Usage:
    curl ${origin}/<platform>/<username>

  Platforms:
    pc    — Ubisoft Connect
    ps    — PlayStation Network
    xbox  — Xbox Live

  Examples:
    curl ${origin}/pc/GamersClub
    curl ${origin}/ps/Pengu
    curl ${origin}/xbox/Beaulo

  First time? Set up a default player:
    curl -fsSL ${origin}/setup | sh

  Web: https://${domain}

`;
}

function isLocalDomain(domain: string): boolean {
  const hostname = domain.split(":", 1)[0];
  return hostname === "localhost" || hostname === "127.0.0.1";
}

app.onError(() => {
  return new Response("\n  r6fetch hit an unexpected error.\n  Try again in a moment.\n\n", {
    status: 500,
    headers: { "Content-Type": "text/plain; charset=UTF-8" },
  });
});

app.get("/", (c) => {
  const ua = c.req.header("user-agent") ?? "";

  if (ua.toLowerCase().startsWith("curl")) {
    return c.text(buildWelcome(c.env.DOMAIN));
  }

  return c.env.ASSETS.fetch(c.req.raw);
});

app.get("/setup", setupRoute);

app.get("/test/:rank/:tier", (c) => {
  if (!isLocalDomain(c.env.DOMAIN)) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return testRoute(c);
});

app.get("/:platform/:username", (c) => {
  const platform = c.req.param("platform");

  if (!isValidPlatform(platform)) {
    return c.env.ASSETS.fetch(c.req.raw);
  }

  return statsRoute(c);
});

app.get("/:platform", (c) => {
  const platform = c.req.param("platform");

  if (!isValidPlatform(platform)) {
    return c.env.ASSETS.fetch(c.req.raw);
  }

  return c.text(
    `\n  Missing username.\n  Usage: curl ${c.env.DOMAIN}/${platform}/<username>\n\n`,
    400
  );
});

app.all("*", (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
