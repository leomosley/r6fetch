import { ART_WIDTH, RANK_ART_MAP } from "./rank-art-data";

export { ART_WIDTH };

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns pre-coloured ANSI ASCII-art lines for the given rank tier.
 * Tiers: 0 = Unranked, 1-5 = Copper, 6-10 = Bronze, 11-15 = Silver,
 *        16-20 = Gold, 21-25 = Platinum, 26-30 = Emerald,
 *        31-35 = Diamond, 36-40 = Champion
 * Regenerate art: bun gen:rank-art
 */
export function getRankArt(tier: number): string[] {
  const clamped = Math.max(0, Math.min(40, tier));
  return [...RANK_ART_MAP[clamped]!];
}
