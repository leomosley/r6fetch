export type Platform = "pc" | "ps" | "xbox";

export interface RankInfo {
  name: string;
  tier: number;
  rp: number;
}

export interface PlayerProfile {
  username: string;
  platform: Platform;
  level: number;
  currentRank: RankInfo;
  peakRankAllTime: RankInfo;
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
  constructor(username: string, platform: Platform) {
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
