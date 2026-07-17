import { ApiError, type RankInfo } from "./types";

/**
 * Rank slug to tier mapping.
 * Tiers: 0 = Unranked, 1-5 = Copper, 6-10 = Bronze, 11-15 = Silver,
 * 16-20 = Gold, 21-25 = Platinum, 26-30 = Emerald, 31-35 = Diamond, 36-40 = Champion
 */
const RANK_SLUG_TO_TIER: Record<string, number> = {
  unranked: 0,
  "copper-v": 1,
  "copper-iv": 2,
  "copper-iii": 3,
  "copper-ii": 4,
  "copper-i": 5,
  "bronze-v": 6,
  "bronze-iv": 7,
  "bronze-iii": 8,
  "bronze-ii": 9,
  "bronze-i": 10,
  "silver-v": 11,
  "silver-iv": 12,
  "silver-iii": 13,
  "silver-ii": 14,
  "silver-i": 15,
  "gold-v": 16,
  "gold-iv": 17,
  "gold-iii": 18,
  "gold-ii": 19,
  "gold-i": 20,
  "platinum-v": 21,
  "platinum-iv": 22,
  "platinum-iii": 23,
  "platinum-ii": 24,
  "platinum-i": 25,
  "emerald-v": 26,
  "emerald-iv": 27,
  "emerald-iii": 28,
  "emerald-ii": 29,
  "emerald-i": 30,
  "diamond-v": 31,
  "diamond-iv": 32,
  "diamond-iii": 33,
  "diamond-ii": 34,
  "diamond-i": 35,
  "champion-v": 36,
  "champion-iv": 37,
  "champion-iii": 38,
  "champion-ii": 39,
  "champion-i": 40,
};

/** Display names for each tier */
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
  "Champion V",
  "Champion IV",
  "Champion III",
  "Champion II",
  "Champion I",
];

/**
 * Normalize a rank slug by stripping the v7- prefix if present.
 */
function normalizeRankSlug(slug: string): string {
  let normalized = slug.toLowerCase();

  // Strip v7- prefix (new rank system)
  if (normalized.startsWith("v7-")) {
    normalized = normalized.slice(3);
  }

  return normalized;
}

/**
 * Convert a rank slug (e.g. "diamond-i" or "v7-diamond-i") to a RankInfo object.
 */
export function slugToRankInfo(
  slug: string | null | undefined,
  rp: number,
  champNumber?: number
): RankInfo {
  if (!slug) {
    return { name: "Unranked", tier: 0, rp: 0 };
  }

  const normalized = normalizeRankSlug(slug);

  // Legacy Champion had no divisions. Keep its historical name while using
  // Champion I as the closest available emblem.
  if (normalized === "champion") {
    return {
      name: "Champion",
      tier: 40,
      rp,
      ...(champNumber !== undefined && { champNumber }),
    };
  }

  const tier = RANK_SLUG_TO_TIER[normalized];
  if (tier === undefined) {
    throw new ApiError(`Unsupported rank slug received from API: ${slug}`);
  }

  const name = RANK_NAMES[tier]!;

  return {
    name,
    tier,
    rp,
    ...(champNumber !== undefined && { champNumber }),
  };
}

/**
 * Convert a numeric tier to a RankInfo object.
 * @deprecated Use slugToRankInfo instead for new API
 */
export function tierToRankInfo(tier: number, rp: number): RankInfo {
  const clamped = Math.max(0, Math.min(40, Math.round(tier)));
  return {
    name: RANK_NAMES[clamped] ?? "Unknown",
    tier: clamped,
    rp,
  };
}

export function rankNameToTier(name: string): number {
  const idx = RANK_NAMES.findIndex((n) => n.toLowerCase() === name.toLowerCase());
  return idx >= 0 ? idx : 0;
}
