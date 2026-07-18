import type { PlayerProfile } from "@r6fetch/r6-client";
import { fg, RESET, BOLD, DIM, padRight, truncateText, visualWidth } from "./ansi";
import { normalizeTier } from "./rank-art";
import { RANK_COLORS_MAP } from "./rank-art-data";

const STAT_KEYS = [
  "Level",
  "Current Rank",
  "Season Peak",
  "All-Time Peak",
  "K/D",
  "Win Rate",
  "Kills",
  "Deaths",
  "Wins / Losses",
  "Headshot %",
  "Top Operator",
];
const KEY_WIDTH = Math.max(...STAT_KEYS.map((k) => k.length)) + 2;
const GREY = fg(160, 160, 160);
const WHITE = fg(230, 230, 230);
const MAX_USERNAME_WIDTH = 24;
const MAX_LABEL_WIDTH = 20;
const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

type StatLine =
  | { kind: "header"; text: string }
  | { kind: "separator" }
  | { kind: "stat"; key: string; value: string };

function rankColor(tier: number): string {
  const color = RANK_COLORS_MAP[normalizeTier(tier)] ?? RANK_COLORS_MAP[0];
  if (color === undefined) {
    return WHITE;
  }
  const [r, g, b] = color;
  return fg(r, g, b);
}

function isPositiveInteger(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isInteger(value) && value > 0;
}

function getNonNegativeNumber(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function getNonNegativeInteger(value: number): number {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function fmtRank(
  name: string,
  rp: number,
  tier: number,
  champNumber?: number,
  leaderboardPosition?: number | null
): string {
  const col = rankColor(tier);
  const safeRp = getNonNegativeNumber(rp);
  const safeName = truncateText(name, MAX_LABEL_WIDTH);
  const rpStr =
    safeRp > 0 ? `${DIM} · ${RESET}${GREY}${NUMBER_FORMAT.format(safeRp)} RP${RESET}` : "";
  const positionStr = isPositiveInteger(champNumber)
    ? `${DIM} · ${RESET}${GREY}#${fmtNumber(champNumber)}${RESET}`
    : isPositiveInteger(leaderboardPosition)
      ? `${DIM} · ${RESET}${GREY}#${fmtNumber(leaderboardPosition)}${RESET}`
      : "";
  return `${col}${BOLD}${safeName}${RESET}${rpStr}${positionStr}`;
}

function fmtNumber(n: number): string {
  return NUMBER_FORMAT.format(getNonNegativeInteger(n));
}

export function buildStatLines(profile: PlayerProfile): string[] {
  const lines: StatLine[] = [];

  lines.push({
    kind: "header",
    text: `${BOLD}${WHITE}${truncateText(profile.username, MAX_USERNAME_WIDTH)}${RESET}  ${DIM}@ ${profile.platform}${RESET}`,
  });
  lines.push({ kind: "separator" });

  lines.push({ kind: "stat", key: "Level", value: fmtNumber(profile.level) });
  lines.push({ kind: "separator" });

  lines.push({
    kind: "stat",
    key: "Current Rank",
    value: fmtRank(
      profile.currentRank.name,
      profile.currentRank.rp,
      profile.currentRank.tier,
      profile.currentRank.champNumber,
      profile.leaderboardPosition
    ),
  });
  lines.push({
    kind: "stat",
    key: "Season Peak",
    value: fmtRank(
      profile.peakRankSeason.name,
      profile.peakRankSeason.rp,
      profile.peakRankSeason.tier,
      profile.peakRankSeason.champNumber
    ),
  });
  lines.push({
    kind: "stat",
    key: "All-Time Peak",
    value: fmtRank(
      profile.peakRankAllTime.name,
      profile.peakRankAllTime.rp,
      profile.peakRankAllTime.tier,
      profile.peakRankAllTime.champNumber
    ),
  });
  lines.push({ kind: "separator" });

  lines.push({ kind: "stat", key: "K/D", value: getNonNegativeNumber(profile.kd).toFixed(2) });
  lines.push({
    kind: "stat",
    key: "Win Rate",
    value: `${Math.min(100, getNonNegativeNumber(profile.winRate)).toFixed(0)}%`,
  });
  lines.push({ kind: "stat", key: "Kills", value: fmtNumber(profile.kills) });
  lines.push({ kind: "stat", key: "Deaths", value: fmtNumber(profile.deaths) });
  lines.push({
    kind: "stat",
    key: "Wins / Losses",
    value: `${fmtNumber(profile.wins)} / ${fmtNumber(profile.losses)}`,
  });

  if (profile.headshotPercent !== null) {
    lines.push({
      kind: "stat",
      key: "Headshot %",
      value: `${Math.min(100, getNonNegativeNumber(profile.headshotPercent)).toFixed(1)}%`,
    });
  }

  if (profile.topOperator !== null) {
    lines.push({
      kind: "stat",
      key: "Top Operator",
      value: truncateText(profile.topOperator, MAX_LABEL_WIDTH),
    });
  }

  return renderLines(lines);
}

function renderLines(lines: StatLine[]): string[] {
  let maxWidth = 0;
  for (const line of lines) {
    if (line.kind === "header") {
      maxWidth = Math.max(maxWidth, visualWidth(line.text));
    } else if (line.kind === "stat") {
      const lineWidth = KEY_WIDTH + 2 + visualWidth(line.value);
      maxWidth = Math.max(maxWidth, lineWidth);
    }
  }

  return lines.map((line) => {
    switch (line.kind) {
      case "header":
        return line.text;
      case "separator":
        return `${DIM}${"─".repeat(maxWidth)}${RESET}`;
      case "stat": {
        const key = padRight(`${GREY}${line.key}${RESET}`, KEY_WIDTH);
        const value = `${WHITE}${line.value}${RESET}`;
        return `${key}  ${value}`;
      }
    }
  });
}
