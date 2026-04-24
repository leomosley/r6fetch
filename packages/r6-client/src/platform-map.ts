import type { Platform } from "./types";

export interface PlatformParams {
  platformType: "uplay" | "psn" | "xbl";
  platformFamily: "pc" | "console";
}

const PLATFORM_MAP: Record<Platform, PlatformParams> = {
  pc: { platformType: "uplay", platformFamily: "pc" },
  ps: { platformType: "psn", platformFamily: "console" },
  xbox: { platformType: "xbl", platformFamily: "console" },
};

export function getPlatformParams(platform: Platform): PlatformParams {
  return PLATFORM_MAP[platform];
}

export function isValidPlatform(value: string): value is Platform {
  return value === "pc" || value === "ps" || value === "xbox";
}
