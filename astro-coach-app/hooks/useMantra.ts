import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { useMantraStore } from "@/stores/mantraStore";
import { trackEvent } from "@/lib/mixpanel";
import { useFeatureAccess } from "@/lib/useFeatureAccess";
import { fetchNextMantra, getMantraToday, refreshMantra, pinMantra, unpinMantra } from "@/lib/api";
import type { MantraTheme } from "@/types/mantra";

export function useMantra() {
  const { getToken } = useAuth();
  const { i18n } = useTranslation();
  const { requireAccess } = useFeatureAccess();
  const store = useMantraStore();
  const lang = i18n.language.startsWith("fa") ? "fa" : "en";

  const prefetchNext = useCallback(async () => {
    const st = useMantraStore.getState();
    try {
      const data = await fetchNextMantra(getToken, st.selectedTheme ?? undefined);
      st.setNextMantra(data);
    } catch {
      // non-fatal — swipe will fetch on demand if prefetch failed
    }
  }, [getToken]);

  const fetchMantra = useCallback(
    async (theme?: string) => {
      const st = useMantraStore.getState();
      st.setLoading(true);
      st.setError(null);
      try {
        const data = await getMantraToday(getToken, theme);
        st.setMantra(data);
        st.setHistoryIndex(-1);
        st.setMantraHistory([]);
        st.setNextMantra(null);
        trackEvent("mantra_viewed");
        void prefetchNext();
      } catch {
        st.setError("mantra.errorLoading");
      } finally {
        st.setLoading(false);
      }
    },
    [getToken, prefetchNext],
  );

  useEffect(() => {
    void fetchMantra(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  const goToNext = useCallback(async () => {
    const st0 = useMantraStore.getState();
    const current = st0.mantra;
    if (current) {
      st0.pushHistory(current);
    }
    useMantraStore.getState().setHistoryIndex(-1);
    const st = useMantraStore.getState();
    if (st.nextMantra) {
      const next = st.nextMantra;
      st.setMantra(next);
      st.setNextMantra(null);
      trackEvent("mantra_refreshed");
      void prefetchNext();
    } else {
      st.setRefreshing(true);
      try {
        const data = await fetchNextMantra(getToken, st.selectedTheme ?? undefined);
        st.setMantra(data);
        trackEvent("mantra_refreshed");
        void prefetchNext();
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
    }
  }, [getToken, prefetchNext, requireAccess]);

  const goToPrevious = useCallback(() => {
    const st = useMantraStore.getState();
    if (st.mantraHistory.length === 0) return;
    const prev = st.mantraHistory[0];
    if (!prev) return;
    if (st.mantra) st.setNextMantra(st.mantra);
    const newHistory = st.mantraHistory.slice(1);
    st.setMantraHistory(newHistory);
    st.setMantra(prev);
    trackEvent("mantra_previous_viewed");
  }, []);

  const handleRefresh = useCallback(async () => {
    const st = useMantraStore.getState();
    const current = st.mantra;
    if (current) {
      st.pushHistory(current);
    }
    st.setHistoryIndex(-1);
    st.setRefreshing(true);
    st.setError(null);
    try {
      const data = await refreshMantra(getToken, st.selectedTheme ?? undefined);
      st.setMantra(data);
      st.setNextMantra(null);
      trackEvent("mantra_refreshed");
      void prefetchNext();
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
  }, [getToken, prefetchNext, requireAccess]);

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
    ? lang === "fa"
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

  const hasPrevious = store.mantraHistory.length > 0;

  return {
    ...store,
    fetchMantra,
    handleRefresh,
    goToNext,
    goToPrevious,
    hasPrevious,
    handleThemeSelect,
    handleThemeClear,
    handlePin,
    handleUnpin,
    currentMantraText,
    currentTieBack,
    currentPlanetLabel,
    currentQualityLabel,
    lang,
  };
}
