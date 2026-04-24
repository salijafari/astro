import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/api";
import {
  changeLanguage,
  getPersistedLanguage,
  isPersian,
  LANGUAGE_PREF_KEY,
  type AppLanguage,
} from "@/lib/i18n";

export type { AppLanguage };
export { getPersistedLanguage, isPersian, LANGUAGE_PREF_KEY };

/** Alias for first-load reads (Persian default when unset). */
export const loadPersistedLanguage = getPersistedLanguage;

/**
 * Applies i18n + persisted storage immediately (same as `changeLanguage` from i18n).
 */
export const applyLanguage = changeLanguage;

/**
 * Current app language and setter for components (instant UI + local persist).
 */
export const useLanguage = () => {
  const { i18n } = useTranslation();
  const language = (isPersian(i18n.language) ? "fa" : "en") as AppLanguage;

  const setLanguage = async (lang: AppLanguage) => {
    await applyLanguage(lang);
  };

  return { language, setLanguage };
};

/**
 * Syncs language to PostgreSQL (clears server language-sensitive caches) and client transit cache.
 * Non-fatal if the network fails — local preference remains source of truth until next success.
 */
export async function syncLanguageToBackend(
  lang: AppLanguage,
  getToken: () => Promise<string | null>,
): Promise<boolean> {
  try {
    const langRes = await apiRequest("/api/user/language", {
      method: "PUT",
      getToken,
      body: JSON.stringify({ language: lang }),
    });
    if (!langRes.ok) return false;
    await apiRequest("/api/transits/cache", { method: "DELETE", getToken }).catch(() => null);
    return true;
  } catch {
    return false;
  }
}
