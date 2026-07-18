import type { Platform, PlayerProfile, RankInfo } from "./types";
import { slugToRankInfo } from "./ranks";

export interface ProfileResponse {
  id: string;
  user_id: string;
  username: string;
  platform: string;
  level: number;
  hs: number | null; // headshot percentage
  views: number;
  last_played_at: string;
  fetched_at: string;
  updated_at: string;
  username_history: Array<{ username: string; created_at: string }>;
  leaderboard_position: number | null;
  max_rank_season: string;
  ranked_season_records: Record<string, SeasonRankRecord>;
  season_mode_records: Record<string, Record<string, SeasonModeRecord>>;
  top_operators: {
    attacker: OperatorStats[];
    defender: OperatorStats[];
  };
  bans: unknown[];
  external_bans: unknown[];
}

export interface SeasonRankRecord {
  season: string;
  rank: string;
  max_rank: string;
  rank_points: number;
  max_rank_points: number;
  rank_position?: number;
  max_rank_position?: number;
}

export interface SeasonModeRecord {
  season: string;
  mode: string;
  matches: number;
  wins: number;
  losses: number;
  abandons: number;
  wr: number;
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  kd: number;
  kda: number;
  kpm: number;
  hs: number;
}

export interface OperatorStats {
  operator: string;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  rounds_played: number;
}

export interface NormaliseParams {
  platform: Platform;
  response: ProfileResponse;
  currentSeason: string;
  rankedBombMode: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return isNonNegativeNumber(value) && Number.isInteger(value);
}

function isPositiveInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value > 0;
}

function getNonNegativeInteger(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  return isNonNegativeInteger(value) ? value : 0;
}

function getNonNegativeNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  return isNonNegativeNumber(value) ? value : 0;
}

function parseSeasonRankRecord(value: unknown): SeasonRankRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.season !== "string" ||
    value.season.length === 0 ||
    typeof value.rank !== "string" ||
    value.rank.length === 0 ||
    typeof value.max_rank !== "string" ||
    value.max_rank.length === 0 ||
    !isNonNegativeNumber(value.rank_points) ||
    !isNonNegativeNumber(value.max_rank_points)
  ) {
    return null;
  }

  return {
    season: value.season,
    rank: value.rank,
    max_rank: value.max_rank,
    rank_points: value.rank_points,
    max_rank_points: value.max_rank_points,
    ...(isPositiveInteger(value.rank_position) && { rank_position: value.rank_position }),
    ...(isPositiveInteger(value.max_rank_position) && {
      max_rank_position: value.max_rank_position,
    }),
  };
}

function parseSeasonModeRecord(value: unknown): SeasonModeRecord | null {
  if (!isRecord(value) || typeof value.season !== "string" || typeof value.mode !== "string") {
    return null;
  }

  return {
    season: value.season,
    mode: value.mode,
    matches: getNonNegativeInteger(value, "matches"),
    wins: getNonNegativeInteger(value, "wins"),
    losses: getNonNegativeInteger(value, "losses"),
    abandons: getNonNegativeInteger(value, "abandons"),
    wr: getNonNegativeNumber(value, "wr"),
    kills: getNonNegativeInteger(value, "kills"),
    deaths: getNonNegativeInteger(value, "deaths"),
    assists: getNonNegativeInteger(value, "assists"),
    headshots: getNonNegativeInteger(value, "headshots"),
    kd: getNonNegativeNumber(value, "kd"),
    kda: getNonNegativeNumber(value, "kda"),
    kpm: getNonNegativeNumber(value, "kpm"),
    hs: getNonNegativeNumber(value, "hs"),
  };
}

function parseOperatorStats(value: unknown): OperatorStats[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): OperatorStats[] => {
    if (!isRecord(entry) || typeof entry.operator !== "string") {
      return [];
    }
    return [
      {
        operator: entry.operator,
        wins: getNonNegativeInteger(entry, "wins"),
        losses: getNonNegativeInteger(entry, "losses"),
        kills: getNonNegativeInteger(entry, "kills"),
        deaths: getNonNegativeInteger(entry, "deaths"),
        rounds_played: getNonNegativeInteger(entry, "rounds_played"),
      },
    ];
  });
}

