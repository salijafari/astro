export type DrawnCardResult = {
  cardId: string;
  positionIndex: number;
  positionLabel: string;
  positionMeaning: string;
  positionRole: string;
  isReversed: boolean;
};

export type TarotReadingResult = {
  id: string;
  question?: string;
  currentDepth: "single" | "three" | "five" | "celtic-cross";
  revealedCards: DrawnCardResult[];
  newCards?: DrawnCardResult[];
  allRevealedCards?: DrawnCardResult[];
  interpretations: Record<string, string>;
  language: string;
  createdAt: string;
};

export type DeepenResult = {
  reading: {
    id: string;
    currentDepth: string;
    newCards: DrawnCardResult[];
    allRevealedCards: DrawnCardResult[];
  };
};

export type TarotHistoryItem = {
  id: string;
  question?: string;
  currentDepth: string;
  allCards: DrawnCardResult[];
  interpretations: Record<string, string>;
  language: string;
  createdAt: string;
};
