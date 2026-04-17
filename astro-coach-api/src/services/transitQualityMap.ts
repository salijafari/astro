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

type NatalTargetClass = "sun" | "moon" | "asc" | "mc" | "other";

/** Minimal shape for quality mapping — matches TransitEvent field names from engine.ts (no import from engine). */
export interface TransitEventInput {
  transitingBody: string;
  aspectType: string;
  natalTargetBody?: string;
}

function classifyNatalTarget(bodyName: string): NatalTargetClass {
  const b = bodyName.toLowerCase();
  if (b === "sun") return "sun";
  if (b === "moon") return "moon";
  if (b === "ascendant" || b === "asc") return "asc";
  if (b === "midheaven" || b === "mc") return "mc";
  return "other";
}

/** 3D map: transiting planet × aspect class × natal target class → primary tag. Partial; "other" + fallbacks support gaps. */
const TRANSIT_QUALITY_MAP_V2: Record<
  string,
  Record<AspectType, Record<NatalTargetClass, { primary: QualityTag }>>
> = {
  saturn: {
    hard: {
      sun: { primary: "rebuilding" },
      moon: { primary: "softness" },
      asc: { primary: "rebuilding" },
      mc: { primary: "discipline" },
      other: { primary: "patience" },
    },
    soft: {
      sun: { primary: "discipline" },
      moon: { primary: "patience" },
      asc: { primary: "groundedness" },
      mc: { primary: "discipline" },
      other: { primary: "discipline" },
    },
  },
  jupiter: {
    hard: {
      sun: { primary: "expansion" },
      moon: { primary: "softness" },
      asc: { primary: "courage" },
      mc: { primary: "worth" },
      other: { primary: "expansion" },
    },
    soft: {
      sun: { primary: "worth" },
      moon: { primary: "connection" },
      asc: { primary: "expansion" },
      mc: { primary: "clarity" },
      other: { primary: "expansion" },
    },
  },
  pluto: {
    hard: {
      sun: { primary: "rebuilding" },
      moon: { primary: "letting-go" },
      asc: { primary: "rebuilding" },
      mc: { primary: "courage" },
      other: { primary: "rebuilding" },
    },
    soft: {
      sun: { primary: "expansion" },
      moon: { primary: "connection" },
      asc: { primary: "courage" },
      mc: { primary: "clarity" },
      other: { primary: "expansion" },
    },
  },
  uranus: {
    hard: {
      sun: { primary: "courage" },
      moon: { primary: "letting-go" },
      asc: { primary: "courage" },
      mc: { primary: "rebuilding" },
      other: { primary: "courage" },
    },
    soft: {
      sun: { primary: "clarity" },
      moon: { primary: "expansion" },
      asc: { primary: "clarity" },
      mc: { primary: "expansion" },
      other: { primary: "clarity" },
    },
  },
  neptune: {
    hard: {
      sun: { primary: "letting-go" },
      moon: { primary: "softness" },
      asc: { primary: "softness" },
      mc: { primary: "letting-go" },
      other: { primary: "letting-go" },
    },
    soft: {
      sun: { primary: "clarity" },
      moon: { primary: "connection" },
      asc: { primary: "softness" },
      mc: { primary: "clarity" },
      other: { primary: "clarity" },
    },
  },
  chiron: {
    hard: {
      sun: { primary: "worth" },
      moon: { primary: "softness" },
      asc: { primary: "worth" },
      mc: { primary: "rebuilding" },
      other: { primary: "worth" },
    },
    soft: {
      sun: { primary: "worth" },
      moon: { primary: "connection" },
      asc: { primary: "softness" },
      mc: { primary: "clarity" },
      other: { primary: "worth" },
    },
  },
  mars: {
    hard: {
      sun: { primary: "courage" },
      moon: { primary: "boundaries" },
      asc: { primary: "courage" },
      mc: { primary: "discipline" },
      other: { primary: "courage" },
    },
    soft: {
      sun: { primary: "courage" },
      moon: { primary: "groundedness" },
      asc: { primary: "clarity" },
      mc: { primary: "discipline" },
      other: { primary: "courage" },
    },
  },
  venus: {
    hard: {
      sun: { primary: "worth" },
      moon: { primary: "boundaries" },
      asc: { primary: "connection" },
      mc: { primary: "worth" },
      other: { primary: "worth" },
    },
    soft: {
      sun: { primary: "connection" },
      moon: { primary: "softness" },
      asc: { primary: "connection" },
      mc: { primary: "worth" },
      other: { primary: "connection" },
    },
  },
  mercury: {
    hard: {
      sun: { primary: "clarity" },
      moon: { primary: "boundaries" },
      asc: { primary: "clarity" },
      mc: { primary: "discipline" },
      other: { primary: "clarity" },
    },
    soft: {
      sun: { primary: "clarity" },
      moon: { primary: "connection" },
      asc: { primary: "clarity" },
      mc: { primary: "clarity" },
      other: { primary: "clarity" },
    },
  },
};

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

/**
 * Maps a transit event to a quality tag. Phase 0: pass only `event` (2D map, same as legacy).
 * When `natalTargetOverride` is passed (Phase B+), applies TRANSIT_QUALITY_MAP_V2 before falling back to 2D.
 */
export function qualityFromTransit(event: TransitEventInput, natalTargetOverride?: string): QualityTag {
  const planetKey = event.transitingBody?.toLowerCase();
  const aspectKind = classifyAspect(event.aspectType);

  if (natalTargetOverride !== undefined && TRANSIT_QUALITY_MAP_V2[planetKey]?.[aspectKind]) {
    const row = TRANSIT_QUALITY_MAP_V2[planetKey]![aspectKind];
    const targetClass = classifyNatalTarget(natalTargetOverride);
    const v2result = row[targetClass];
    if (v2result) return v2result.primary;
  }

  return TRANSIT_QUALITY_MAP[planetKey]?.[aspectKind]?.primary ?? "patience";
}

export const OUTER_PLANETS = new Set(["saturn", "uranus", "neptune", "pluto", "chiron"]);
export const PERSONAL_POINTS = new Set(["sun", "moon", "asc", "mc", "venus", "mars", "mercury"]);
