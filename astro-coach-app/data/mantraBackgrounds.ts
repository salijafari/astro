/**
 * Mantra background photos.
 * Add new entries here when photos are placed in
 * assets/backgrounds/mantra/.
 * ID must match the filename without extension.
 */
export interface MantraBackground {
  id: string;
  labelEn: string;
  labelFa: string;
  source: ReturnType<typeof require>;
  /** Category for grouping in the picker */
  category: "nature" | "sky" | "minimal" | "cosmic";
}

export const MANTRA_BACKGROUNDS: MantraBackground[] = [
  // ─── DEFAULT (no photo — uses CosmicBackground) ───
  // This is handled separately in the UI as "Default"

  // ─── NATURE ───
  // Add entries like this when you place photos:
  // {
  //   id: "mountain-01",
  //   labelEn: "Mountain",
  //   labelFa: "کوه",
  //   source: require("@/assets/backgrounds/mantra/mountain-01.jpg"),
  //   category: "nature",
  // },

  // ─── PLACEHOLDER so the picker renders ───
  // Remove these and replace with real photos
];

export const BACKGROUND_STORAGE_KEY = "akhtar.mantraBackground";
