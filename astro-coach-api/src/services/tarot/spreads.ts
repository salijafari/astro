export type SpreadPosition = {
  index: number;
  label: { en: string; fa: string };
  meaning: string;
  role: string;
};

export type SpreadDepth = {
  id: "single" | "three" | "five" | "celtic-cross";
  name: { en: string; fa: string };
  cardCount: number;
  positions: SpreadPosition[];
  isPremium: boolean;
  nextDepth?: "single" | "three" | "five" | "celtic-cross";
  interpretationStyle: "brief" | "standard" | "deep" | "comprehensive";
};

export const SPREAD_DEPTHS: SpreadDepth[] = [
  {
    id: "single",
    cardCount: 1,
    positions: [
      {
        index: 1,
        label: { en: "Your Card", fa: "کارت شما" },
        meaning: "The energy around your question right now",
        role: "present",
      },
    ],
    isPremium: false,
    nextDepth: "three",
    interpretationStyle: "brief",
    name: { en: "Quick Card", fa: "کارت سریع" },
  },
  {
    id: "three",
    cardCount: 3,
    positions: [
      { index: 0, label: { en: "Past", fa: "گذشته" }, meaning: "What shaped this situation", role: "past" },
      { index: 1, label: { en: "Present", fa: "حال" }, meaning: "What is active now", role: "present" },
      { index: 2, label: { en: "Future", fa: "آینده" }, meaning: "Where this is heading", role: "future" },
    ],
    isPremium: false,
    nextDepth: "five",
    interpretationStyle: "standard",
    name: { en: "Past · Present · Future", fa: "گذشته · حال · آینده" },
  },
  {
    id: "five",
    cardCount: 5,
    positions: [
      { index: 0, label: { en: "Past", fa: "گذشته" }, meaning: "What shaped this situation", role: "past" },
      { index: 1, label: { en: "Present", fa: "حال" }, meaning: "What is active now", role: "present" },
      { index: 2, label: { en: "Future", fa: "آینده" }, meaning: "Where this is heading", role: "future" },
      { index: 3, label: { en: "Challenge", fa: "چالش" }, meaning: "What is blocking you", role: "challenge" },
      { index: 4, label: { en: "Advice", fa: "راهنمایی" }, meaning: "The guidance to follow", role: "advice" },
    ],
    isPremium: true,
    nextDepth: "celtic-cross",
    interpretationStyle: "deep",
    name: { en: "The Full Picture", fa: "تصویر کامل" },
  },
  {
    id: "celtic-cross",
    cardCount: 10,
    positions: [
      { index: 0, label: { en: "Past", fa: "گذشته" }, meaning: "What shaped this situation", role: "past" },
      { index: 1, label: { en: "Present", fa: "حال" }, meaning: "What is active now", role: "present" },
      { index: 2, label: { en: "Future", fa: "آینده" }, meaning: "Where this is heading", role: "future" },
      { index: 3, label: { en: "Challenge", fa: "چالش" }, meaning: "What is blocking you", role: "challenge" },
      { index: 4, label: { en: "Advice", fa: "راهنمایی" }, meaning: "The guidance to follow", role: "advice" },
      { index: 5, label: { en: "Foundation", fa: "بنیاد" }, meaning: "The unconscious root", role: "foundation" },
      { index: 6, label: { en: "Recent Past", fa: "گذشته نزدیک" }, meaning: "What just happened", role: "recent_past" },
      { index: 7, label: { en: "Near Future", fa: "آینده نزدیک" }, meaning: "What is about to unfold", role: "near_future" },
      { index: 8, label: { en: "Your Inner World", fa: "دنیای درون" }, meaning: "How you truly feel", role: "inner_self" },
      { index: 9, label: { en: "Final Outcome", fa: "نتیجه نهایی" }, meaning: "Where all of this leads", role: "outcome" },
    ],
    isPremium: true,
    nextDepth: undefined,
    interpretationStyle: "comprehensive",
    name: { en: "Celtic Cross", fa: "صلیب سلتیک" },
  },
];

/** Public catalog for `GET /api/tarot/spreads` (same data as progressive depths). */
export const SPREADS = SPREAD_DEPTHS;

export const getSpreadDepth = (id: string): SpreadDepth | undefined =>
  SPREAD_DEPTHS.find((s) => s.id === id);

export const getNextDepth = (currentId: string): SpreadDepth | undefined => {
  const current = getSpreadDepth(currentId);
  return current?.nextDepth ? getSpreadDepth(current.nextDepth) : undefined;
};
