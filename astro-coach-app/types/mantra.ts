import { z } from "zod";

export const mantraDataSchema = z.object({
  templateId: z.string(),
  mantraEnDirect: z.string(),
  mantraEnExploratory: z.string(),
  mantraFaDirect: z.string(),
  mantraFaExploratory: z.string(),
  tieBackEn: z.string(),
  tieBackFa: z.string(),
  qualityTag: z.string(),
  qualityLabelEn: z.string(),
  qualityLabelFa: z.string(),
  transitHint: z.object({
    planetLabelEn: z.string().nullable(),
    planetLabelFa: z.string().nullable(),
    planetSymbol: z.string().nullable(),
  }),
  isPinned: z.boolean(),
  pinExpiresAt: z.string().nullable(),
  isPremium: z.boolean(),
  validForDate: z.string(),
});

export type MantraData = z.infer<typeof mantraDataSchema>;

export type MantraRegister = "direct" | "exploratory";

/** Practice picker + `practice.tsx` timing (matches API `practiceMode` enum). */
export type MantraPracticeMode =
  | { id: "tap3"; kind: "count"; count: 3; labelEn: string; labelFa: string }
  | { id: "tap10"; kind: "count"; count: 10; labelEn: string; labelFa: string }
  | { id: "tap21"; kind: "count"; count: 21; labelEn: string; labelFa: string }
  | { id: "tap108"; kind: "count"; count: 108; labelEn: string; labelFa: string }
  | { id: "breath10"; kind: "breath"; breaths: 10; labelEn: string; labelFa: string }
  | { id: "timer"; kind: "timer"; durationSeconds: number; labelEn: string; labelFa: string }
  | { id: "silent"; kind: "silent"; labelEn: string; labelFa: string };

export const PRACTICE_MODES: MantraPracticeMode[] = [
  { id: "tap3", kind: "count", count: 3, labelEn: "3×", labelFa: "۳×" },
  { id: "tap10", kind: "count", count: 10, labelEn: "10×", labelFa: "۱۰×" },
  { id: "tap21", kind: "count", count: 21, labelEn: "21×", labelFa: "۲۱×" },
  { id: "tap108", kind: "count", count: 108, labelEn: "108×", labelFa: "۱۰۸×" },
  { id: "breath10", kind: "breath", breaths: 10, labelEn: "10 breaths", labelFa: "۱۰ نفس" },
  {
    id: "timer",
    kind: "timer",
    durationSeconds: 300,
    labelEn: "Timer (5 min)",
    labelFa: "زمان‌سنج (۵ دقیقه)",
  },
  { id: "silent", kind: "silent", labelEn: "Silent", labelFa: "ساکت" },
];

export type PracticeModeId = MantraPracticeMode["id"];

export interface PracticeSession {
  templateId: string;
  mantraText: string;
  language: "en" | "fa";
  register: MantraRegister;
  mode: PracticeModeId;
}
