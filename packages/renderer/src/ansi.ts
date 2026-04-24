// ANSI escape code helpers

export const RESET = "\x1b[0m";
export const BOLD = "\x1b[1m";
export const DIM = "\x1b[2m";

/** 24-bit foreground colour */
export function fg(r: number, g: number, b: number): string {
  return `\x1b[38;2;${r};${g};${b}m`;
}

/** 24-bit background colour */
export function bg(r: number, g: number, b: number): string {
  return `\x1b[48;2;${r};${g};${b}m`;
}

/** Strip all ANSI escape codes to measure visual width */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

/** Visual character width (excluding ANSI codes) */
export function visualWidth(str: string): number {
  return stripAnsi(str).length;
}

/** Pad a string on the right to a given visual width */
export function padRight(str: string, width: number): string {
  const vw = visualWidth(str);
  return str + " ".repeat(Math.max(0, width - vw));
}

/** Pad a string on the left to a given visual width */
export function padLeft(str: string, width: number): string {
  const vw = visualWidth(str);
  return " ".repeat(Math.max(0, width - vw)) + str;
}

/** Centre a string within a given visual width */
export function centre(str: string, width: number): string {
  const vw = visualWidth(str);
  const total = Math.max(0, width - vw);
  const left = Math.floor(total / 2);
  const right = total - left;
  return " ".repeat(left) + str + " ".repeat(right);
}
