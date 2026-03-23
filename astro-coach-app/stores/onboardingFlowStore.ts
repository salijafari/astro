import { create } from "zustand";

export type OnboardingFlowData = {
  firstName: string;
  birthDate: string | null;
  birthTime: string | null;
  birthCity: string | null;
  birthLatitude: number | null;
  birthLongitude: number | null;
  birthTimezone: string | null;
  languagePreference: "fa" | "en";
};

type OnboardingFlowState = OnboardingFlowData & {
  setPartial: (next: Partial<OnboardingFlowData>) => void;
  reset: () => void;
};

const initialState: OnboardingFlowData = {
  firstName: "",
  birthDate: null,
  birthTime: null,
  birthCity: null,
  birthLatitude: null,
  birthLongitude: null,
  birthTimezone: null,
  languagePreference: "fa",
};

export const useOnboardingFlowStore = create<OnboardingFlowState>((set) => ({
  ...initialState,
  setPartial: (next) => set((state) => ({ ...state, ...next })),
  reset: () => set({ ...initialState }),
}));
