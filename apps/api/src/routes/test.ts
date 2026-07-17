import type { Context } from "hono";
import type { PlayerProfile } from "@r6fetch/r6-client";
import { render } from "@r6fetch/renderer";
import type { Bindings } from "~/bindings";

/**
 * Rank name to base tier mapping.
 * Tiers: 0 = Unranked, 1-5 = Copper, 6-10 = Bronze, 11-15 = Silver,
 * 16-20 = Gold, 21-25 = Platinum, 26-30 = Emerald, 31-35 = Diamond, 36-40 = Champion
 */
const RANK_BASE_TIERS: Record<string, number> = {
  unranked: 0,
  copper: 1,
  bronze: 6,
  silver: 11,
  gold: 16,
  platinum: 21,
  emerald: 26,
  diamond: 31,
  champion: 36,
};

/** Roman numeral to offset mapping (v=0, i=4) */
const ROMAN_TO_OFFSET: Record<string, number> = {
  v: 0,
  iv: 1,
  iii: 2,
  ii: 3,
  i: 4,
};

/** Rank names for display */
const RANK_NAMES = [
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
 * Test route for previewing rank art in local dev.
 *
 * Usage:
 *   curl localhost:8787/test/copper/v
 *   curl localhost:8787/test/diamond/i
 *   curl localhost:8787/test/champion/iii
 *   curl localhost:8787/test/champion/1234
 */
export async function testRoute(c: Context<{ Bindings: Bindings }>) {
  const rank = c.req.param("rank")?.toLowerCase() ?? "";
  const tier = c.req.param("tier")?.toLowerCase() ?? "";

  const baseTier = RANK_BASE_TIERS[rank];

  if (baseTier === undefined) {
    return c.text(
      `\n  Unknown rank: ${rank}\n  Valid ranks: ${Object.keys(RANK_BASE_TIERS).join(", ")}\n\n`,
      400
    );
  }

  let tierIndex: number;
  let champNumber: number | undefined;

  if (rank === "unranked") {
    tierIndex = 0;
  } else if (rank === "champion") {
    // Champion can be i-v OR a number (champ position up to 5 digits)
    const romanOffset = ROMAN_TO_OFFSET[tier];
    if (romanOffset !== undefined) {
      tierIndex = baseTier + romanOffset;
    } else {
      const num = parseInt(tier, 10);
      if (!isNaN(num) && num >= 1 && num <= 99999) {
        tierIndex = 40; // Champion I (highest)
        champNumber = num;
      } else {
        return c.text(
          `\n  Invalid champion tier: ${tier}\n  Use i, ii, iii, iv, v or a number 1-99999\n\n`,
          400
        );
      }
    }
  } else {
    const offset = ROMAN_TO_OFFSET[tier];
    if (offset === undefined) {
      return c.text(`\n  Invalid tier: ${tier}\n  Use i, ii, iii, iv, or v\n\n`, 400);
    }
    tierIndex = baseTier + offset;
  }

  const rankName = RANK_NAMES[tierIndex] ?? "Unknown";

  // Build dummy profile with the specified rank
  // Show leaderboard position for high ranks (diamond+) or if champ number specified
  const showLeaderboard = tierIndex >= 31 || champNumber !== undefined;
  const dummyLeaderboardPosition = showLeaderboard ? Math.min(champNumber ?? 1234, 10000) : null;

  const dummyProfile: PlayerProfile = {
    username: "TestPlayer",
    platform: "pc",
    level: 250,
    currentRank: {
      name: rankName,
      tier: tierIndex,
      rp: 4000 + tierIndex * 50,
      ...(champNumber !== undefined && { champNumber }),
    },
    peakRankSeason: {
      name: rankName,
      tier: tierIndex,
      rp: 4100 + tierIndex * 50,
      ...(champNumber !== undefined && { champNumber }),
    },
    peakRankAllTime: {
      name: "Champion I",
      tier: 40,
      rp: 5200,
      champNumber: 420,
    },
    leaderboardPosition: dummyLeaderboardPosition,
    kd: 1.25,
    winRate: 52,
    kills: 12345,
    deaths: 9876,
    wins: 500,
    losses: 460,
    headshotPercent: 48.5,
    topOperator: "Sledge",
  };

  const output = render(dummyProfile);
  return c.text(output);
}
