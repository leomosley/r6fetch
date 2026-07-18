#!/usr/bin/env bun
/**
 * scripts/gen-rank-art.ts
 *
 * Converts rank WebP images in packages/renderer/src/ranks/ into coloured
 * braille art and writes the result to:
 *   apps/web/src/rank-art-data.ts
 *
 * Braille technique:
 *   Each Unicode braille cell (U+2800–U+28FF) encodes a 2×4 dot grid:
 *
 *     dot layout per char:   bit values:
 *       col→  0  1            0x01  0x08
 *       row↓  ·  ·            0x02  0x10
 *             ·  ·            0x04  0x20
 *             ·  ·            0x40  0x80
 *
 *   Each dot is "on" if the corresponding source pixel is visible (alpha ≥ 32).
 *   The character is coloured with the average RGB of all visible dots in the cell.
 *
 *   Effective resolution: WIDTH×2 pixels wide, HEIGHT×4 pixels tall.
 *   e.g. 36 chars × 18 lines → 72×72 effective pixels (vs 36×36 with half-blocks).
 *
 * Run: bun gen:rank-art
 */

import sharp from "sharp";
import { writeFileSync } from "fs";
import { join } from "path";

// ── config ────────────────────────────────────────────────────────────────────

/** Visual character width of the output art. */
const WIDTH = 36;

/**
 * Visual line height of the output art.
 * For square appearance, keep HEIGHT = WIDTH / 2 × (4/2) = WIDTH.
 * Each braille char covers 2 px wide × 4 px tall.
 * Terminal cells are ~2× taller than wide, so:
 *   visual width  = WIDTH  chars × cell_width
 *   visual height = HEIGHT chars × cell_height  (cell_height ≈ 2 × cell_width)
 * For square: WIDTH × cell_width = HEIGHT × 2 × cell_width → HEIGHT = WIDTH / 2
 */
const HEIGHT = 18;

const RANKS_DIR = join(import.meta.dir, "../packages/renderer/src/ranks");
const OUT_FILE = join(import.meta.dir, "../apps/web/src/rank-art-data.ts");

const CHAMPION_NUMBER_SAMPLES = [1, 90, 1234, 5678] as const;
const CHAMPION_NUMBER_URL = (position: number) =>
  `https://static.stats.cc/siege/ranks/v7-champion-position-${position}-small.webp`;

/** Ordered to match tier indices 0–40 in RANK_NAMES. */
const RANK_SLUGS = [
  "unranked",
  "copper-v",
  "copper-iv",
  "copper-iii",
  "copper-ii",
  "copper-i",
  "bronze-v",
  "bronze-iv",
  "bronze-iii",
  "bronze-ii",
  "bronze-i",
  "silver-v",
  "silver-iv",
  "silver-iii",
  "silver-ii",
  "silver-i",
  "gold-v",
  "gold-iv",
  "gold-iii",
  "gold-ii",
  "gold-i",
  "platinum-v",
  "platinum-iv",
  "platinum-iii",
  "platinum-ii",
  "platinum-i",
  "emerald-v",
  "emerald-iv",
  "emerald-iii",
  "emerald-ii",
  "emerald-i",
  "diamond-v",
  "diamond-iv",
  "diamond-iii",
  "diamond-ii",
  "diamond-i",
  "champion-v",
  "champion-iv",
  "champion-iii",
  "champion-ii",
  "champion-i",
] as const;

// ── braille bit mapping ───────────────────────────────────────────────────────
// BRAILLE_BITS[row][col] → bit value to OR into the codepoint offset from U+2800.
const BRAILLE_BITS: readonly (readonly number[])[] = [
  [0x01, 0x08], // row 0: left dot1, right dot4
  [0x02, 0x10], // row 1: left dot2, right dot5
  [0x04, 0x20], // row 2: left dot3, right dot6
  [0x40, 0x80], // row 3: left dot7, right dot8
];

// ── config ────────────────────────────────────────────────────────────────────

/**
 * Alpha threshold for considering a pixel as "visible".
 * Higher values filter out shadow/glow effects around the badge.
 * The new v7 rank images have shadows that appear washed out at low thresholds.
 */
const ALPHA_THRESHOLD = 160;

// ── dominant colour extraction ────────────────────────────────────────────────

function hslSaturation(r: number, g: number, b: number): number {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return 0;
  const d = max - min;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}

/**
 * Returns [r, g, b] of the dominant accent colour in the image.
 * Prefers saturated (coloured) pixels over achromatic ones to pick the
 * badge's signature hue rather than white highlights or black shadows.
 */
