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
    id: "cosmic-default",
    labelEn: "Cosmic",
    labelFa: "کیهانی",
    uri: "",
    category: "cosmic",
  },
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
  {
    id: "mountain-twilight-05",
    labelEn: "Mountain Twilight",
    labelFa: "غروب کوهستان",
    uri: `${GCS_BASE}/Mountain-Twilight-05.jpg`,
    category: "nature",
  },
  {
    id: "snow-mountain-06",
    labelEn: "Snow Mountain",
    labelFa: "کوه برفی",
    uri: `${GCS_BASE}/Snow-Mountain-06.jpg`,
    category: "nature",
  },
  {
    id: "snow-mountain-07",
    labelEn: "Snow Peak",
    labelFa: "قله برفی",
    uri: `${GCS_BASE}/Snow-Mountain-07.jpg`,
    category: "nature",
  },
  {
    id: "planet-connection-08",
    labelEn: "Planet Connection",
    labelFa: "ارتباط سیاره‌ای",
    uri: `${GCS_BASE}/Planet-Connection-08.jpg`,
    category: "cosmic",
  },
];

export const BACKGROUND_STORAGE_KEY = "akhtar.mantraBackground";
