import { useTheme } from "@/providers/ThemeProvider";

/**
 * Text and surface tokens aligned with in-app appearance (same as `CosmicBackground` / `auroraCanvasBackground`).
 */
export const useThemeColors = () => {
  const { isDark: dark } = useTheme();
  const scheme = dark ? ("dark" as const) : ("light" as const);

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

    sectionHeading: dark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.40)",

    rowLabel: dark ? "rgba(255,255,255,0.88)" : "rgba(0,0,0,0.82)",

    rowGroupBackground: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.65)",

    skeletonMuted: dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",

    sheetBackground: dark ? "#0f172a" : "#f1f5f9",

    isDark: dark,
    scheme,
  };
};
