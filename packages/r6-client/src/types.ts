export type Platform = "pc" | "ps" | "xbox";

export interface RankInfo {
  name: string;
  tier: number;
  mmr: number;
}

export interface PlayerProfile {
  username: string;
  platform: Platform;
  level: number;
  hoursPlayed: number;
  currentRank: RankInfo;
  peakRankSeason: RankInfo;
  peakRankAllTime: RankInfo;
  kd: number;
  winRate: number;
  kills: number;
  wins: number;
  losses: number;
  headshotPercent: number | null;
  topOperator: string | null;
}

export class PlayerNotFoundError extends Error {
  constructor(username: string, platform: Platform) {
    super(`Player '${username}' not found on ${platform}`);
    this.name = "PlayerNotFoundError";
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
