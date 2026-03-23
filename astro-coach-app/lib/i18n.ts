import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { I18nManager, Platform } from "react-native";
import en from "@/locales/en.json";
import fa from "@/locales/fa.json";
import { readPersistedValue, writePersistedValue } from "@/lib/storage";

export const LANGUAGE_PREF_KEY = "akhtar.language";
export const ONBOARDING_LANG_SELECTED_KEY = "akhtar.languageSelected";

const resources = {
  en: { translation: en },
  fa: { translation: fa },
} as const;

export type AppLanguage = keyof typeof resources;

export function isRtlLanguage(language: string): boolean {
  return language === "fa";
}

export async function applyLayoutDirection(language: string) {
  const rtl = isRtlLanguage(language);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
    if (Platform.OS !== "web") {
      console.warn("[i18n] RTL direction changed. App restart may be required on native.");
    }
  }
}

/**
 * Device language without `expo-localization` (avoids native `ExpoLocalization` in dev clients
 * that were built before the module was linked — same pattern as web-safe native stubs).
 */
function getDeviceLanguageCodeFromIntl(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const code = locale.split(/[-_]/)[0]?.toLowerCase();
    return code?.length ? code : "en";
  } catch {
    return "en";
  }
}

export async function getPersistedLanguage(): Promise<AppLanguage> {
  const stored = await readPersistedValue(LANGUAGE_PREF_KEY);
  if (stored === "fa" || stored === "en") return stored;
  const code = getDeviceLanguageCodeFromIntl();
  return code === "en" ? "en" : "fa";
}

export async function changeLanguage(language: AppLanguage): Promise<void> {
  await i18n.changeLanguage(language);
  await applyLayoutDirection(language);
  await writePersistedValue(LANGUAGE_PREF_KEY, language);
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
  }
  await applyLayoutDirection(initial);
}

export default i18n;
