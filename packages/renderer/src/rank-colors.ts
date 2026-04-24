// RGB colours per rank tier group, matching r6data.eu's rank palette

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export type RankGroup =
  | "unranked"
  | "copper"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "emerald"
  | "diamond"
  | "champion";

export const RANK_COLORS: Record<RankGroup, Rgb> = {
  unranked: { r: 120, g: 120, b: 120 },
  copper: { r: 184, g: 115, b: 51 },
  bronze: { r: 205, g: 127, b: 50 },
  silver: { r: 192, g: 192, b: 192 },
  gold: { r: 255, g: 215, b: 0 },
  platinum: { r: 76, g: 201, b: 183 },
  emerald: { r: 80, g: 200, b: 120 },
  diamond: { r: 91, g: 155, b: 213 },
  champion: { r: 255, g: 229, b: 102 },
};

/** Map a rank tier (0–36) to its colour group */
export function tierToGroup(tier: number): RankGroup {
  if (tier === 0) return "unranked";
  if (tier <= 5) return "copper";
  if (tier <= 10) return "bronze";
  if (tier <= 15) return "silver";
  if (tier <= 20) return "gold";
  if (tier <= 25) return "platinum";
  if (tier <= 30) return "emerald";
  if (tier <= 35) return "diamond";
  return "champion";
}
