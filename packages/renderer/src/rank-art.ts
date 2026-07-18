import {
  ART_WIDTH,
  CHAMPION_DIGIT_MASKS,
  CHAMPION_NUMBER_CELLS,
  RANK_ART_MAP,
} from "./rank-art-data";

export { ART_WIDTH };

const WHITE = "\u001b[38;2;255;255;255m";
const RESET = "\u001b[0m";
const DIGIT_GAP = 1;
const BRAILLE_BITS: readonly (readonly [number, number])[] = [
  [1, 8],
  [2, 16],
  [4, 32],
  [64, 128],
];

export function normalizeTier(tier: number): number {
  return Number.isFinite(tier) ? Math.max(0, Math.min(40, Math.round(tier))) : 0;
}

function getChampionNumberArt(position: number): string[] {
  const digits = position
    .toString()
    .split("")
    .flatMap((digit) => {
      const mask = CHAMPION_DIGIT_MASKS[Number(digit)];
      return mask === undefined ? [] : [mask];
    });
  const firstDigit = digits[0];
  if (firstDigit === undefined) {
    return [...(RANK_ART_MAP[40] ?? [])];
  }

  const height = firstDigit.length;
  const width =
    digits.reduce((total, digit) => total + (digit[0]?.length ?? 0), 0) +
    DIGIT_GAP * (digits.length - 1);
  const startX = Math.floor((ART_WIDTH * 2 - width) / 2);
  const startY = 25;
  const masks = Array.from({ length: CHAMPION_NUMBER_CELLS.length }, () =>
    Array<number>(ART_WIDTH).fill(0)
  );

  let xOffset = startX;
  for (const digit of digits) {
    for (let y = 0; y < height; y++) {
      const digitRow = digit[y];
      if (digitRow === undefined) {
        continue;
      }
      for (let x = 0; x < digitRow.length; x++) {
        if (digitRow[x] !== "1") {
          continue;
        }
        const pixelX = xOffset + x;
        const pixelY = startY + y;
        const bit = BRAILLE_BITS[pixelY % 4]?.[pixelX % 2];
        const maskRow = masks[Math.floor(pixelY / 4)];
        const maskColumn = Math.floor(pixelX / 2);
        if (bit !== undefined && maskRow?.[maskColumn] !== undefined) {
          maskRow[maskColumn] += bit;
        }
      }
    }
    xOffset += (digit[0]?.length ?? 0) + DIGIT_GAP;
  }

  return CHAMPION_NUMBER_CELLS.map((line, row) =>
    line
      .map((cell, column) => {
        const mask = masks[row]?.[column] ?? 0;
        return mask ? `${WHITE}${String.fromCodePoint(0x2800 + mask)}${RESET}` : cell;
      })
      .join("")
  );
}

export function getRankArt(tier: number, champNumber?: number): string[] {
  const clamped = normalizeTier(tier);
  if (
    clamped === 40 &&
    champNumber !== undefined &&
    Number.isInteger(champNumber) &&
    champNumber >= 1 &&
    champNumber <= 9999
  ) {
    return getChampionNumberArt(champNumber);
  }
  return [...(RANK_ART_MAP[clamped] ?? RANK_ART_MAP[0] ?? [])];
}
