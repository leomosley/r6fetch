import type { Platform, PlayerProfile } from "./types";
import { tierToRankInfo, rankNameToTier } from "./ranks";

// Extract the ranked board profile from the getPlayerStats response.
// Response shape (from reverse-engineering Webhooks.js):
// { platform_families_full_profiles: [{ board_ids_full_profiles: [{ board_id, full_profiles: [{ profile, season_statistics }] }] }] }
function extractRankedProfile(statsRanked: unknown) {
  const root = statsRanked as Record<string, unknown> | null;
  const families = root?.platform_families_full_profiles;
  if (!Array.isArray(families) || families.length === 0) return null;

  const boards = (families[0] as Record<string, unknown>)
    ?.board_ids_full_profiles;
  if (!Array.isArray(boards)) return null;

  const rankedBoard = boards.find(
    (b: unknown) => (b as Record<string, unknown>)?.board_id === "ranked",
  );
  if (!rankedBoard) return null;

  const profiles = (rankedBoard as Record<string, unknown>)?.full_profiles;
  if (!Array.isArray(profiles) || profiles.length === 0) return null;

  return profiles[0] as Record<string, unknown>;
}

// Walk the seasonal stats history to find the all-time peak rank tier.
function extractPeakAllTimeTier(seasonalStats: unknown): number {
  const root = seasonalStats as Record<string, unknown> | null;
  const history = (
    (root?.data as Record<string, unknown>)?.history as Record<string, unknown>
  )?.data;
  if (!Array.isArray(history)) return 0;

  let peakTier = 0;
  for (const entry of history) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const item = entry[1] as Record<string, unknown>;
    const rankStr = (item?.metadata as Record<string, unknown>)?.rank;
    if (typeof rankStr === "string") {
      const tier = rankNameToTier(rankStr);
      if (tier > peakTier) peakTier = tier;
    }
  }
  return peakTier;
}

// Find the most-played operator by kills from getOperatorStats response.
function extractTopOperator(operatorStats: unknown): string | null {
  const tryArray = (arr: unknown[]): string | null => {
    const sorted = [...arr].sort(
      (a, b) =>
        (((b as Record<string, unknown>)?.kills as number) ?? 0) -
        (((a as Record<string, unknown>)?.kills as number) ?? 0),
    );
    const name = (sorted[0] as Record<string, unknown>)?.name;
    return typeof name === "string" ? name : null;
  };

  if (Array.isArray(operatorStats)) return tryArray(operatorStats);

  const root = operatorStats as Record<string, unknown> | null;
  if (Array.isArray(root?.operators))
    return tryArray(root.operators as unknown[]);

  return null;
}

export interface NormaliseParams {
  platform: Platform;
  username: string;
  accountInfo: unknown;
  statsRanked: unknown;
  seasonalStats: unknown;
  operatorStats: unknown;
}

export function normaliseProfile(params: NormaliseParams): PlayerProfile {
  const {
    platform,
    username,
    accountInfo,
    statsRanked,
    seasonalStats,
    operatorStats,
  } = params;

  const rankedEntry = extractRankedProfile(statsRanked);
  const profile = rankedEntry?.profile as Record<string, unknown> | undefined;
  const seasonStats = rankedEntry?.season_statistics as
    | Record<string, unknown>
    | undefined;
  const outcomes = seasonStats?.match_outcomes as
    | Record<string, unknown>
    | undefined;

  const kills = (seasonStats?.kills as number) ?? 0;
  const deaths = Math.max(1, (seasonStats?.deaths as number) ?? 1);
  const wins = (outcomes?.wins as number) ?? 0;
  const losses = (outcomes?.losses as number) ?? 0;

  const currentRankTier = (profile?.rank as number) ?? 0;
  const currentMMR = (profile?.rank_points as number) ?? 0;
  const peakSeasonTier = (profile?.max_rank as number) ?? currentRankTier;
  const peakSeasonMMR = (profile?.max_rank_points as number) ?? currentMMR;

  // Account info — shape not fully typed in the SDK, handle gracefully
  const acc = accountInfo as Record<string, unknown> | null;
  const level = (acc?.level as number) ?? (acc?.xp_level as number) ?? 0;

  // Hours: try total_time_played (seconds), then direct hours field
  const rawPlaytime = acc?.total_time_played ?? acc?.playtime_seconds;
  const hoursPlayed =
    typeof rawPlaytime === "number"
      ? Math.floor(rawPlaytime / 3600)
      : ((acc?.playtime_hours as number) ?? 0);

  // Headshot % — may live at different paths depending on API version
  const combatStats = (acc?.stats as Record<string, unknown>)
    ?.combatStats as Record<string, unknown>;
  const headshotPercent =
    (acc?.headshot_percentage as number | null) ??
    (combatStats?.headshotPercentage as number | null) ??
    null;

  const peakAllTimeTier = extractPeakAllTimeTier(seasonalStats);

  return {
    username,
    platform,
    level,
    hoursPlayed,
    currentRank: tierToRankInfo(currentRankTier, currentMMR),
    peakRankSeason: tierToRankInfo(peakSeasonTier, peakSeasonMMR),
    peakRankAllTime: tierToRankInfo(peakAllTimeTier, 0),
    kd: Math.round((kills / deaths) * 100) / 100,
    winRate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0,
    kills,
    wins,
    losses,
    headshotPercent,
    topOperator: extractTopOperator(operatorStats),
  };
}