async function extractDominantColor(filePath: string): Promise<[number, number, number]> {
  const { data, info } = await sharp(filePath)
    .resize(64, 64, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const n = info.width * info.height;
  let sumR = 0,
    sumG = 0,
    sumB = 0,
    total = 0;
  let cSumR = 0,
    cSumG = 0,
    cSumB = 0,
    colored = 0;

  for (let i = 0; i < n; i++) {
    const r = data[i * 4]!,
      g = data[i * 4 + 1]!,
      b = data[i * 4 + 2]!,
      a = data[i * 4 + 3]!;
    if (a < ALPHA_THRESHOLD) continue;

    sumR += r;
    sumG += g;
    sumB += b;
    total++;

    if (hslSaturation(r, g, b) > 0.15) {
      cSumR += r;
      cSumG += g;
      cSumB += b;
      colored++;
    }
  }

  if (total === 0) return [128, 128, 128];

  // Use saturated pixels if they make up at least 5 % of visible area
  if (colored >= total * 0.05) {
    return [Math.round(cSumR / colored), Math.round(cSumG / colored), Math.round(cSumB / colored)];
  }
  return [Math.round(sumR / total), Math.round(sumG / total), Math.round(sumB / total)];
}

// ── image → ANSI ──────────────────────────────────────────────────────────────

type SharpInput = string | Buffer;

async function imageToAnsiCells(input: SharpInput): Promise<string[][]> {
  // Resize to (WIDTH*2) × (HEIGHT*4) so each braille char covers exactly 2×4 px.
  const { data, info } = await sharp(input)
    .resize(WIDTH * 2, HEIGHT * 4, { fit: "fill", kernel: "lanczos3" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const lines: string[][] = [];

  for (let charRow = 0; charRow < HEIGHT; charRow++) {
    const line: string[] = [];

    for (let charCol = 0; charCol < WIDTH; charCol++) {
      let bits = 0;
      let sumR = 0,
        sumG = 0,
        sumB = 0,
        count = 0;

      // Sample the 2×4 pixel block for this braille cell.
      for (let dr = 0; dr < 4; dr++) {
        for (let dc = 0; dc < 2; dc++) {
          const px = charCol * 2 + dc;
          const py = charRow * 4 + dr;
          if (px >= width || py >= height) continue;

          const i = (py * width + px) * 4;
          const r = data[i]!,
            g = data[i + 1]!,
            b = data[i + 2]!,
            a = data[i + 3]!;

          if (a >= ALPHA_THRESHOLD) {
            bits |= BRAILLE_BITS[dr]![dc]!;
            sumR += r;
            sumG += g;
            sumB += b;
            count++;
          }
        }
      }

      if (count === 0) {
        line.push(" ");
      } else {
        const r = Math.round(sumR / count);
        const g = Math.round(sumG / count);
        const b = Math.round(sumB / count);
        const ch = String.fromCodePoint(0x2800 + bits);
        line.push(`\x1b[38;2;${r};${g};${b}m${ch}\x1b[0m`);
      }
    }

    lines.push(line);
  }

  return lines;
}

async function imageToAnsiLines(input: SharpInput): Promise<string[]> {
  return (await imageToAnsiCells(input)).map((line) => line.join(""));
}

async function fetchChampionNumberSamples(): Promise<Map<number, Buffer>> {
  const entries = await Promise.all(
    CHAMPION_NUMBER_SAMPLES.map(async (position) => {
      const response = await fetch(CHAMPION_NUMBER_URL(position));
      if (!response.ok) throw new Error(`Failed to download Champion #${position}`);
      return [position, Buffer.from(await response.arrayBuffer())] as const;
    })
  );
  return new Map(entries);
}

const DIGIT_SOURCES = [
  { digit: "0", sample: 90, left: 121, right: 150 },
  { digit: "1", sample: 1234, left: 61, right: 76 },
  { digit: "2", sample: 1234, left: 84, right: 111 },
  { digit: "3", sample: 1234, left: 115, right: 143 },
  { digit: "4", sample: 1234, left: 147, right: 177 },
  { digit: "5", sample: 5678, left: 58, right: 86 },
  { digit: "6", sample: 5678, left: 91, right: 119 },
  { digit: "7", sample: 5678, left: 122, right: 147 },
  { digit: "8", sample: 5678, left: 151, right: 180 },
  { digit: "9", sample: 90, left: 88, right: 116 },
] as const;

async function extractChampionDigits(samples: Map<number, Buffer>): Promise<string[][]> {
  const resized = new Map<number, Buffer>();
  for (const [position, input] of samples) {
    resized.set(
      position,
      await sharp(input)
        .resize(WIDTH * 2, HEIGHT * 4)
        .removeAlpha()
        .raw()
        .toBuffer()
    );
  }

  const top = Math.floor(85 * ((HEIGHT * 4) / 240));
  const bottom = Math.ceil(136 * ((HEIGHT * 4) / 240));
  return DIGIT_SOURCES.map(({ sample, left, right }) => {
    const data = resized.get(sample)!;
    const start = Math.floor(left * ((WIDTH * 2) / 240));
    const end = Math.ceil((right + 1) * ((WIDTH * 2) / 240));
    const rows: string[] = [];
    for (let y = top; y < bottom; y++) {
      let row = "";
      for (let x = start; x < end; x++) {
        const offset = (y * WIDTH * 2 + x) * 3;
        const visible = data[offset]! > 80 && data[offset + 1]! > 80 && data[offset + 2]! > 80;
        row += visible ? "1" : "0";
      }
      rows.push(row);
    }
    return rows;
  });
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const pw = WIDTH * 2,
    ph = HEIGHT * 4;
  console.log(
    `Converting ${RANK_SLUGS.length} ranks → ${WIDTH}×${HEIGHT} chars (${pw}×${ph} effective pixels)...\n`
  );

  const allArt: string[][] = [];
  const allColors: [number, number, number][] = [];

  for (const slug of RANK_SLUGS) {
    const filePath = join(RANKS_DIR, `${slug}-small.webp`);
    process.stdout.write(`  ${slug.padEnd(14)} `);
    const [lines, color] = await Promise.all([
      imageToAnsiLines(filePath),
      extractDominantColor(filePath),
    ]);
    allArt.push(lines);
    allColors.push(color);
    console.log(`→ ${lines.length} lines  color: rgb(${color.join(", ")})`);
  }

  const numberSamples = await fetchChampionNumberSamples();
  const blankChampion = await sharp(numberSamples.get(1)!)
    .composite([
      {
        input: { create: { width: 32, height: 62, channels: 4, background: "#000000" } },
        left: 104,
        top: 79,
      },
    ])
    .webp({ lossless: true })
    .toBuffer();
  const championNumberCells = await imageToAnsiCells(blankChampion);
  const championDigits = await extractChampionDigits(numberSamples);

  const entries = allArt.map((lines, tier) => {
    const slug = RANK_SLUGS[tier];
    const serial = lines.map((l) => `    ${JSON.stringify(l)}`).join(",\n");
    return `  // tier ${tier}: ${slug}\n  [\n${serial},\n  ]`;
  });

  const colorEntries = allColors
    .map((c, tier) => `  [${c.join(", ")}], // tier ${tier}: ${RANK_SLUGS[tier]}`)
    .join("\n");

  const ts = `\
// AUTO-GENERATED by scripts/gen-rank-art.ts — do not edit manually.
// Re-run: bun gen:rank-art
//
// Tiers: 0 = Unranked, 1-5 = Copper, 6-10 = Bronze, 11-15 = Silver,
//        16-20 = Gold, 21-25 = Platinum, 26-30 = Emerald,
//        31-35 = Diamond, 36-40 = Champion

/** Visual character width of every art line. */
export const ART_WIDTH = ${WIDTH};

/**
 * Dominant accent colour per rank tier, extracted from the badge image.
 * Each entry is [r, g, b] (0–255).
 */
export const RANK_COLORS_MAP: readonly [number, number, number][] = [
${colorEntries}
];

/**
 * Pre-coloured ANSI braille art indexed by rank tier (0–40).
 * Each inner array has ${HEIGHT} lines × ${WIDTH} chars (${pw}×${ph} effective pixels).
 */
export const RANK_ART_MAP: readonly (readonly string[])[] = [
${entries.join(",\n")},
];

/** Blank numbered Champion badge, stored as cells for runtime digit composition. */
export const CHAMPION_NUMBER_CELLS: readonly (readonly string[])[] = ${JSON.stringify(championNumberCells)};

/** Monochrome 72px-space glyph masks indexed by digit. */
export const CHAMPION_DIGIT_MASKS: readonly (readonly string[])[] = ${JSON.stringify(championDigits)};
`;

  writeFileSync(OUT_FILE, ts, "utf8");
  console.log(`\nWritten → ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
