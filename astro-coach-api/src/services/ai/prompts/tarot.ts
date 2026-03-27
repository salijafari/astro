import { withBaseStyle } from "../baseStyleGuide.js";
import type { PromptContext } from "../../../types/promptContext.js";
import type { TarotCard } from "../../../constants/tarotDeck.js";

export interface TarotReadingOutput {
  cardName: string;
  position: string;                // e.g. "past", "present", "future", or custom spread position
  isReversed: boolean;
  coreMessage: string;             // 2–3 sentences — the main meaning of this card in context
  forYouSpecifically: string;      // 2–3 sentences personalised to user's chart + question
  actionableInsight: string;       // 1–2 sentences — what to do or reflect on
  astrologyConnection: string;     // 1–2 sentences connecting card's astro element to user's chart
  shadowSide: string;              // 1 sentence on what to be mindful of (reversed energy)
}

export interface TarotSpreadCard {
  card: TarotCard;
  position: string;
  isReversed: boolean;
}

/**
 * Builds a tarot reading prompt for a single card or multi-card spread.
 */
export function buildTarotPrompt(
  ctx: PromptContext,
  cards: TarotSpreadCard[],
  question?: string
): { system: string; user: string } {
  const cardBlocks = cards
    .map(({ card, position, isReversed }) => {
      const meaning = isReversed ? card.reversedMeaning : card.uprightMeaning;
      const astroLine = [card.associatedPlanets.join(", "), card.associatedSigns.join(", ")]
        .filter(Boolean)
        .join(" | ");
      return `CARD (${position.toUpperCase()}): ${card.name}${isReversed ? " [REVERSED]" : ""}
- Arcana: ${card.arcana} | Element: ${card.element ?? "n/a"} | Astrology: ${astroLine || "n/a"}
- Core meaning: ${meaning}
- Emotional tone: ${card.emotionalTone}
- Decision context: ${card.decisionTone}
- Relationship context: ${card.relationshipTone}`;
    })
    .join("\n\n");

  const system = withBaseStyle(`
## FEATURE: TAROT READING

You are delivering a tarot reading for ${ctx.userName}.

${ctx.userName.toUpperCase()}'S CHART:
- Sun: ${ctx.sunSign} | Moon: ${ctx.moonSign} | Rising: ${ctx.risingSign}
- Dominant element: ${ctx.dominantElement}

${cardBlocks}

## OUTPUT FORMAT
Return a JSON ARRAY with one object per card, in the same order as the cards above.
Each object must match this structure exactly — no markdown, no preamble:
[
  {
    "cardName": "",
    "position": "",
    "isReversed": false,
    "coreMessage": "",
    "forYouSpecifically": "",
    "actionableInsight": "",
    "astrologyConnection": "",
    "shadowSide": ""
  }
]

RULES:
- Interpret each card using the meaning data above — do not invent new meanings.
- forYouSpecifically: connect to the user's Sun/Moon/Rising from the profile.
- astrologyConnection: compare the card's astrological element/sign to the user's dominant element.
- shadowSide: even for upright cards, note the shadow or caution gently.
- If only 1 card, return an array with 1 item.
- Do NOT tell the user what will happen. Frame as reflection and possibility.
`.trim());

  const user = question
    ? `My question: ${question}`
    : `Please interpret my tarot draw.`;

  return { system, user };
}
