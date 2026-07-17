export type Platform = "pc" | "playstation" | "xbox";

export interface RankInfo {
  name: string;
  tier: number;
  rp: number;
  /** Champion position (only set if rank is Champion) */
  champNumber?: number;
}

export interface PlayerProfile {
  username: string;
  platform: Platform;
  level: number;
  currentRank: RankInfo;
  /** Peak rank for the current season */
  peakRankSeason: RankInfo;
  /** Peak rank across all seasons */
  peakRankAllTime: RankInfo;
  /** Global leaderboard position (only included if ≤10,000) */
  leaderboardPosition: number | null;
  kd: number;
  winRate: number;
  kills: number;
  deaths: number;
  wins: number;
  losses: number;
  headshotPercent: number | null;
  topOperator: string | null;
}

export class PlayerNotFoundError extends Error {
  constructor(username: string, platform: string) {
    super(`Player '${username}' not found on ${platform}`);
    this.name = "PlayerNotFoundError";
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}
