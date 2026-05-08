import type { Platform, PlayerProfile } from "~/types";
import { tierToRankInfo } from "~/ranks";

// Extract the ranked board profile from the getPlayerStats response.
// Response shape (from reverse-engineering Webhooks.js):
// { platform_families_full_profiles: [{ board_ids_full_profiles: [{ board_id, full_profiles: [{ profile, season_statistics }] }] }] }
function extractRankedProfile(statsRanked: unknown) {
  const root = statsRanked as Record<string, unknown> | null;
  const families = root?.platform_families_full_profiles;
  if (!Array.isArray(families) || families.length === 0) return null;

  const boards = (families[0] as Record<string, unknown>)?.board_ids_full_profiles;
  if (!Array.isArray(boards)) return null;

  const rankedBoard = boards.find(
    (b: unknown) => (b as Record<string, unknown>)?.board_id === "ranked"
  );
  if (!rankedBoard) return null;

  const profiles = (rankedBoard as Record<string, unknown>)?.full_profiles;
  if (!Array.isArray(profiles) || profiles.length === 0) return null;

  return profiles[0] as Record<string, unknown>;
}

// Get the most-played ranked operator — response is pre-sorted most→least played.
function extractTopOperator(operatorStats: unknown): string | null {
  const getFirst = (arr: unknown[]): string | null => {
    const op = arr[0] as Record<string, unknown>;
    // API returns field as "operator", falling back to "name"
    const name = op?.operator ?? op?.name;
    return typeof name === "string" ? name : null;
  };

  if (Array.isArray(operatorStats)) return getFirst(operatorStats);

  const root = operatorStats as Record<string, unknown> | null;
  if (Array.isArray(root?.operators)) return getFirst(root.operators as unknown[]);

  return null;
}

export interface NormaliseParams {
  platform: Platform;
  username: string;
  accountInfo: unknown;
  statsRanked: unknown;
  operatorStats: unknown;
}

export function normaliseProfile(params: NormaliseParams): PlayerProfile {
  const { platform, username, accountInfo, statsRanked, operatorStats } = params;

  const rankedEntry = extractRankedProfile(statsRanked);
  const profile = rankedEntry?.profile as Record<string, unknown> | undefined;
  const seasonStats = rankedEntry?.season_statistics as Record<string, unknown> | undefined;
  const outcomes = seasonStats?.match_outcomes as Record<string, unknown> | undefined;

  const kills = (seasonStats?.kills as number) ?? 0;
  const rawDeaths = (seasonStats?.deaths as number) ?? 0;
  const deaths = Math.max(1, rawDeaths);
  const wins = (outcomes?.wins as number) ?? 0;
  const losses = (outcomes?.losses as number) ?? 0;

  const currentRankTier = (profile?.rank as number) ?? 0;
  const currentRP = (profile?.rank_points as number) ?? 0;
  const peakAllTimeTier = (profile?.max_rank as number) ?? currentRankTier;
  const peakAllTimeRP = (profile?.max_rank_points as number) ?? currentRP;

  const acc = accountInfo as Record<string, unknown> | null;
  const level = (acc?.level as number) ?? (acc?.xp_level as number) ?? 0;

  const combatStats = (acc?.stats as Record<string, unknown>)?.combatStats as Record<
    string,
    unknown
  >;
  const headshotPercent =
    (acc?.headshot_percentage as number | null) ??
    (combatStats?.headshotPercentage as number | null) ??
    null;

  return {
    username,
    platform,
    level,
    currentRank: tierToRankInfo(currentRankTier, currentRP),
    peakRankAllTime: tierToRankInfo(peakAllTimeTier, peakAllTimeRP),
    kd: Math.round((kills / deaths) * 100) / 100,
    winRate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0,
    kills,
    deaths: rawDeaths,
    wins,
    losses,
    headshotPercent,
    topOperator: extractTopOperator(operatorStats),
  };
}
