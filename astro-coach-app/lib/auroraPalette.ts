import type { ColorSchemeName } from "react-native";

export const AURORA_BASE_DARK = "#06080f";
export const AURORA_BASE_LIGHT = "#e8edf5";

/** Canvas base aligned with in-app dark/light (`useTheme().isDark`). */
export const auroraCanvasBackground = (isDark: boolean): string =>
  isDark ? AURORA_BASE_DARK : AURORA_BASE_LIGHT;

/** Map RN `ColorSchemeName` (null → light). Prefer `auroraCanvasBackground` with app theme. */
export const auroraRootBackground = (scheme: ColorSchemeName): string =>
  scheme === "dark" ? AURORA_BASE_DARK : AURORA_BASE_LIGHT;

/**
 * Soft three-stop gradient for planetary accent bands (Transits V2 aurora ribbon).
 * Keeps outer stops near canvas base so the hero color reads as tint, not neon block.
 */
export const planetaryAuroraStops = (
  accentHex: string,
  isDark: boolean,
): readonly [string, string, string] => {
  const base = auroraCanvasBackground(isDark);
  const mid = `${accentHex}66`;
  const inner = `${accentHex}aa`;
  return [base, mid, inner];
};
