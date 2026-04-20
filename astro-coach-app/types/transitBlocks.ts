export type LunationHint = {
  kind: "new_moon" | "full_moon";
  approximateAt: string; // ISO string
};

export type RetrogradeBody = {
  body: string;
  isRetrograde: boolean;
  speedDegPerDay: number;
};

export type IngressEvent = {
  body: string;
  intoSign: string;
  approximateAt: string; // ISO string
};

export type CollectiveTransit = {
  bodyA: string;
  bodyB: string;
  aspectKind:
    | "conjunction"
    | "opposition"
    | "square"
    | "trine"
    | "sextile";
  orbDegrees: number;
  exactAt: string;
  startAt: string;
  endAt: string;
  isActiveNow: boolean;
  isApproaching: boolean;
  titleEn: string;
  titleFa: string;
};

/** Block 1 — the single most time-relevant sky event */
export type SkyEventBlock =
  | { kind: "lunation"; data: LunationHint; cycleProgressFraction: number }
  | { kind: "retrograde"; data: RetrogradeBody }
  | null;
