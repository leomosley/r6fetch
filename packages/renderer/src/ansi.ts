export const RESET = "\u001b[0m";
export const BOLD = "\u001b[1m";
export const DIM = "\u001b[2m";

export function fg(r: number, g: number, b: number): string {
  return `\u001b[38;2;${r};${g};${b}m`;
}

function isControlCharacter(codePoint: number): boolean {
  return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
}

function isZeroWidth(codePoint: number): boolean {
  return (
    codePoint === 0x200b ||
    codePoint === 0x200c ||
    codePoint === 0x200d ||
    (codePoint >= 0x0300 && codePoint <= 0x036f) ||
    (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
    (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
    (codePoint >= 0x20d0 && codePoint <= 0x20ff) ||
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
    (codePoint >= 0xfe20 && codePoint <= 0xfe2f)
  );
}

function isEmojiModifier(codePoint: number): boolean {
  return codePoint >= 0x1f3fb && codePoint <= 0x1f3ff;
}

function isWide(codePoint: number): boolean {
  return (
    codePoint >= 0x1100 &&
    (codePoint <= 0x115f ||
      codePoint === 0x2329 ||
      codePoint === 0x232a ||
      (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
      (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
      (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
      (codePoint >= 0xff00 && codePoint <= 0xff60) ||
      (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
      (codePoint >= 0x1f300 && codePoint <= 0x1faff) ||
      (codePoint >= 0x20000 && codePoint <= 0x3fffd))
  );
}

export function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
}

export function sanitizeTerminalText(value: string): string {
  return Array.from(value)
    .filter((character) => !isControlCharacter(character.codePointAt(0) ?? 0))
    .join("");
}

function getTextClusters(value: string): string[] {
  const clusters: string[] = [];
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    const previous = clusters.at(-1);
    if (
      previous !== undefined &&
      (isZeroWidth(codePoint) || isEmojiModifier(codePoint) || previous.endsWith("\u200d"))
    ) {
      clusters[clusters.length - 1] = `${previous}${character}`;
    } else {
      clusters.push(character);
    }
  }
  return clusters;
}

export function visualWidth(value: string): number {
  let width = 0;
  for (const cluster of getTextClusters(stripAnsi(value))) {
    let clusterWidth = 0;
    for (const character of cluster) {
      const codePoint = character.codePointAt(0) ?? 0;
      if (!isControlCharacter(codePoint) && !isZeroWidth(codePoint)) {
        clusterWidth = Math.max(clusterWidth, isWide(codePoint) ? 2 : 1);
      }
    }
    width += clusterWidth;
  }
  return width;
}

export function truncateText(value: string, maxWidth: number): string {
  const sanitized = sanitizeTerminalText(value);
  if (visualWidth(sanitized) <= maxWidth) {
    return sanitized;
  }

  let result = "";
  for (const cluster of getTextClusters(sanitized)) {
    if (visualWidth(`${result}${cluster}…`) > maxWidth) {
      break;
    }
    result += cluster;
  }
  return `${result}…`;
}

export function padRight(value: string, width: number): string {
  return value + " ".repeat(Math.max(0, width - visualWidth(value)));
}
