import { useColorScheme } from "react-native";

/**
 * Text and surface tokens aligned with **system** light/dark (same as `CosmicBackground` / `auroraRootBackground`).
 * Use on aurora-backed screens so copy stays readable when the canvas follows the device appearance.
 */
export const useThemeColors = () => {
  const scheme = useColorScheme();
  const dark = scheme === "dark";

  return {
    textPrimary: dark ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.88)",
    textSecondary: dark ? "rgba(255,255,255,0.60)" : "rgba(0,0,0,0.55)",
    textTertiary: dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",

    surfacePrimary: dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.70)",
    surfaceSecondary: dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.50)",

    border: dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.09)",
    borderSubtle: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",

    iconPrimary: dark ? "rgba(255,255,255,0.80)" : "rgba(0,0,0,0.65)",
    iconSecondary: dark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.35)",

    navIcon: dark ? "#ffffff" : "#1a1a2e",

    /** Section titles (e.g. settings). */
    sectionHeading: dark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.40)",

    /** Settings-style row label on aurora. */
    rowLabel: dark ? "rgba(255,255,255,0.88)" : "rgba(0,0,0,0.82)",

    /** Grouped list well behind rows. */
    rowGroupBackground: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.65)",

    /** Skeleton blocks / shimmer placeholders on aurora. */
    skeletonMuted: dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",

    /** Slide-up modal sheet (not full-bleed aurora). */
    sheetBackground: dark ? "#0f172a" : "#f1f5f9",

    isDark: dark,
    scheme,
  };
};
