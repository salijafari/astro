/**
 * Legacy tarot card shape (numeric id + English `name` string) for Prisma seed,
 * admin prompts, and content fallbacks. Canonical deck lives in `../data/tarot-deck.ts`.
 */

import {
  TAROT_DECK as CANONICAL_DECK,
  type TarotCard as CanonicalTarotCard,
} from "../data/tarot-deck.js";

/** Matches prior `constants/tarotDeck` exports — `name` is English for DB + prompts. */
export interface TarotCard {
  id: number;
  name: string;
  arcana: "major" | "minor";
  suit?: "wands" | "cups" | "swords" | "pentacles";
  number: number;
  uprightKeywords: string[];
  reversedKeywords: string[];
  uprightMeaning: string;
  reversedMeaning: string;
  emotionalTone: string;
  decisionTone: string;
  relationshipTone: string;
  element?: string;
  associatedPlanets: string[];
  associatedSigns: string[];
  visualSymbolismSummary: string;
  coreLesson: string;
}

function toLegacy(card: CanonicalTarotCard): TarotCard {
  return {
    id: card.id,
    name: card.name.en,
    arcana: card.arcana,
    suit: card.suit,
    number: card.number,
    uprightKeywords: card.uprightKeywords,
    reversedKeywords: card.reversedKeywords,
    uprightMeaning: card.uprightMeaning,
    reversedMeaning: card.reversedMeaning,
    emotionalTone: card.emotionalTone,
    decisionTone: card.decisionTone,
    relationshipTone: card.relationshipTone,
    element: card.element,
    associatedPlanets: card.associatedPlanets,
    associatedSigns: card.associatedSigns,
    visualSymbolismSummary: card.visualSymbolismSummary,
    coreLesson: card.coreLesson,
  };
}

export const TAROT_DECK: TarotCard[] = CANONICAL_DECK.map(toLegacy);
