import { R6Client } from "r6-data.js";
import { getPlatformParams, isValidPlatform } from "./platform-map";
import { normaliseProfile } from "./normalise";
import { PlayerNotFoundError, ApiError } from "./types";

export type { Platform, PlayerProfile, RankInfo } from "./types";
export { isValidPlatform } from "./platform-map";
export { PlayerNotFoundError, ApiError } from "./types";

export function createClient(apiKey: string) {
  const r6 = new R6Client({ apiKey });

  return {
    async getPlayerProfile(platform: string, username: string) {
      if (!isValidPlatform(platform)) {
        throw new Error(
          `Invalid platform '${platform}'. Must be one of: pc, ps, xbox`,
        );
      }

      const { platformType, platformFamily } = getPlatformParams(platform);

      let accountInfo: unknown;
      let statsRanked: unknown;
      let seasonalStats: unknown;
      let operatorStats: unknown;

      try {
        [accountInfo, statsRanked, seasonalStats, operatorStats] =
          await Promise.all([
            r6.players
              .getAccountInfo({ nameOnPlatform: username, platformType })
              .catch(() => null),
            r6.players
              .getPlayerStats({
                nameOnPlatform: username,
                platformType,
                platform_families: platformFamily,
                board_id: "ranked",
              })
              .catch(() => null),
            r6.players
              .getSeasonalStats({ nameOnPlatform: username, platformType })
              .catch(() => null),
            r6.players
              .getOperatorStats({ nameOnPlatform: username, platformType })
              .catch(() => null),
          ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes("not found") || msg.includes("404")) {
          throw new PlayerNotFoundError(username, platform);
        }
        throw new ApiError(`Failed to fetch stats for ${username}`, err);
      }

      // If ranked stats are entirely missing, the player likely doesn't exist
      if (!statsRanked && !accountInfo) {
        throw new PlayerNotFoundError(username, platform);
      }

      return normaliseProfile({
        platform,
        username,
        accountInfo,
        statsRanked,
        seasonalStats,
        operatorStats,
      });
    },
  };
}
