import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { I18nManager, Platform } from "react-native";
import en from "@/locales/en.json";
import fa from "@/locales/fa.json";
import { readPersistedValue, writePersistedValue } from "@/lib/storage";

export const LANGUAGE_PREF_KEY = "akhtar.language";

const resources = {
  en: { translation: en },
  fa: { translation: fa },
} as const;

export type AppLanguage = keyof typeof resources;

const RTL_MIGRATION_KEY = "akhtar.rtl-migration-v1-done";

/**
 * Whether the given (or current) UI language is Persian / RTL script.
 * Prefer this over ad-hoc `fa` checks on `i18n.language` for layout-agnostic script detection.
 */
export const isPersian = (lang?: string): boolean => {
  const effective = lang ?? i18n.language ?? "en";
  return effective.startsWith("fa");
};

export function isRtlLanguage(language: string): boolean {
  return isPersian(language);
}

/**
 * @deprecated Global RTL mirroring via native manager was removed. No-op; kept so any stale imports do not break.
 */
export async function applyLayoutDirection(_language: string): Promise<void> {
  return;
}

/**
 * One-time native reset for installs that previously had `forceRTL(true)` applied.
 * Locks `allowRTL(false)` and clears forced RTL when needed. Safe to call on every cold start.
 * @returns `true` if native layout was reset and the app should reload so LTR takes effect.
 */
export const migrateLegacyRTL = async (): Promise<boolean> => {
  if (Platform.OS === "web") return false;

  try {
    const alreadyMigrated = await AsyncStorage.getItem(RTL_MIGRATION_KEY);
    if (alreadyMigrated === "true") return false;

    const needsReset = I18nManager.isRTL;

    I18nManager.allowRTL(false);

    if (needsReset) {
      I18nManager.forceRTL(false);
    }

    await AsyncStorage.setItem(RTL_MIGRATION_KEY, "true");

    return needsReset;
  } catch (err) {
    console.warn("[migrateLegacyRTL] migration failed:", err);
    return false;
  }
};

/**
 * Returns persisted UI language, or Persian for first launch (primary audience).
 * We intentionally do not infer English from device locale — new users default to `fa`.
 */
export async function getPersistedLanguage(): Promise<AppLanguage> {
  const stored = await readPersistedValue(LANGUAGE_PREF_KEY);
  if (stored === "fa" || stored === "en") return stored;
  return "fa";
}

export async function changeLanguage(language: AppLanguage): Promise<void> {
  await writePersistedValue(LANGUAGE_PREF_KEY, language);
  await i18n.changeLanguage(language);
}

export async function initializeI18n() {
  const initial = await getPersistedLanguage();
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      compatibilityJSON: "v4",
      resources,
      lng: initial,
      fallbackLng: "fa",
      interpolation: { escapeValue: false },
    });
  } else {
    await i18n.changeLanguage(initial);
  }
  const raw = await readPersistedValue(LANGUAGE_PREF_KEY);
  if (raw !== "fa" && raw !== "en") {
    await writePersistedValue(LANGUAGE_PREF_KEY, initial);
  }
}

export default i18n;
