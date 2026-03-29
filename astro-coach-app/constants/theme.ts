export type ThemeMode = "dark" | "light";

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  x2: 32,
  x3: 40,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
} as const;

export const typography = {
  family: {
    regular: "Vazirmatn-Regular",
    medium: "Vazirmatn-Medium",
    semibold: "Vazirmatn-SemiBold",
    bold: "Vazirmatn-Bold",
  },
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 28,
    x2: 36,
  },
  lineHeight: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 28,
    xl: 34,
    x2: 44,
  },
} as const;

export const elevation = {
  level0: {
    shadowColor: "#000000",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  level1: {
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
} as const;

export const themes = {
  dark: {
    colors: {
      primary: "#8b8cff",
      onPrimary: "#0b1020",
      primaryContainer: "#222a53",
      onPrimaryContainer: "#e3e5ff",
      secondary: "#68d5ff",
      onSecondary: "#00212d",
      /** Full-bleed screen canvas — matches reference “pure black” */
      background: "#000000",
      onBackground: "#f8fafc",
      /** Cards / elevated rows */
      surface: "#0f172a",
      onSurface: "#f8fafc",
      surfaceVariant: "#1e293b",
      onSurfaceVariant: "#94a3b8",
      /** Hairline UI strokes on dark canvas */
      outline: "#ffffff33",
      outlineVariant: "#334155",
      error: "#f43f5e",
      onError: "#ffffff",
      /** Deep red background for error states */
      errorContainer: "#4d0000",
      /** Light red text on error container */
      onErrorContainer: "#ffb4ab",
      success: "#22c55e",
      warning: "#f59e0b",
      cardAccent1: "#1f62ff",
      cardAccent2: "#8f2fff",
      cardAccent3: "#19c8ff",
      cardAccent4: "#f6a320",
      cardAccent5: "#39d44a",
      cardAccent6: "#704dff",
    },
  },
  light: {
    colors: {
      primary: "#4f46e5",
      onPrimary: "#ffffff",
      primaryContainer: "#e0e7ff",
      onPrimaryContainer: "#1e1b4b",
      secondary: "#0a7cb4",
      onSecondary: "#ffffff",
      background: "#ffffff",
      onBackground: "#0f172a",
      surface: "#f8fafc",
      onSurface: "#0f172a",
      surfaceVariant: "#e2e8f0",
      onSurfaceVariant: "#334155",
      outline: "#cbd5e1",
      outlineVariant: "#e2e8f0",
      error: "#e11d48",
      onError: "#ffffff",
      /** Deep red background for error states */
      errorContainer: "#4d0000",
      /** Light red text on error container */
      onErrorContainer: "#ffb4ab",
      success: "#15803d",
      warning: "#b45309",
      cardAccent1: "#1f62ff",
      cardAccent2: "#8f2fff",
      cardAccent3: "#19c8ff",
      cardAccent4: "#f6a320",
      cardAccent5: "#39d44a",
      cardAccent6: "#704dff",
    },
  },
} as const;

export type AppTheme = (typeof themes)[ThemeMode];
