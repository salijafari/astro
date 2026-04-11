export const TAROT_IMAGE_BASE_URL =
  "https://storage.googleapis.com/akhtar-assets/tarotcardimages/v1";

export const TAROT_SPREAD_TYPES = {
  SINGLE: "single",
  THREE_CARD: "three",
  CELTIC_CROSS: "celtic",
} as const;

export type TarotSpreadType =
  (typeof TAROT_SPREAD_TYPES)[keyof typeof TAROT_SPREAD_TYPES];

export const TAROT_SPREAD_CARD_COUNT: Record<string, number> = {
  single: 1,
  three: 3,
  celtic: 10,
};

export const TAROT_SPREAD_POSITIONS: Record<string, string[]> = {
  single: ["Present"],
  three: ["Past", "Present", "Future"],
  celtic: [
    "Present",
    "Challenge",
    "Past",
    "Future",
    "Above",
    "Below",
    "Advice",
    "External",
    "Hopes & Fears",
    "Outcome",
  ],
};
