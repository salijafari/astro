/**
 * Mantra background photos (remote URLs).
 * IDs are stable for persisted user selection.
 */
export interface MantraBackground {
  id: string;
  labelEn: string;
  labelFa: string;
  uri: string;
  /** Category for grouping in the picker */
  category: "nature" | "sky" | "minimal" | "cosmic";
}

const GCS_BASE = "https://storage.googleapis.com/akhtar-assets/mantra-backgrounds";

export const MANTRA_BACKGROUNDS: MantraBackground[] = [
  {
    id: "milky-way-04",
    labelEn: "Milky Way",
    labelFa: "کهکشان راه شیری",
    uri: `${GCS_BASE}/Milky-Way-04.jpg`,
    category: "cosmic",
  },
  {
    id: "mountain-sky-03",
    labelEn: "Mountain Sky",
    labelFa: "آسمان کوهستان",
    uri: `${GCS_BASE}/Mountain-Sky-03.jpg`,
    category: "nature",
  },
  {
    id: "mountain-tree-02",
    labelEn: "Mountain & Trees",
    labelFa: "کوه و درختان",
    uri: `${GCS_BASE}/Mountain-Tree-02.jpg`,
    category: "nature",
  },
  {
    id: "mountain-sky-01",
    labelEn: "Mountain at Dusk",
    labelFa: "کوه در غروب",
    uri: `${GCS_BASE}/Mountain-Sky-01.jpg`,
    category: "nature",
  },
];

export const BACKGROUND_STORAGE_KEY = "akhtar.mantraBackground";
