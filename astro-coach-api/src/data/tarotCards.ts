const majors = [
  "The Fool",
  "The Magician",
  "The High Priestess",
  "The Empress",
  "The Emperor",
  "The Hierophant",
  "The Lovers",
  "The Chariot",
  "Strength",
  "The Hermit",
  "Wheel of Fortune",
  "Justice",
  "The Hanged Man",
  "Death",
  "Temperance",
  "The Devil",
  "The Tower",
  "The Star",
  "The Moon",
  "The Sun",
  "Judgement",
  "The World",
];

const suits = ["Wands", "Cups", "Swords", "Pentacles"] as const;
const ranks = [
  "Ace",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Page",
  "Knight",
  "Queen",
  "King",
] as const;

export type TarotCardData = {
  name: string;
  arcana: "major" | "minor";
  upright_meaning: string;
  reversed_meaning: string;
  astrological_association: string;
  keywords: string[];
  reversed?: boolean;
};

function minorCard(suit: (typeof suits)[number], rank: (typeof ranks)[number]): TarotCardData {
  return {
    name: `${rank} of ${suit}`,
    arcana: "minor",
    upright_meaning: `The ${rank} of ${suit} upright invites practical focus on ${suit.toLowerCase()} energy.`,
    reversed_meaning: `Reversed, the ${rank} of ${suit} asks for a gentler pace with ${suit.toLowerCase()} themes.`,
    astrological_association: `${suit} / ${rank}`,
    keywords: [suit, rank, "growth"],
  };
}

const minors: TarotCardData[] = [];
for (const suit of suits) {
  for (const rank of ranks) {
    minors.push(minorCard(suit, rank));
  }
}

const majorCards: TarotCardData[] = majors.map((name) => ({
  name,
  arcana: "major" as const,
  upright_meaning: `${name} upright marks a threshold of meaning and courage.`,
  reversed_meaning: `${name} reversed suggests integration work around its lesson.`,
  astrological_association: "Major Arcana",
  keywords: ["archetype", "threshold"],
}));

/**
 * Full 78-card deck embedded for server-side draws (randomness stays on the API).
 */
export const TAROT_DECK: TarotCardData[] = [...majorCards, ...minors];
