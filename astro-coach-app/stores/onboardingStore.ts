import { create } from "zustand";

export type OnboardingFields = {
  displayName: string;
  birthDate: string;
  birthTime: string | null;
  birthCity: string;
  birthLat: number;
  birthLong: number;
  birthTimezone: string;
  interestTags: string[];
  sunSign: string;
  moonSign: string;
  risingSign: string | null;
  natalChartJson: Record<string, unknown>;
};

type OnboardingState = OnboardingFields & {
  setPartial: (p: Partial<OnboardingFields>) => void;
  reset: () => void;
};

const initial: OnboardingFields = {
  displayName: "",
  birthDate: "",
  birthTime: "12:00",
  birthCity: "",
  birthLat: 0,
  birthLong: 0,
  birthTimezone: "UTC",
  interestTags: [],
  sunSign: "",
  moonSign: "",
  risingSign: null,
  natalChartJson: {},
};

/**
 * Ephemeral onboarding answers before `complete-onboarding` persists to the API.
 */
export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initial,
  setPartial: (p) => set((s) => ({ ...s, ...p })),
  reset: () => set({ ...initial }),
}));
