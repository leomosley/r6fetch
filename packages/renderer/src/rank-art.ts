import { fg, RESET, BOLD, DIM, centre } from "./ansi";
import { tierToGroup, RANK_COLORS } from "./rank-colors";

// All art lines must have a visual width of exactly ART_WIDTH characters.
export const ART_WIDTH = 14;

// Shared diamond badge shape (filled with █)
const BADGE_BODY = [
  "   ▄██████▄   ",
  "  ████████████",
  "  ████████████",
  "  ████████████",
  "  ████████████",
  "   ▀██████▀   ",
];

// Unranked uses ▒ fill
const UNRANKED_BODY = [
  "   ▄▒▒▒▒▒▒▄   ",
  "  ▒▒▒ ?  ▒▒▒▒",
  "  ▒▒▒▒▒▒▒▒▒▒▒▒",
  "  ▒▒▒▒▒▒▒▒▒▒▒▒",
  "  ▒▒▒▒▒▒▒▒▒▒▒▒",
  "   ▀▒▒▒▒▒▒▀   ",
];

// Champion gets a crown row at the top
const CHAMPION_BODY = [
  " ▄  ▄████▄  ▄ ",
  "  ████████████",
  "  ██ ★  ★ ████",
  "  ████████████",
  "  ████████████",
  "   ▀██████▀   ",
];

function colorLine(line: string, r: number, g: number, b: number): string {
  return `${fg(r, g, b)}${line}${RESET}`;
}

/**
 * Returns an array of pre-coloured ANSI strings representing the rank badge.
 * Each line has a visual width of ART_WIDTH.
 * The label line (rank name) is appended as the last element.
 */
export function getRankArt(tier: number, rankName: string): string[] {
  const group = tierToGroup(tier);
  const { r, g, b } = RANK_COLORS[group];

  const body =
    tier === 0 ? UNRANKED_BODY : tier === 36 ? CHAMPION_BODY : BADGE_BODY;

  const coloured = body.map((line) => colorLine(line, r, g, b));

  // Label: rank name centred, bold + rank colour
  const label = `${BOLD}${fg(r, g, b)}${centre(rankName.toUpperCase(), ART_WIDTH)}${RESET}`;

  // Dim horizontal rule under art
  const rule = `${DIM}${"─".repeat(ART_WIDTH)}${RESET}`;

  return [...coloured, label, rule];
}
