export type Platform = "pc" | "ps" | "xbox";

export interface RankInfo {
  name: string;
  tier: number;
  rp: number;
  champNumber?: number;
}

export interface PlayerProfile {
  username: string;
  platform: Platform;
  level: number;
  currentRank: RankInfo;
  peakRankSeason: RankInfo;
  peakRankAllTime: RankInfo;
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
