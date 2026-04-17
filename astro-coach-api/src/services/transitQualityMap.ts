// Static deterministic mapping: transit pattern → quality tag
// The LLM never makes this mapping. Never.

export type QualityTag =
  | "patience"
  | "boundaries"
  | "rebuilding"
  | "discipline"
  | "clarity"
  | "courage"
  | "letting-go"
  | "softness"
  | "expansion"
  | "groundedness"
  | "worth"
  | "connection";

interface QualityMapping {
  primary: QualityTag;
  adjacent: QualityTag[];
}

type AspectType = "hard" | "soft"; // hard = conjunction/square/opposition; soft = trine/sextile

export const TRANSIT_QUALITY_MAP: Record<string, Record<AspectType, QualityMapping>> = {
  saturn: {
    hard: { primary: "patience", adjacent: ["discipline", "rebuilding"] },
    soft: { primary: "discipline", adjacent: ["groundedness", "patience"] },
  },
  uranus: {
    hard: { primary: "courage", adjacent: ["letting-go", "expansion"] },
    soft: { primary: "expansion", adjacent: ["courage", "clarity"] },
  },
  neptune: {
    hard: { primary: "softness", adjacent: ["letting-go", "clarity"] },
    soft: { primary: "connection", adjacent: ["softness", "expansion"] },
  },
  pluto: {
    hard: { primary: "rebuilding", adjacent: ["letting-go", "courage"] },
    soft: { primary: "worth", adjacent: ["rebuilding", "courage"] },
  },
  chiron: {
    hard: { primary: "softness", adjacent: ["worth", "letting-go"] },
    // NOTE: Chiron soft (trine/sextile) maps to worth, not softness —
    // the soft Chiron experience is about reclaiming worth, not wound-tending
    soft: { primary: "worth", adjacent: ["softness", "connection"] },
  },
  jupiter: {
    hard: { primary: "clarity", adjacent: ["discipline", "groundedness"] },
    soft: { primary: "expansion", adjacent: ["worth", "connection"] },
  },
  mars: {
    hard: { primary: "courage", adjacent: ["groundedness", "boundaries"] },
    soft: { primary: "discipline", adjacent: ["courage", "groundedness"] },
  },
  venus: {
    hard: { primary: "connection", adjacent: ["worth", "softness"] },
    soft: { primary: "connection", adjacent: ["worth", "softness"] },
  },
  mercury: {
    hard: { primary: "clarity", adjacent: ["connection", "courage"] },
    soft: { primary: "clarity", adjacent: ["connection", "courage"] },
  },
  sun: {
    hard: { primary: "worth", adjacent: ["groundedness", "expansion"] },
    soft: { primary: "worth", adjacent: ["groundedness", "expansion"] },
  },
};

export function classifyAspect(aspectName: string): AspectType {
  const hard = ["conjunction", "square", "opposition"];
  return hard.includes(aspectName.toLowerCase()) ? "hard" : "soft";
}

export const OUTER_PLANETS = new Set(["saturn", "uranus", "neptune", "pluto", "chiron"]);
export const PERSONAL_POINTS = new Set(["sun", "moon", "asc", "mc", "venus", "mars", "mercury"]);
