import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, View } from "react-native";
import { themes, type AppTheme, type ThemeMode } from "@/constants/theme";
import { readPersistedValue, writePersistedValue } from "@/lib/storage";

type ThemePreference = "system" | ThemeMode;

const THEME_PREF_KEY = "akhtar.themePreference";

type ThemeContextValue = {
  theme: AppTheme;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => Promise<void>;
  toggleTheme: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveMode(pref: ThemePreference): ThemeMode {
  if (pref === "system") {
    return Appearance.getColorScheme() === "light" ? "light" : "dark";
  }
  return pref;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [systemMode, setSystemMode] = useState<ThemeMode>(Appearance.getColorScheme() === "light" ? "light" : "dark");

  useEffect(() => {
    void (async () => {
      const persisted = await readPersistedValue(THEME_PREF_KEY);
      if (persisted === "dark" || persisted === "light" || persisted === "system") {
        setPreferenceState(persisted);
      }
    })();
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemMode(colorScheme === "light" ? "light" : "dark");
    });
    return () => sub.remove();
  }, []);

  const mode = preference === "system" ? systemMode : resolveMode(preference);
  const theme = themes[mode];

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      isDark: mode === "dark",
      preference,
      setPreference: async (next) => {
        setPreferenceState(next);
        await writePersistedValue(THEME_PREF_KEY, next);
      },
      toggleTheme: async () => {
        const next = mode === "dark" ? "light" : "dark";
        setPreferenceState(next);
        await writePersistedValue(THEME_PREF_KEY, next);
      },
    }),
    [theme, mode, preference],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View className={`${mode === "dark" ? "dark" : ""} flex-1`} style={{ backgroundColor: theme.colors.background }}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
