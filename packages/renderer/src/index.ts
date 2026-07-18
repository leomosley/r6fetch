import type { PlayerProfile } from "@r6fetch/r6-client";
import { getRankArt, ART_WIDTH } from "./rank-art";
import { buildStatLines } from "./stat-panel";
import { padRight } from "./ansi";

const GAP = "    ";

export function render(profile: PlayerProfile): string {
  const artLines = getRankArt(profile.currentRank.tier, profile.currentRank.champNumber);
  const statLines = buildStatLines(profile);

  const height = Math.max(artLines.length, statLines.length);
  const rows: string[] = [];

  for (let i = 0; i < height; i++) {
    const art = artLines[i] ?? " ".repeat(ART_WIDTH);
    const artPadded = padRight(art, ART_WIDTH);

    const stat = statLines[i];
    rows.push(stat === undefined ? artPadded : `${artPadded}${GAP}${stat}`);
  }

  return `\n${rows.join("\n")}\n\n`;
}

export { getRankArt } from "./rank-art";
export { buildStatLines } from "./stat-panel";
export { RANK_ART_MAP, RANK_COLORS_MAP, ART_WIDTH } from "./rank-art-data";
