import { TAROT_DECK, type TarotCard } from "../../data/tarot-deck.js";
import { getSpreadById } from "./spreads.js";

export type DrawnCard = {
  cardId: string;
  position: string;
  positionMeaning: string;
  positionRole: string;
  isReversed: boolean;
};

export type TarotDraw = {
  spreadId: string;
  cards: DrawnCard[];
  drawnAt: Date;
};

/**
 * Fisher-Yates shuffle — uniform distribution.
 */
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * Draw cards for a given spread.
 * Returns structured data ready for LLM interpretation.
 */
export function drawCards(spreadId: string): TarotDraw {
  const spread = getSpreadById(spreadId);
  if (!spread) throw new Error(`Unknown spread: ${spreadId}`);

  const shuffled = shuffle(TAROT_DECK as TarotCard[]);
  const selected = shuffled.slice(0, spread.cardCount);

  const cards: DrawnCard[] = selected.map((card, index) => {
    const position = spread.positions[index];
    return {
      cardId: card.id,
      position: position?.label.en ?? "Single Card",
      positionMeaning: position?.meaning ?? "Your card for today",
      positionRole: position?.role ?? "advice",
      isReversed: Math.random() < 0.4,
    };
  });

  return {
    spreadId,
    cards,
    drawnAt: new Date(),
  };
}
