export type CollectiveAspectKind =
  | "conjunction"
  | "opposition"
  | "square"
  | "trine"
  | "sextile";

export type CollectiveTransit = {
  bodyA: string;
  bodyB: string;
  aspectKind: CollectiveAspectKind;
  orbDegrees: number;
  exactAt: string;
  startAt: string;
  endAt: string;
  isActiveNow: boolean;
  isApproaching: boolean;
  titleEn: string;
  titleFa: string;
};
