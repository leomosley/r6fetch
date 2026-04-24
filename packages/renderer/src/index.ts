import type { PlayerProfile } from "@r6fetch/r6-client";
import { getRankArt, ART_WIDTH } from "./rank-art";
import { buildStatLines } from "./stat-panel";
import { padRight } from "./ansi";

const GAP = "    ";

/**
 * Render a PlayerProfile into an ANSI-coloured terminal string,
 * fastfetch-style: rank art on the left, stat panel on the right.
 */
export function render(profile: PlayerProfile): string {
  const artLines = getRankArt(
    profile.currentRank.tier,
    profile.currentRank.name,
  );
  const statLines = buildStatLines(profile);

  const height = Math.max(artLines.length, statLines.length);
  const rows: string[] = [];

  for (let i = 0; i < height; i++) {
    // Art column: pad to ART_WIDTH if line is missing
    const art = artLines[i] ?? " ".repeat(ART_WIDTH);
    const artPadded = padRight(art, ART_WIDTH);

    const stat = statLines[i] ?? "";
    rows.push(`${artPadded}${GAP}${stat}`);
  }

  return `\n${rows.join("\n")}\n\n`;
}

export { getRankArt } from "./rank-art";
export { buildStatLines } from "./stat-panel";
