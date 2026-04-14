import { z } from "zod";

export const MANTRA_THEMES = [
  "calm",
  "confidence",
  "self-worth",
  "love",
  "healing",
  "focus",
  "growth",
  "release",
  "hope",
  "faith",
] as const;

export type MantraTheme = (typeof MANTRA_THEMES)[number];

export const mantraDataSchema = z.object({
  templateId: z.string(),
  mantraEn: z.string(),
  mantraFa: z.string(),
  mantraEnExploratory: z.string(),
  mantraFaExploratory: z.string(),
  tieBackEn: z.string(),
  tieBackFa: z.string(),
  dominantTransit: z.string(),
  planetLabelEn: z.string(),
  planetLabelFa: z.string(),
  qualityLabelEn: z.string(),
  qualityLabelFa: z.string(),
  validUntil: z.string(),
  canRefresh: z.object({ allowed: z.boolean(), remaining: z.number() }),
  isPinned: z.boolean(),
  selectedTheme: z.string().nullable(),
  isPremium: z.boolean().optional(),
});

export type MantraData = z.infer<typeof mantraDataSchema>;

export type MantraPracticeMode =
  | { id: "breath"; labelEn: string; labelFa: string; kind: "breath"; breaths: number }
  | { id: "count-3"; labelEn: string; labelFa: string; kind: "count"; count: 3 }
  | { id: "count-21"; labelEn: string; labelFa: string; kind: "count"; count: 21 }
  | { id: "count-108"; labelEn: string; labelFa: string; kind: "count"; count: 108 }
  | { id: "timer-5"; labelEn: string; labelFa: string; kind: "timer"; durationSeconds: number }
  | { id: "timer-10"; labelEn: string; labelFa: string; kind: "timer"; durationSeconds: number };

export const PRACTICE_MODES: MantraPracticeMode[] = [
  { id: "breath", labelEn: "10 breaths", labelFa: "۱۰ نفس", kind: "breath", breaths: 10 },
  { id: "count-3", labelEn: "3 repetitions", labelFa: "۳ تکرار", kind: "count", count: 3 },
  { id: "count-21", labelEn: "21 repetitions", labelFa: "۲۱ تکرار", kind: "count", count: 21 },
  { id: "count-108", labelEn: "108 repetitions", labelFa: "۱۰۸ تکرار", kind: "count", count: 108 },
  { id: "timer-5", labelEn: "5 minutes", labelFa: "۵ دقیقه", kind: "timer", durationSeconds: 300 },
  { id: "timer-10", labelEn: "10 minutes", labelFa: "۱۰ دقیقه", kind: "timer", durationSeconds: 600 },
];
