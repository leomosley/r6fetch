import { ART_WIDTH, RANK_ART_MAP } from "~/rank-art-data";

export { ART_WIDTH };

/**
 * Returns pre-coloured ANSI ASCII-art lines for the given rank tier.
 * Regenerate art: bun gen:rank-art
 */
export function getRankArt(tier: number): string[] {
  const clamped = Math.max(0, Math.min(36, tier));
  return [...RANK_ART_MAP[clamped]!];
}
