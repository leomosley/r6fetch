import type { PlayerProfile } from "@r6fetch/r6-client";
import { fg, RESET, BOLD, DIM, padRight } from "./ansi";
import { tierToGroup, RANK_COLORS } from "./rank-colors";

const KEY_WIDTH = 18;
const GREY = fg(160, 160, 160);
const WHITE = fg(230, 230, 230);

type StatLine =
  | { kind: "header"; text: string }
  | { kind: "separator" }
  | { kind: "blank" }
  | { kind: "stat"; key: string; value: string; valueColor?: string };

function rankColor(tier: number): string {
  const { r, g, b } = RANK_COLORS[tierToGroup(tier)];
  return fg(r, g, b);
}

function fmtRank(name: string, mmr: number, tier: number): string {
  const col = rankColor(tier);
  const mmrStr =
    mmr > 0
      ? `${DIM} · ${RESET}${GREY}${mmr.toLocaleString()} MMR${RESET}`
      : "";
  return `${col}${BOLD}${name}${RESET}${mmrStr}`;
}

function fmtNumber(n: number): string {
  return n.toLocaleString();
}

export function buildStatLines(profile: PlayerProfile): string[] {
  const lines: StatLine[] = [];

  // ── Header ──────────────────────────────────────
  lines.push({
    kind: "header",
    text: `${BOLD}${WHITE}${profile.username}${RESET}  ${DIM}@ ${profile.platform}${RESET}`,
  });
  lines.push({ kind: "separator" });

  // ── Account ──────────────────────────────────────
  lines.push({
    kind: "stat",
    key: "Level",
    value: fmtNumber(profile.level),
  });
  lines.push({
    kind: "stat",
    key: "Hours Played",
    value: `${fmtNumber(profile.hoursPlayed)}h`,
  });
  lines.push({ kind: "separator" });

  // ── Rank ─────────────────────────────────────────
  lines.push({
    kind: "stat",
    key: "Current Rank",
    value: fmtRank(
      profile.currentRank.name,
      profile.currentRank.mmr,
      profile.currentRank.tier,
    ),
  });
  lines.push({
    kind: "stat",
    key: "Peak (Season)",
    value: fmtRank(
      profile.peakRankSeason.name,
      profile.peakRankSeason.mmr,
      profile.peakRankSeason.tier,
    ),
  });
  lines.push({
    kind: "stat",
    key: "Peak (All Time)",
    value:
      rankColor(profile.peakRankAllTime.tier) +
      BOLD +
      profile.peakRankAllTime.name +
      RESET,
  });
  lines.push({ kind: "separator" });

  // ── Performance ───────────────────────────────────
  lines.push({ kind: "stat", key: "K/D", value: profile.kd.toFixed(2) });
  lines.push({
    kind: "stat",
    key: "Win Rate",
    value: `${profile.winRate}%`,
  });
  lines.push({
    kind: "stat",
    key: "Kills",
    value: fmtNumber(profile.kills),
  });
  lines.push({
    kind: "stat",
    key: "Wins / Losses",
    value: `${fmtNumber(profile.wins)} / ${fmtNumber(profile.losses)}`,
  });

  if (profile.headshotPercent !== null) {
    lines.push({
      kind: "stat",
      key: "Headshot %",
      value: `${profile.headshotPercent.toFixed(1)}%`,
    });
  }

  if (profile.topOperator !== null) {
    lines.push({
      kind: "stat",
      key: "Top Operator",
      value: profile.topOperator,
    });
  }

  return renderLines(lines);
}

function renderLines(lines: StatLine[]): string[] {
  return lines.map((line) => {
    switch (line.kind) {
      case "header":
        return line.text;

      case "separator":
        return `${DIM}${"─".repeat(42)}${RESET}`;

      case "blank":
        return "";

      case "stat": {
        const key = padRight(
          `${GREY}${line.key}${RESET}`,
          KEY_WIDTH + GREY.length + RESET.length,
        );
        const value = line.valueColor
          ? `${line.valueColor}${line.value}${RESET}`
          : `${WHITE}${line.value}${RESET}`;
        return `${key}  ${value}`;
      }
    }
  });
}
