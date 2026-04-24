import type { RankInfo } from "./types";

// Rank tiers: 0 = Unranked, 1-5 = Copper, 6-10 = Bronze, 11-15 = Silver,
// 16-20 = Gold, 21-25 = Platinum, 26-30 = Emerald, 31-35 = Diamond, 36 = Champion
export const RANK_NAMES: readonly string[] = [
  "Unranked",
  "Copper V",
  "Copper IV",
  "Copper III",
  "Copper II",
  "Copper I",
  "Bronze V",
  "Bronze IV",
  "Bronze III",
  "Bronze II",
  "Bronze I",
  "Silver V",
  "Silver IV",
  "Silver III",
  "Silver II",
  "Silver I",
  "Gold V",
  "Gold IV",
  "Gold III",
  "Gold II",
  "Gold I",
  "Platinum V",
  "Platinum IV",
  "Platinum III",
  "Platinum II",
  "Platinum I",
  "Emerald V",
  "Emerald IV",
  "Emerald III",
  "Emerald II",
  "Emerald I",
  "Diamond V",
  "Diamond IV",
  "Diamond III",
  "Diamond II",
  "Diamond I",
  "Champion",
];

export function tierToRankInfo(tier: number, mmr: number): RankInfo {
  const clamped = Math.max(0, Math.min(36, Math.round(tier)));
  return {
    name: RANK_NAMES[clamped] ?? "Unknown",
    tier: clamped,
    mmr,
  };
}

export function rankNameToTier(name: string): number {
  const idx = RANK_NAMES.findIndex(
    (n) => n.toLowerCase() === name.toLowerCase(),
  );
  return idx >= 0 ? idx : 0;
}
