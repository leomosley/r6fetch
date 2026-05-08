#!/usr/bin/env bun
/**
 * scripts/gen-rank-art.ts
 *
 * Converts rank WebP images in packages/renderer/src/ranks/ into coloured
 * braille art and writes the result to:
 *   packages/renderer/src/rank-art-data.ts
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
const OUT_FILE = join(import.meta.dir, "../packages/renderer/src/rank-art-data.ts");

/** Ordered to match tier indices 0–36 in RANK_NAMES. */
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
  "champion-star",
] as const;

// ── braille bit mapping ───────────────────────────────────────────────────────
// BRAILLE_BITS[row][col] → bit value to OR into the codepoint offset from U+2800.
const BRAILLE_BITS: readonly (readonly number[])[] = [
  [0x01, 0x08], // row 0: left dot1, right dot4
  [0x02, 0x10], // row 1: left dot2, right dot5
  [0x04, 0x20], // row 2: left dot3, right dot6
  [0x40, 0x80], // row 3: left dot7, right dot8
];

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
    if (a < 32) continue;

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

async function imageToAnsiLines(filePath: string): Promise<string[]> {
  // Resize to (WIDTH*2) × (HEIGHT*4) so each braille char covers exactly 2×4 px.
  const { data, info } = await sharp(filePath)
    .resize(WIDTH * 2, HEIGHT * 4, { fit: "fill", kernel: "lanczos3" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const lines: string[] = [];

  for (let charRow = 0; charRow < HEIGHT; charRow++) {
    let line = "";

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

          if (a >= 32) {
            bits |= BRAILLE_BITS[dr]![dc]!;
            sumR += r;
            sumG += g;
            sumB += b;
            count++;
          }
        }
      }

      if (count === 0) {
        line += " ";
      } else {
        const r = Math.round(sumR / count);
        const g = Math.round(sumG / count);
        const b = Math.round(sumB / count);
        const ch = String.fromCodePoint(0x2800 + bits);
        line += `\x1b[38;2;${r};${g};${b}m${ch}\x1b[0m`;
      }
    }

    lines.push(line);
  }

  return lines;
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
//        31-35 = Diamond, 36 = Champion

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
 * Pre-coloured ANSI braille art indexed by rank tier (0–36).
 * Each inner array has ${HEIGHT} lines × ${WIDTH} chars (${pw}×${ph} effective pixels).
 */
export const RANK_ART_MAP: readonly (readonly string[])[] = [
${entries.join(",\n")},
];
`;

  writeFileSync(OUT_FILE, ts, "utf8");
  console.log(`\nWritten → ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
