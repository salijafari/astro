export type TarotCardData = {
  id: string;
  name: { en: string; fa: string };
  arcana: "major" | "minor";
  suit?: string;
  keywords: { upright: string[]; reversed: string[] };
  symbolism: string;
  imageUrl: string;
};

export type DrawnCardResult = {
  cardId: string;
  position: string;
  positionMeaning: string;
  positionRole: string;
  isReversed: boolean;
};

export type TarotSpreadData = {
  id: string;
  name: { en: string; fa: string };
  cardCount: number;
  description: { en: string; fa: string };
  requiresQuestion: boolean;
  positions?: Array<{
    label: { en: string; fa: string };
    meaning: string;
    role: string;
  }>;
};

export type TarotReadingResult = {
  id: string;
  spreadId: string;
  question?: string;
  drawnCards: DrawnCardResult[];
  interpretation?: string;
  language: string;
  createdAt: string;
};
