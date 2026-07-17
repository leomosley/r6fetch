import { normaliseProfile, parseProfileResponse } from "./normalise";
import { PlayerNotFoundError, ApiError } from "./types";
import type { Platform } from "./types";

export type { Platform, PlayerProfile, RankInfo } from "./types";
export { PlayerNotFoundError, ApiError } from "./types";

const API_BASE = "https://r6.stats.cc/v2";
const REQUEST_TIMEOUT_MS = 10_000;

/** User-facing platform aliases */
export type UserPlatform = "pc" | "ps" | "xbox";

const VALID_USER_PLATFORMS = new Set<string>(["pc", "ps", "xbox"]);

/** Map user-facing platform names to API platform names */
const PLATFORM_TO_API: Record<UserPlatform, Platform> = {
  pc: "pc",
  ps: "playstation",
  xbox: "xbox",
};

export function isValidPlatform(platform: string): platform is UserPlatform {
  return VALID_USER_PLATFORMS.has(platform);
}

interface ConfigResponse {
  currentSeason: string;
  rankedBombMode: string;
}

function parseConfigResponse(value: unknown): ConfigResponse {
  const config = value as {
    constants?: { slugs?: { current_season?: unknown; ranked_bomb_mode?: unknown } };
  };
  const currentSeason = config?.constants?.slugs?.current_season;
  const rankedBombMode = config?.constants?.slugs?.ranked_bomb_mode;

  if (typeof currentSeason !== "string" || typeof rankedBombMode !== "string") {
    throw new Error("Config response is missing required slugs");
  }

  return { currentSeason, rankedBombMode };
}

export function createClient(apiKey: string) {
  const headers = {
    "X-Api-Key": apiKey,
    "User-Agent": "r6fetch.cc",
  };

  let cachedConfig: ConfigResponse | null = null;
  let configFetchedAt = 0;
  const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async function getConfig(): Promise<ConfigResponse> {
    const now = Date.now();
    if (cachedConfig && now - configFetchedAt < CONFIG_CACHE_TTL) {
      return cachedConfig;
    }

    try {
      const res = await fetch(`${API_BASE}/config`, {
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new ApiError(`Failed to fetch config: ${res.status} ${res.statusText}`);
      }

      cachedConfig = parseConfigResponse(await res.json());
      configFetchedAt = now;
      return cachedConfig;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Failed to fetch or decode API config", error);
    }
  }

  return {
    async getPlayerProfile(platform: string, username: string) {
      if (!isValidPlatform(platform)) {
        throw new Error(`Invalid platform '${platform}'. Must be one of: pc, ps, xbox`);
      }

      const apiPlatform = PLATFORM_TO_API[platform];

      // Fetch current season and profile in parallel
      let config: ConfigResponse;
      let profileRes: Response;
      try {
        [config, profileRes] = await Promise.all([
          getConfig(),
          fetch(`${API_BASE}/profiles/${apiPlatform}/${encodeURIComponent(username)}`, {
            headers,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          }),
        ]);
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(`Failed to fetch profile for ${username}`, error);
      }

      if (profileRes.status === 404) {
        throw new PlayerNotFoundError(username, platform);
      }

      if (!profileRes.ok) {
        throw new ApiError(
          `Failed to fetch profile: ${profileRes.status} ${profileRes.statusText}`
        );
      }

      let response;
      try {
        response = parseProfileResponse(await profileRes.json());
      } catch (error) {
        throw new ApiError("Failed to decode profile response", error);
      }

      return normaliseProfile({
        platform: apiPlatform,
        response,
        currentSeason: config.currentSeason,
        rankedBombMode: config.rankedBombMode,
      });
    },
  };
}
