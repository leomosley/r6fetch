import type { PlayerProfile } from "@r6fetch/r6-client";
import { fg, RESET, BOLD, DIM, padRight } from "~/ansi";
import { RANK_COLORS_MAP } from "~/rank-art-data";

const STAT_KEYS = [
  "Level",
  "Current Rank",
  "Peak Rank",
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

type StatLine =
  | { kind: "header"; text: string }
  | { kind: "separator" }
  | { kind: "blank" }
  | { kind: "stat"; key: string; value: string; valueColor?: string };

function rankColor(tier: number): string {
  const clamped = Math.max(0, Math.min(36, tier));
  const [r, g, b] = RANK_COLORS_MAP[clamped]!;
  return fg(r, g, b);
}

function fmtRank(name: string, mmr: number, tier: number): string {
  const col = rankColor(tier);
  const mmrStr = mmr > 0 ? `${DIM} · ${RESET}${GREY}${mmr.toLocaleString()} MMR${RESET}` : "";
  return `${col}${BOLD}${name}${RESET}${mmrStr}`;
}

function fmtNumber(n: number): string {
  return n.toLocaleString();
}

export function buildStatLines(profile: PlayerProfile): string[] {
  const lines: StatLine[] = [];

  lines.push({
    kind: "header",
    text: `${BOLD}${WHITE}${profile.username}${RESET}  ${DIM}@ ${profile.platform}${RESET}`,
  });
  lines.push({ kind: "separator" });

  lines.push({ kind: "stat", key: "Level", value: fmtNumber(profile.level) });
  lines.push({ kind: "separator" });

  lines.push({
    kind: "stat",
    key: "Current Rank",
    value: fmtRank(profile.currentRank.name, profile.currentRank.mmr, profile.currentRank.tier),
  });
  lines.push({
    kind: "stat",
    key: "Peak Rank",
    value: fmtRank(
      profile.peakRankAllTime.name,
      profile.peakRankAllTime.mmr,
      profile.peakRankAllTime.tier
    ),
  });
  lines.push({ kind: "separator" });

  lines.push({ kind: "stat", key: "K/D", value: profile.kd.toFixed(2) });
  lines.push({
    kind: "stat",
    key: "Win Rate",
    value: (() => {
      const ratio =
        profile.losses > 0 ? (profile.wins / profile.losses).toFixed(2) : profile.wins.toFixed(2);
      const pct =
        profile.wins + profile.losses > 0
          ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100)
          : 0;
      return `${ratio} (${pct}%)`;
    })(),
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
      value: `${profile.headshotPercent.toFixed(1)}%`,
    });
  }

  if (profile.topOperator !== null) {
    lines.push({ kind: "stat", key: "Top Operator", value: profile.topOperator });
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
        const key = padRight(`${GREY}${line.key}${RESET}`, KEY_WIDTH);
        const value = line.valueColor
          ? `${line.valueColor}${line.value}${RESET}`
          : `${WHITE}${line.value}${RESET}`;
        return `${key}  ${value}`;
      }
    }
  });
}
