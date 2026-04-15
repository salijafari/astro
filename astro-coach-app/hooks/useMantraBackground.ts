import { useCallback, useEffect, useState } from "react";
import { readPersistedValue, writePersistedValue } from "@/lib/storage";
import { MANTRA_BACKGROUNDS, BACKGROUND_STORAGE_KEY } from "@/data/mantraBackgrounds";

export function useMantraBackground() {
  /** Optimistic default so first paint matches first-visit default (mountain photo). */
  const [selectedId, setSelectedId] = useState<string | null>("mountain-sky-03");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load persisted selection on mount
  useEffect(() => {
    void (async () => {
      try {
        const saved = await readPersistedValue(BACKGROUND_STORAGE_KEY);
        if (saved && saved.length > 0) {
          setSelectedId(saved);
        } else {
          // Default to Mountain Sky on first visit
          setSelectedId("mountain-sky-03");
        }
      } catch {
        // ignore
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const selectBackground = useCallback(async (id: string | null) => {
    setSelectedId(id);
    try {
      if (id) {
        await writePersistedValue(BACKGROUND_STORAGE_KEY, id);
      } else {
        await writePersistedValue(BACKGROUND_STORAGE_KEY, "");
      }
    } catch {
      // ignore
    }
  }, []);

  // Resolve the actual image source from the ID
  const selectedBg = selectedId ? MANTRA_BACKGROUNDS.find((b) => b.id === selectedId) : null;

  // cosmic-default entry has empty uri — treat as null (uses CosmicBackground)
  const backgroundSource =
    selectedBg && selectedBg.uri.length > 0 ? { uri: selectedBg.uri } : null;

  return {
    selectedId,
    selectedBg,
    backgroundSource,
    selectBackground,
    isLoaded,
  };
}
