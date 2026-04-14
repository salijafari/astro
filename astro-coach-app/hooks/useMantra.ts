import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { useMantraStore } from "@/stores/mantraStore";
import { trackEvent } from "@/lib/mixpanel";
import { useFeatureAccess } from "@/lib/useFeatureAccess";
import { getMantraToday, refreshMantra, pinMantra, unpinMantra } from "@/lib/api";
import type { MantraTheme } from "@/types/mantra";

export function useMantra() {
  const { getToken } = useAuth();
  const { i18n } = useTranslation();
  const { requireAccess } = useFeatureAccess();
  const store = useMantraStore();
  const lang = i18n.language.startsWith("fa") ? "fa" : "en";

  const fetchMantra = useCallback(async (theme?: string) => {
    const st = useMantraStore.getState();
    st.setLoading(true);
    st.setError(null);
    try {
      const data = await getMantraToday(getToken, theme);
      st.setMantra(data);
      trackEvent("mantra_viewed");
    } catch {
      st.setError("mantra.errorLoading");
    } finally {
      st.setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void fetchMantra(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  const handleRefresh = useCallback(async () => {
    const st = useMantraStore.getState();
    st.setRefreshing(true);
    try {
      const data = await refreshMantra(getToken, st.selectedTheme ?? undefined);
      st.setMantra(data);
      trackEvent("mantra_refreshed");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("upgrade") || msg.includes("limit") || msg.includes("Daily refresh")) {
        requireAccess(() => {}, "Mantra Refresh");
      } else {
        st.setError("mantra.errorRefresh");
      }
    } finally {
      st.setRefreshing(false);
    }
  }, [getToken, requireAccess]);

  const handleThemeSelect = useCallback(
    async (theme: MantraTheme) => {
      useMantraStore.getState().setSelectedTheme(theme);
      trackEvent("mantra_theme_selected", { theme });
      await fetchMantra(theme);
    },
    [fetchMantra],
  );

  const handleThemeClear = useCallback(async () => {
    useMantraStore.getState().setSelectedTheme(null);
    trackEvent("mantra_theme_cleared");
    await fetchMantra(undefined);
  }, [fetchMantra]);

  const handleToneToggle = useCallback(() => {
    const st = useMantraStore.getState();
    const next = !st.isToneExploratory;
    st.setToneExploratory(next);
    trackEvent("mantra_tone_toggled", {
      tone: next ? "exploratory" : "declarative",
    });
  }, []);

  const handlePin = useCallback(() => {
    requireAccess(() => {
      void (async () => {
        try {
          await pinMantra(getToken);
          const m = useMantraStore.getState().mantra;
          if (m) useMantraStore.getState().setMantra({ ...m, isPinned: true });
          trackEvent("mantra_pinned");
        } catch {
          /* non-fatal */
        }
      })();
    }, "Mantra Pin");
  }, [getToken, requireAccess]);

  const handleUnpin = useCallback(async () => {
    await unpinMantra(getToken);
    const m = useMantraStore.getState().mantra;
    if (m) useMantraStore.getState().setMantra({ ...m, isPinned: false });
  }, [getToken]);

  const currentMantraText = store.mantra
    ? store.isToneExploratory
      ? lang === "fa"
        ? store.mantra.mantraFaExploratory
        : store.mantra.mantraEnExploratory
      : lang === "fa"
        ? store.mantra.mantraFa
        : store.mantra.mantraEn
    : null;

  const currentTieBack = store.mantra
    ? lang === "fa"
      ? store.mantra.tieBackFa
      : store.mantra.tieBackEn
    : null;

  const currentPlanetLabel = store.mantra
    ? lang === "fa"
      ? store.mantra.planetLabelFa
      : store.mantra.planetLabelEn
    : null;

  const currentQualityLabel = store.mantra
    ? lang === "fa"
      ? store.mantra.qualityLabelFa
      : store.mantra.qualityLabelEn
    : null;

  return {
    ...store,
    fetchMantra,
    handleRefresh,
    handleThemeSelect,
    handleThemeClear,
    handleToneToggle,
    handlePin,
    handleUnpin,
    currentMantraText,
    currentTieBack,
    currentPlanetLabel,
    currentQualityLabel,
    lang,
  };
}
