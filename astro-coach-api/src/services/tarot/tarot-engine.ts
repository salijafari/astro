import { TAROT_DECK, type TarotCard } from "../../data/tarot-deck.js";
import { getSpreadDepth } from "./spreads.js";

export type DrawnCard = {
  cardId: string;
  positionIndex: number;
  positionLabel: string;
  positionMeaning: string;
  positionRole: string;
  isReversed: boolean;
};

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * Draw all 10 cards upfront using Celtic Cross position map.
 * Deepening reveals more of these same cards — never reshuffles.
 */
export function drawFullSpread(): DrawnCard[] {
  const celticCross = getSpreadDepth("celtic-cross")!;
  const shuffled = shuffle([...TAROT_DECK] as TarotCard[]);
  return shuffled.slice(0, 10).map((card, index) => {
    const position = celticCross.positions[index]!;
    return {
      cardId: card.deckId,
      positionIndex: index,
      positionLabel: position.label.en,
      positionMeaning: position.meaning,
      positionRole: position.role,
      isReversed: Math.random() < 0.4,
    };
  });
}

/**
 * Returns cards visible at a given depth.
 * SINGLE returns only the card at positionIndex 1 (Present).
 */
export function getCardsForDepth(allCards: DrawnCard[], depthId: string): DrawnCard[] {
  const depth = getSpreadDepth(depthId);
  if (!depth) throw new Error(`Unknown depth: ${depthId}`);
  const indices = depth.positions.map((p) => p.index);
  return allCards.filter((c) => indices.includes(c.positionIndex));
}

/**
 * Returns ONLY the new cards being revealed when expanding depth.
 */
export function getNewCardsForExpansion(
  allCards: DrawnCard[],
  fromDepthId: string,
  toDepthId: string,
): DrawnCard[] {
  const fromIndices = new Set(getSpreadDepth(fromDepthId)?.positions.map((p) => p.index) ?? []);
  const toCards = getCardsForDepth(allCards, toDepthId);
  return toCards.filter((c) => !fromIndices.has(c.positionIndex));
}