export function parseProfileResponse(value: unknown): ProfileResponse {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    value.id.trim().length === 0 ||
    typeof value.user_id !== "string" ||
    value.user_id.trim().length === 0 ||
    typeof value.username !== "string" ||
    value.username.trim().length === 0 ||
    typeof value.platform !== "string" ||
    value.platform.trim().length === 0 ||
    !isNonNegativeInteger(value.level) ||
    typeof value.max_rank_season !== "string" ||
    value.max_rank_season.trim().length === 0 ||
    !isRecord(value.ranked_season_records) ||
    !isRecord(value.season_mode_records)
  ) {
    throw new Error("Profile response is missing required fields");
  }

  const rankedSeasonRecords: Record<string, SeasonRankRecord> = {};
  for (const [season, record] of Object.entries(value.ranked_season_records)) {
    const parsed = parseSeasonRankRecord(record);
    if (parsed) {
      rankedSeasonRecords[season] = parsed;
    }
  }

  const seasonModeRecords: Record<string, Record<string, SeasonModeRecord>> = {};
  for (const [season, modes] of Object.entries(value.season_mode_records)) {
    if (!isRecord(modes)) {
      continue;
    }
    const parsedModes: Record<string, SeasonModeRecord> = {};
    for (const [mode, record] of Object.entries(modes)) {
      const parsed = parseSeasonModeRecord(record);
      if (parsed) {
        parsedModes[mode] = parsed;
      }
    }
    seasonModeRecords[season] = parsedModes;
  }

  const topOperators = isRecord(value.top_operators) ? value.top_operators : {};

  return {
    id: value.id,
    user_id: value.user_id,
    username: value.username,
    platform: value.platform,
    level: value.level,
    hs: isNonNegativeNumber(value.hs) && value.hs <= 100 ? value.hs : null,
    views: isNonNegativeNumber(value.views) ? value.views : 0,
    last_played_at: typeof value.last_played_at === "string" ? value.last_played_at : "",
    fetched_at: typeof value.fetched_at === "string" ? value.fetched_at : "",
    updated_at: typeof value.updated_at === "string" ? value.updated_at : "",
    username_history: Array.isArray(value.username_history)
      ? value.username_history.flatMap((entry) =>
          isRecord(entry) &&
          typeof entry.username === "string" &&
          typeof entry.created_at === "string"
            ? [{ username: entry.username, created_at: entry.created_at }]
            : []
        )
      : [],
    leaderboard_position: isPositiveInteger(value.leaderboard_position)
      ? value.leaderboard_position
      : null,
    max_rank_season: value.max_rank_season,
    ranked_season_records: rankedSeasonRecords,
    season_mode_records: seasonModeRecords,
    top_operators: {
      attacker: parseOperatorStats(topOperators.attacker),
      defender: parseOperatorStats(topOperators.defender),
    },
    bans: Array.isArray(value.bans) ? value.bans : [],
    external_bans: Array.isArray(value.external_bans) ? value.external_bans : [],
  };
}

function isChampionRank(slug: string | undefined | null): boolean {
  if (!slug) {
    return false;
  }
  const lower = slug.toLowerCase();
  return lower === "champion" || lower.includes("champion-");
}

function getTopOperator(topOperators: ProfileResponse["top_operators"]): string | null {
  const all = [...topOperators.attacker, ...topOperators.defender];
  if (all.length === 0) {
    return null;
  }

  all.sort((a, b) => b.rounds_played - a.rounds_played);
  const top = all[0];

  if (!top?.operator) {
    return null;
  }
  return top.operator.charAt(0).toUpperCase() + top.operator.slice(1);
}

function getCurrentSeasonRankedStats(
  seasonModeRecords: ProfileResponse["season_mode_records"],
  currentSeason: string,
  rankedBombMode: string
): SeasonModeRecord | null {
  const seasonRecords = seasonModeRecords[currentSeason];
  if (!seasonRecords) {
    return null;
  }

  return seasonRecords[rankedBombMode] ?? null;
}

export function normaliseProfile(params: NormaliseParams): PlayerProfile {
  const { platform, response, currentSeason, rankedBombMode } = params;

  const currentSeasonRecord = response.ranked_season_records[currentSeason];

  const currentRank: RankInfo = currentSeasonRecord
    ? slugToRankInfo(
        currentSeasonRecord.rank,
        currentSeasonRecord.rank_points,
        isChampionRank(currentSeasonRecord.rank) ? currentSeasonRecord.rank_position : undefined
      )
    : slugToRankInfo(null, 0);

  const peakRankSeason: RankInfo = currentSeasonRecord
    ? slugToRankInfo(
        currentSeasonRecord.max_rank,
        currentSeasonRecord.max_rank_points,
        isChampionRank(currentSeasonRecord.max_rank)
          ? currentSeasonRecord.max_rank_position
          : undefined
      )
    : slugToRankInfo(null, 0);

  const allTimePeak = response.ranked_season_records[response.max_rank_season];
  const peakRankAllTime: RankInfo = allTimePeak
    ? slugToRankInfo(
        allTimePeak.max_rank,
        allTimePeak.max_rank_points,
        isChampionRank(allTimePeak.max_rank) ? allTimePeak.max_rank_position : undefined
      )
    : { ...peakRankSeason };

  const rankedStats = getCurrentSeasonRankedStats(
    response.season_mode_records,
    currentSeason,
    rankedBombMode
  );

  const kills = rankedStats?.kills ?? 0;
  const rawDeaths = rankedStats?.deaths ?? 0;
  const deaths = Math.max(1, rawDeaths);
  const wins = rankedStats?.wins ?? 0;
  const losses = rankedStats?.losses ?? 0;

  const leaderboardPosition =
    response.leaderboard_position !== null && response.leaderboard_position <= 10000
      ? response.leaderboard_position
      : null;

  return {
    username: response.username,
    platform,
    level: response.level,
    currentRank,
    peakRankSeason,
    peakRankAllTime,
    leaderboardPosition,
    kd: Math.round((kills / deaths) * 100) / 100,
    winRate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0,
    kills,
    deaths: rawDeaths,
    wins,
    losses,
    headshotPercent: response.hs ?? null,
    topOperator: getTopOperator(response.top_operators),
  };
}
