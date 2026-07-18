import type { Context } from "hono";
import { createClient, PlayerNotFoundError, ApiError } from "@r6fetch/r6-client";
import type { PlayerProfile } from "@r6fetch/r6-client";
import { render } from "@r6fetch/renderer";
import type { Bindings } from "~/bindings";

const CACHE_KEY_PREFIX = "stats:v2:";
const DEFAULT_CACHE_TTL_SECONDS = 300;
const MIN_CACHE_TTL_SECONDS = 60;
const MAX_CACHE_TTL_SECONDS = 86_400;
const MAX_USERNAME_LENGTH = 100;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f-\u009f]/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g;

let client: ReturnType<typeof createClient> | null = null;
let clientApiKey: string | null = null;

interface CacheConfig {
  enabled: boolean;
  ttl: number;
}

function getClient(apiKey: string): ReturnType<typeof createClient> {
  if (!client || clientApiKey !== apiKey) {
    client = createClient(apiKey);
    clientApiKey = apiKey;
  }
  return client;
}

function parseCacheConfig(bindings: Bindings): CacheConfig | null {
  if (bindings.CACHE_ENABLED !== "true" && bindings.CACHE_ENABLED !== "false") {
    return null;
  }

  const ttl = Number(bindings.CACHE_TTL_SECONDS || DEFAULT_CACHE_TTL_SECONDS);
  if (!Number.isInteger(ttl) || ttl < MIN_CACHE_TTL_SECONDS || ttl > MAX_CACHE_TTL_SECONDS) {
    return null;
  }

  return { enabled: bindings.CACHE_ENABLED === "true", ttl };
}

function isValidUsername(username: string): boolean {
  return (
    username.trim().length > 0 &&
    username.length <= MAX_USERNAME_LENGTH &&
    !CONTROL_CHARACTER.test(username)
  );
}

function sanitizeTerminalText(value: string): string {
  return value.replace(CONTROL_CHARACTERS, "");
}

function sanitizeProfile(profile: PlayerProfile): PlayerProfile {
  return {
    ...profile,
    username: sanitizeTerminalText(profile.username),
    currentRank: {
      ...profile.currentRank,
      name: sanitizeTerminalText(profile.currentRank.name),
    },
    peakRankSeason: {
      ...profile.peakRankSeason,
      name: sanitizeTerminalText(profile.peakRankSeason.name),
    },
    peakRankAllTime: {
      ...profile.peakRankAllTime,
      name: sanitizeTerminalText(profile.peakRankAllTime.name),
    },
    topOperator: profile.topOperator === null ? null : sanitizeTerminalText(profile.topOperator),
  };
}

export async function statsRoute(c: Context<{ Bindings: Bindings }>): Promise<Response> {
  const platform = c.req.param("platform") ?? "";
  const username = c.req.param("username") ?? "";
  const cacheConfig = parseCacheConfig(c.env);

  if (!isValidUsername(username)) {
    return c.text(
      `\n  Invalid username.\n  Enter a username between 1 and ${MAX_USERNAME_LENGTH} characters.\n\n`,
      400
    );
  }

  if (
    cacheConfig === null ||
    typeof c.env.STATS_CC_API_KEY !== "string" ||
    c.env.STATS_CC_API_KEY.trim().length === 0
  ) {
    return c.text("\n  r6fetch is temporarily unavailable.\n  Try again in a moment.\n\n", 503);
  }

  const cacheKey = `${CACHE_KEY_PREFIX}${platform}:${username.toLowerCase()}`;

  if (cacheConfig.enabled) {
    const cached = await c.env.CACHE.get(cacheKey).catch(() => null);
    if (cached) {
      return c.text(cached, 200, {
        "X-Cache": "HIT",
        "Cache-Control": `public, max-age=${cacheConfig.ttl}`,
      });
    }
  }

  const client = getClient(c.env.STATS_CC_API_KEY);

  let output: string;
  try {
    const profile = await client.getPlayerProfile(platform, username);
    output = render(sanitizeProfile(profile));
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

  if (cacheConfig.enabled) {
    c.executionCtx.waitUntil(
      c.env.CACHE.put(cacheKey, output, { expirationTtl: cacheConfig.ttl }).catch(() => undefined)
    );
  }

  return c.text(output, 200, {
    "X-Cache": cacheConfig.enabled ? "MISS" : "DISABLED",
    "Cache-Control": cacheConfig.enabled ? `public, max-age=${cacheConfig.ttl}` : "no-store",
  });
}
