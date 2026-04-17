import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { getMantraToday, pinMantra, unpinMantra } from "@/lib/api";
import { trackEvent } from "@/lib/mixpanel";
import { useFeatureAccess } from "@/lib/useFeatureAccess";
import {
  MANTRA_UX_KEYS,
  migrateLegacyMantraVisitedDate,
  readMantraUx,
  writeMantraUx,
} from "@/lib/mantraUxStorage";
import { useMantraStore } from "@/stores/mantraStore";
import type { MantraRegister } from "@/types/mantra";

function pickMantraLine(
  m: NonNullable<ReturnType<typeof useMantraStore.getState>["mantra"]>,
  lang: "en" | "fa",
  register: MantraRegister,
): string {
  if (lang === "fa") {
    return register === "direct" ? m.mantraFaDirect : m.mantraFaExploratory;
  }
  return register === "direct" ? m.mantraEnDirect : m.mantraEnExploratory;
}

export function useMantra() {
  const { getToken } = useAuth();
  const { i18n } = useTranslation();
  const { requireAccess } = useFeatureAccess();
  const store = useMantraStore();
  const lang: "en" | "fa" = i18n.language.startsWith("fa") ? "fa" : "en";
  /**
   * After legacy migration, first successful `today` read captures whether reveal was already done
   * (for `mantra_daily_open.isFirstEverOpen`).
   */
  const revealDoneBeforeFirstFetchRef = useRef<boolean | null>(null);

  const fetchMantra = useCallback(async () => {
    await migrateLegacyMantraVisitedDate();
    const reg = await readMantraUx(MANTRA_UX_KEYS.registerOverride);
    if (reg === "direct" || reg === "exploratory") {
      useMantraStore.getState().setRegister(reg);
    }
    const st = useMantraStore.getState();
    st.setLoading(true);
    st.setError(null);
    try {
      const data = await getMantraToday(getToken);
      st.setMantra(data);

      const tracked = await readMantraUx(MANTRA_UX_KEYS.dailyOpenTrackedFor);
      if (tracked !== data.validForDate) {
        await writeMantraUx(MANTRA_UX_KEYS.dailyOpenTrackedFor, data.validForDate);
        if (revealDoneBeforeFirstFetchRef.current === null) {
          const rev = await readMantraUx(MANTRA_UX_KEYS.revealEverCompleted);
          revealDoneBeforeFirstFetchRef.current = rev === "true";
        }
        const isFirstEverOpen = revealDoneBeforeFirstFetchRef.current === false;
        trackEvent("mantra_daily_open", {
          qualityTag: data.qualityTag,
          isPinned: data.isPinned,
          isFirstEverOpen,
        });
      }
    } catch {
      st.setError("mantra.errorLoading");
    } finally {
      st.setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void fetchMantra();
  }, [fetchMantra]);

  const setRegisterPreference = useCallback(async (register: MantraRegister) => {
    useMantraStore.getState().setRegister(register);
    await writeMantraUx(MANTRA_UX_KEYS.registerOverride, register);
    trackEvent("mantra_register_changed", { register });
  }, []);

  const handlePin = useCallback(() => {
    requireAccess(() => {
      void (async () => {
        try {
          const res = await pinMantra(getToken);
          const m = useMantraStore.getState().mantra;
          if (m) {
            useMantraStore.getState().setMantra({
              ...m,
              isPinned: true,
              pinExpiresAt: res.expiresAt,
            });
          }
          trackEvent("mantra_pinned");
        } catch {
          /* non-fatal */
        }
      })();
    }, "Mantra Pin");
  }, [getToken, requireAccess]);

  const handleUnpin = useCallback(async () => {
    try {
      await unpinMantra(getToken);
      const m = useMantraStore.getState().mantra;
      if (m) useMantraStore.getState().setMantra({ ...m, isPinned: false, pinExpiresAt: null });
      trackEvent("mantra_unpinned");
    } catch {
      /* non-fatal */
    }
  }, [getToken]);

  const currentMantraText = store.mantra ? pickMantraLine(store.mantra, lang, store.register) : null;

  const currentTieBack = store.mantra ? (lang === "fa" ? store.mantra.tieBackFa : store.mantra.tieBackEn) : null;

  const currentPlanetLabel = store.mantra
    ? lang === "fa"
      ? store.mantra.transitHint.planetLabelFa ?? store.mantra.transitHint.planetLabelEn
      : store.mantra.transitHint.planetLabelEn ?? store.mantra.transitHint.planetLabelFa
    : null;

  const currentQualityLabel = store.mantra
    ? lang === "fa"
      ? store.mantra.qualityLabelFa
      : store.mantra.qualityLabelEn
    : null;

  return {
    ...store,
    fetchMantra,
    setRegisterPreference,
    handlePin,
    handleUnpin,
    currentMantraText,
    currentTieBack,
    currentPlanetLabel,
    currentQualityLabel,
    lang,
  };
}
