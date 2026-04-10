export type SpreadPosition = {
  label: { en: string; fa: string };
  meaning: string;
  role: "past" | "present" | "future" | "advice" | "challenge" | "self" | "dynamic";
};

export type TarotSpread = {
  id: string;
  name: { en: string; fa: string };
  cardCount: number;
  positions: SpreadPosition[];
  description: { en: string; fa: string };
  requiresQuestion: boolean;
};

export const SPREADS: TarotSpread[] = [
  {
    id: "daily-card",
    name: { en: "Daily Card", fa: "کارت روزانه" },
    cardCount: 1,
    positions: [],
    description: {
      en: "A single card to set your intention for today",
      fa: "یک کارت برای تعیین نیت امروزت",
    },
    requiresQuestion: false,
  },
  {
    id: "past-present-direction",
    name: { en: "Past · Present · Direction", fa: "گذشته · حال · مسیر" },
    cardCount: 3,
    positions: [
      {
        label: { en: "Past", fa: "گذشته" },
        meaning: "What shaped this situation",
        role: "past",
      },
      {
        label: { en: "Present", fa: "حال" },
        meaning: "What is active now",
        role: "present",
      },
      {
        label: { en: "Direction", fa: "مسیر" },
        meaning: "Where this is heading",
        role: "future",
      },
    ],
    description: {
      en: "Understand where you've been, where you are, and where you're heading",
      fa: "بفهم از کجا آمدی، کجایی، و به کجا می‌روی",
    },
    requiresQuestion: false,
  },
  {
    id: "love-reading",
    name: { en: "Love Reading", fa: "فال عشق" },
    cardCount: 3,
    positions: [
      {
        label: { en: "You", fa: "شما" },
        meaning: "Your energy in the situation",
        role: "self",
      },
      {
        label: { en: "Dynamic", fa: "پویایی" },
        meaning: "The relationship or connection energy",
        role: "dynamic",
      },
      {
        label: { en: "Guidance", fa: "راهنما" },
        meaning: "What to focus on next",
        role: "advice",
      },
    ],
    description: {
      en: "Explore the energy in your relationships",
      fa: "انرژی روابطت را کشف کن",
    },
    requiresQuestion: false,
  },
  {
    id: "decision-reading",
    name: { en: "Decision Reading", fa: "فال تصمیم" },
    cardCount: 3,
    positions: [
      {
        label: { en: "Driver", fa: "انگیزه" },
        meaning: "Why you are here and what pulls you",
        role: "self",
      },
      {
        label: { en: "Challenge", fa: "چالش" },
        meaning: "What is blocking or complicating the choice",
        role: "challenge",
      },
      {
        label: { en: "Guidance", fa: "راهنما" },
        meaning: "A constructive way forward",
        role: "advice",
      },
    ],
    description: {
      en: "Get clarity on what to do next",
      fa: "برای قدم بعدی وضوح پیدا کن",
    },
    requiresQuestion: false,
  },
];

export const getSpreadById = (id: string): TarotSpread | undefined =>
  SPREADS.find((s) => s.id === id);
