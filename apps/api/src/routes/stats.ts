import type { Context } from "hono";
import { createClient, PlayerNotFoundError, ApiError } from "@r6fetch/r6-client";
import { render } from "@r6fetch/renderer";
import type { Bindings } from "~/bindings";

const CACHE_KEY_PREFIX = "stats:";

let client: ReturnType<typeof createClient> | null = null;
let clientApiKey: string | null = null;

function getClient(apiKey: string) {
  if (!client || clientApiKey !== apiKey) {
    client = createClient(apiKey);
    clientApiKey = apiKey;
  }
  return client;
}

export async function statsRoute(c: Context<{ Bindings: Bindings }>) {
  const platform = c.req.param("platform") ?? "";
  const username = c.req.param("username") ?? "";
  const cacheKey = `${CACHE_KEY_PREFIX}${platform}:${username.toLowerCase()}`;
  const ttl = parseInt(c.env.CACHE_TTL_SECONDS, 10) || 300;
  const cacheEnabled = c.env.CACHE_ENABLED !== "false";

  if (cacheEnabled) {
    const cached = await c.env.CACHE.get(cacheKey);
    if (cached) {
      return c.text(cached, 200, {
        "X-Cache": "HIT",
        "Cache-Control": `public, max-age=${ttl}`,
      });
    }
  }

  const client = getClient(c.env.STATS_CC_API_KEY);

  let output: string;
  try {
    const profile = await client.getPlayerProfile(platform, username);
    output = render(profile);
  } catch (err) {
    if (err instanceof PlayerNotFoundError) {
      return c.text(
        `\n  Player not found: ${username} on ${platform}\n\n  Check the username and platform are correct.\n  Usage: curl ${c.env.DOMAIN}/<platform>/<username>\n\n`,
        404
      );
    }
    if (err instanceof ApiError) {
      return c.text(
        `\n  Failed to fetch stats — the R6 API may be temporarily unavailable.\n  Try again in a moment.\n\n`,
        503
      );
    }
    throw err;
  }

  if (cacheEnabled) {
    await c.env.CACHE.put(cacheKey, output, { expirationTtl: ttl });
  }

  return c.text(output, 200, {
    "X-Cache": cacheEnabled ? "MISS" : "DISABLED",
    "Cache-Control": cacheEnabled ? `public, max-age=${ttl}` : "no-store",
  });
}
