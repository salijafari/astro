import type { ColorSchemeName } from "react-native";

export const AURORA_BASE_DARK = "#06080f";
export const AURORA_BASE_LIGHT = "#e8edf5";

/** Canvas base aligned with in-app dark/light (`useTheme().isDark`). */
export const auroraCanvasBackground = (isDark: boolean): string =>
  isDark ? AURORA_BASE_DARK : AURORA_BASE_LIGHT;

/** Map RN `ColorSchemeName` (null → light). Prefer `auroraCanvasBackground` with app theme. */
export const auroraRootBackground = (scheme: ColorSchemeName): string =>
  scheme === "dark" ? AURORA_BASE_DARK : AURORA_BASE_LIGHT;
