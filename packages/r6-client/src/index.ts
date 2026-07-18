import { normaliseProfile, parseProfileResponse } from "./normalise";
import { PlayerNotFoundError, ApiError } from "./types";
import type { Platform, PlayerProfile } from "./types";

export type { Platform, PlayerProfile, RankInfo } from "./types";
export { PlayerNotFoundError, ApiError } from "./types";

const API_BASE = "https://r6.stats.cc/v2";
const REQUEST_TIMEOUT_MS = 10_000;

export type UserPlatform = Platform;

type ApiPlatform = "pc" | "playstation" | "xbox";

const VALID_USER_PLATFORMS = new Set<string>(["pc", "ps", "xbox"]);

const PLATFORM_TO_API: Record<UserPlatform, ApiPlatform> = {
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

export interface R6Client {
  getPlayerProfile(platform: string, username: string): Promise<PlayerProfile>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseConfigResponse(value: unknown): ConfigResponse {
  if (!isRecord(value) || !isRecord(value.constants) || !isRecord(value.constants.slugs)) {
    throw new Error("Config response is missing required slugs");
  }

  const currentSeason = value.constants.slugs.current_season;
  const rankedBombMode = value.constants.slugs.ranked_bomb_mode;

  if (
    typeof currentSeason !== "string" ||
    currentSeason.trim().length === 0 ||
    typeof rankedBombMode !== "string" ||
    rankedBombMode.trim().length === 0
  ) {
    throw new Error("Config response is missing required slugs");
  }

  return { currentSeason, rankedBombMode };
}

export function createClient(apiKey: string): R6Client {
  const headers = {
    "X-Api-Key": apiKey,
    "User-Agent": "r6fetch.cc",
  };

  let cachedConfig: ConfigResponse | null = null;
  let configFetchedAt = 0;
  let configRequest: Promise<ConfigResponse> | null = null;
  const CONFIG_CACHE_TTL = 5 * 60 * 1000;

  async function getConfig(): Promise<ConfigResponse> {
    const now = Date.now();
    if (cachedConfig && now - configFetchedAt < CONFIG_CACHE_TTL) {
      return cachedConfig;
    }

    if (configRequest === null) {
      configRequest = (async () => {
        try {
          const res = await fetch(`${API_BASE}/config`, {
            headers,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          });
          if (!res.ok) {
            throw new ApiError(`Failed to fetch config: ${res.status} ${res.statusText}`);
          }

          const config = parseConfigResponse(await res.json());
          cachedConfig = config;
          configFetchedAt = Date.now();
          return config;
        } catch (error) {
          if (error instanceof ApiError) {
            throw error;
          }
          throw new ApiError("Failed to fetch or decode API config", error);
        } finally {
          configRequest = null;
        }
      })();
    }

    return configRequest;
  }

  async function getPlayerProfile(platform: string, username: string): Promise<PlayerProfile> {
    if (!isValidPlatform(platform)) {
      throw new ApiError(`Invalid platform '${platform}'. Must be one of: pc, ps, xbox`);
    }

    if (username.length === 0) {
      throw new ApiError("Username cannot be empty");
    }

    let encodedUsername: string;
    try {
      encodedUsername = encodeURIComponent(username);
    } catch (error) {
      throw new ApiError("Username could not be encoded", error);
    }

    const apiPlatform = PLATFORM_TO_API[platform];
    const configResultPromise = getConfig().then(
      (value) => ({ status: "fulfilled" as const, value }),
      (reason: unknown) => ({ status: "rejected" as const, reason })
    );

    let profileRes: Response;
    try {
      profileRes = await fetch(`${API_BASE}/profiles/${apiPlatform}/${encodedUsername}`, {
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new ApiError(`Failed to fetch profile for ${username}`, error);
    }

    if (profileRes.status === 404) {
      throw new PlayerNotFoundError(username, platform);
    }

    if (!profileRes.ok) {
      throw new ApiError(`Failed to fetch profile: ${profileRes.status} ${profileRes.statusText}`);
    }

    const configResult = await configResultPromise;
    if (configResult.status === "rejected") {
      if (configResult.reason instanceof ApiError) {
        throw configResult.reason;
      }
      throw new ApiError("Failed to fetch API config", configResult.reason);
    }

    let response;
    try {
      response = parseProfileResponse(await profileRes.json());
    } catch (error) {
      throw new ApiError("Failed to decode profile response", error);
    }

    return normaliseProfile({
      platform,
      response,
      currentSeason: configResult.value.currentSeason,
      rankedBombMode: configResult.value.rankedBombMode,
    });
  }

  return { getPlayerProfile };
}
