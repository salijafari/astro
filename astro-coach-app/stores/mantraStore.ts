import { create } from "zustand";
import type { MantraData, MantraTheme } from "@/types/mantra";

interface MantraState {
  mantra: MantraData | null;
  nextMantra: MantraData | null;
  mantraHistory: MantraData[];
  historyIndex: number;
  isLoading: boolean;
  isRefreshing: boolean;
  selectedTheme: MantraTheme | null;
  error: string | null;
  setMantra: (mantra: MantraData) => void;
  setNextMantra: (nextMantra: MantraData | null) => void;
  pushHistory: (m: MantraData) => void;
  setMantraHistory: (mantraHistory: MantraData[]) => void;
  setHistoryIndex: (historyIndex: number) => void;
  setLoading: (v: boolean) => void;
  setRefreshing: (v: boolean) => void;
  setSelectedTheme: (selectedTheme: MantraTheme | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useMantraStore = create<MantraState>((set) => ({
  mantra: null,
  nextMantra: null,
  mantraHistory: [],
  historyIndex: -1,
  isLoading: false,
  isRefreshing: false,
  selectedTheme: null,
  error: null,
  setMantra: (mantra) => set({ mantra }),
  setNextMantra: (nextMantra) => set({ nextMantra }),
  pushHistory: (m) =>
    set((s) => ({
      mantraHistory: [m, ...s.mantraHistory].slice(0, 20),
    })),
  setMantraHistory: (mantraHistory) => set({ mantraHistory }),
  setHistoryIndex: (historyIndex) => set({ historyIndex }),
  setLoading: (isLoading) => set({ isLoading }),
  setRefreshing: (isRefreshing) => set({ isRefreshing }),
  setSelectedTheme: (selectedTheme) => set({ selectedTheme }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      mantra: null,
      nextMantra: null,
      mantraHistory: [],
      historyIndex: -1,
      isLoading: false,
      isRefreshing: false,
      selectedTheme: null,
      error: null,
    }),
}));
