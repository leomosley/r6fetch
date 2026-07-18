import {
  ART_WIDTH,
  CHAMPION_DIGIT_MASKS,
  CHAMPION_NUMBER_CELLS,
  RANK_ART_MAP,
} from "./rank-art-data";

export { ART_WIDTH };

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns pre-coloured ANSI ASCII-art lines for the given rank tier.
 * Tiers: 0 = Unranked, 1-5 = Copper, 6-10 = Bronze, 11-15 = Silver,
 *        16-20 = Gold, 21-25 = Platinum, 26-30 = Emerald,
 *        31-35 = Diamond, 36-40 = Champion
 * Regenerate art: bun gen:rank-art
 */
const WHITE = "\x1b[38;2;255;255;255m";
const RESET = "\x1b[0m";
const DIGIT_GAP = 1;
const BRAILLE_BITS = [
  [1, 8],
  [2, 16],
  [4, 32],
  [64, 128],
] as const;

function getChampionNumberArt(position: number): string[] {
  const digits = Math.max(1, Math.min(9999, Math.trunc(position)))
    .toString()
    .split("")
    .map((digit) => CHAMPION_DIGIT_MASKS[Number(digit)]!);
  const height = digits[0]!.length;
  const width =
    digits.reduce((total, digit) => total + digit[0]!.length, 0) + DIGIT_GAP * (digits.length - 1);
  const startX = Math.floor((ART_WIDTH * 2 - width) / 2);
  const startY = 25;
  const masks = Array.from({ length: CHAMPION_NUMBER_CELLS.length }, () =>
    Array<number>(ART_WIDTH).fill(0)
  );

  let xOffset = startX;
  for (const digit of digits) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < digit[y]!.length; x++) {
        if (digit[y]![x] !== "1") continue;
        const pixelX = xOffset + x;
        const pixelY = startY + y;
        const bit = BRAILLE_BITS[pixelY % 4]![pixelX % 2]!;
        masks[Math.floor(pixelY / 4)]![Math.floor(pixelX / 2)]! |= bit;
      }
    }
    xOffset += digit[0]!.length + DIGIT_GAP;
  }

  return CHAMPION_NUMBER_CELLS.map((line, row) =>
    line
      .map((cell, column) => {
        const mask = masks[row]![column]!;
        return mask ? `${WHITE}${String.fromCodePoint(0x2800 + mask)}${RESET}` : cell;
      })
      .join("")
  );
}

export function getRankArt(tier: number, champNumber?: number): string[] {
  const clamped = Math.max(0, Math.min(40, tier));
  if (clamped === 40 && champNumber !== undefined && champNumber >= 1 && champNumber <= 9999) {
    return getChampionNumberArt(champNumber);
  }
  return [...RANK_ART_MAP[clamped]!];
}
