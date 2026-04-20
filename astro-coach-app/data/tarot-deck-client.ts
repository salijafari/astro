/**
 * Mirror of `astro-coach-api/src/data/tarot-deck.ts` for client-side labels and placeholders.
 * Keep in sync when editing card copy or ids.
 */

export type TarotCard = {
  id: string;
  name: {
    en: string;
    fa: string;
  };
  arcana: "major" | "minor";
  suit?: "cups" | "wands" | "swords" | "pentacles";
  rank?: number | "page" | "knight" | "queen" | "king";
  keywords: {
    upright: string[];
    reversed: string[];
  };
  symbolism: string;
  imageUrl: string;
};

const img = (id: string) => `/assets/tarot/${id}.png`;

/** GCS full-size WebP art (same basename layout as `astro-coach-api` `tarot-cards.json` `imageUrl`). */
export const GCS_BASE_FULL = "https://storage.googleapis.com/akhtar-assets/tarot/cards/full";
/** GCS thumbnail WebP art (same basenames as full, under `tarot/cards/thumb/`). */
export const GCS_BASE_THUMB = "https://storage.googleapis.com/akhtar-assets/tarot/cards/thumb";

/**
 * Maps deck IDs (`major-00`, `wands-01`, `pentacles-page`, …) or API-style ids (`00`, `w01`)
 * to the canonical form used by GCS filenames: majors `00`–`21`, minors `w01`–`w14`, etc.
 */
function normalizeToApiCardId(cardId: string): string {
  if (/^[wcsp]\d{2}$/.test(cardId)) return cardId;
  if (/^\d{2}$/.test(cardId)) return cardId;

  const mMajor = cardId.match(/^major-(\d+)$/);
  if (mMajor) return mMajor[1]!.padStart(2, "0");

  const mMinor = cardId.match(/^(cups|wands|swords|pentacles)-(.+)$/);
  if (mMinor) {
    const suitKey = mMinor[1]!;
    const rest = mMinor[2]!;
    const suitLetter = suitKey === "pentacles" ? "p" : suitKey[0]!;
    let num: string;
    if (/^\d+$/.test(rest)) {
      num = rest.padStart(2, "0");
    } else {
      const courtNum: Record<string, string> = {
        page: "11",
        knight: "12",
        queen: "13",
        king: "14",
      };
      num = courtNum[rest] ?? rest;
    }
    return `${suitLetter}${num}`;
  }

  return cardId;
}

/**
 * Builds GCS asset URL for a deck/API card id (full or thumb base).
 * Major Arcana: `00`–`21` → maj00.webp … maj21.webp. Minors: w01–w14 → wands01.webp, pents12.webp, …
 */
function cardIdToAssetUrl(cardId: string, baseUrl: string): string {
  const canonical = normalizeToApiCardId(cardId);
  if (/^\d{2}$/.test(canonical)) {
    return `${baseUrl}/maj${canonical}.webp`;
  }
  const suit = canonical[0];
  const num = canonical.slice(1);
  const suitMap: Record<string, string> = {
    w: "wands",
    c: "cups",
    s: "swords",
    p: "pents",
  };
  const suitName = suitMap[suit ?? ""] ?? "wands";
  return `${baseUrl}/${suitName}${num}.webp`;
}

/** Full-size WebP URL on GCS for a deck/API card id. */
export function cardIdToImageUrl(cardId: string): string {
  return cardIdToAssetUrl(cardId, GCS_BASE_FULL);
}

/** Thumbnail WebP URL on GCS for a deck/API card id (same basename as full). */
export function cardIdToThumbUrl(cardId: string): string {
  return cardIdToAssetUrl(cardId, GCS_BASE_THUMB);
}

/** Major Arcana (22). */
const MAJORS: TarotCard[] = [
  {
    id: "major-00",
    name: { en: "The Fool", fa: "ابله" },
    arcana: "major",
    keywords: {
      upright: ["beginnings", "openness", "curiosity", "trust", "leap"],
      reversed: ["avoidance", "recklessness", "stalling", "denial", "fear"],
    },
    symbolism: "Standing at life’s edge with innocence and willingness to step into the unknown.",
    imageUrl: img("major-00"),
  },
  {
    id: "major-01",
    name: { en: "The Magician", fa: "جادوگر" },
    arcana: "major",
    keywords: {
      upright: ["focus", "skill", "agency", "resources", "clarity"],
      reversed: ["scattered", "manipulation", "doubt", "misuse", "blocks"],
    },
    symbolism: "Turning intention into action by aligning will, tools, and attention.",
    imageUrl: img("major-01"),
  },
  {
    id: "major-02",
    name: { en: "The High Priestess", fa: "کاهنه بزرگ" },
    arcana: "major",
    keywords: {
      upright: ["intuition", "patience", "inner knowing", "boundaries", "stillness"],
      reversed: ["secrets", "withdrawal", "distrust", "noise", "suppression"],
    },
    symbolism: "Listening beneath the surface where instinct and pattern become clear.",
    imageUrl: img("major-02"),
  },
  {
    id: "major-03",
    name: { en: "The Empress", fa: "شهبانو" },
    arcana: "major",
    keywords: {
      upright: ["nurture", "creativity", "comfort", "growth", "care"],
      reversed: ["neglect", "dependence", "smothering", "stagnation", "emptiness"],
    },
    symbolism: "Growth through care—creating conditions where life can flourish.",
    imageUrl: img("major-03"),
  },
  {
    id: "major-04",
    name: { en: "The Emperor", fa: "پادشاه" },
    arcana: "major",
    keywords: {
      upright: ["structure", "responsibility", "boundaries", "leadership", "stability"],
      reversed: ["rigidity", "control", "dominance", "chaos", "avoidance"],
    },
    symbolism: "Order and accountability—building a reliable frame for what matters.",
    imageUrl: img("major-04"),
  },
  {
    id: "major-05",
    name: { en: "The Hierophant", fa: "معلم معنوی" },
    arcana: "major",
    keywords: {
      upright: ["tradition", "mentorship", "values", "commitment", "learning"],
      reversed: ["dogma", "rebellion", "mismatch", "pressure", "confusion"],
    },
    symbolism: "Learning the rules and rituals that hold a community’s shared meaning.",
    imageUrl: img("major-05"),
  },
  {
    id: "major-06",
    name: { en: "The Lovers", fa: "عشاق" },
    arcana: "major",
    keywords: {
      upright: ["choice", "alignment", "intimacy", "honesty", "connection"],
      reversed: ["split", "avoidance", "mismatch", "pressure", "ambivalence"],
    },
    symbolism: "A fork in the road where values and desire must be chosen consciously.",
    imageUrl: img("major-06"),
  },
  {
    id: "major-07",
    name: { en: "The Chariot", fa: "ارابه" },
    arcana: "major",
    keywords: {
      upright: ["momentum", "discipline", "direction", "confidence", "progress"],
      reversed: ["collision", "drift", "ego", "stall", "scattered"],
    },
    symbolism: "Moving forward by steering opposing pulls with clear intent.",
    imageUrl: img("major-07"),
  },
  {
    id: "major-08",
    name: { en: "Strength", fa: "قدرت" },
    arcana: "major",
    keywords: {
      upright: ["courage", "compassion", "patience", "self-control", "soft power"],
      reversed: ["fear", "reactivity", "doubt", "force", "burnout"],
    },
    symbolism: "Gentle persistence—holding intensity without turning it against yourself.",
    imageUrl: img("major-08"),
  },
  {
    id: "major-09",
    name: { en: "The Hermit", fa: "زاهد" },
    arcana: "major",
    keywords: {
      upright: ["reflection", "solitude", "wisdom", "clarity", "slowing down"],
      reversed: ["isolation", "avoidance", "loneliness", "noise", "lost"],
    },
    symbolism: "Stepping back to see clearly—guidance found in quiet honesty.",
    imageUrl: img("major-09"),
  },
  {
    id: "major-10",
    name: { en: "Wheel of Fortune", fa: "چرخ شانس" },
    arcana: "major",
    keywords: {
      upright: ["change", "cycles", "timing", "opportunity", "release"],
      reversed: ["stuck", "resistance", "bad timing", "victim story", "chaos"],
    },
    symbolism: "Life’s turning points—what rises, falls, and asks for adaptation.",
    imageUrl: img("major-10"),
  },
  {
    id: "major-11",
    name: { en: "Justice", fa: "عدالت" },
    arcana: "major",
    keywords: {
      upright: ["fairness", "truth", "accountability", "consequences", "clarity"],
      reversed: ["bias", "avoidance", "guilt", "denial", "imbalance"],
    },
    symbolism: "Facing facts and owning outcomes—balance as a practice, not a mood.",
    imageUrl: img("major-11"),
  },
  {
    id: "major-12",
    name: { en: "The Hanged Man", fa: "مرد آویزان" },
    arcana: "major",
    keywords: {
      upright: ["pause", "surrender", "perspective", "release", "acceptance"],
      reversed: ["stalling", "resentment", "sacrifice theater", "escape", "rigidity"],
    },
    symbolism: "Suspension as insight—seeing differently when you stop forcing motion.",
    imageUrl: img("major-12"),
  },
  {
    id: "major-13",
    name: { en: "Death", fa: "مرگ" },
    arcana: "major",
    keywords: {
      upright: ["ending", "transition", "release", "renewal", "honesty"],
      reversed: ["resistance", "stagnation", "fear", "denial", "clinging"],
    },
    symbolism: "A necessary closure that clears space for a new shape of life.",
    imageUrl: img("major-13"),
  },
  {
    id: "major-14",
    name: { en: "Temperance", fa: "اعتدال" },
    arcana: "major",
    keywords: {
      upright: ["balance", "integration", "moderation", "healing", "patience"],
      reversed: ["extremes", "impatience", "overload", "discord", "numbness"],
    },
    symbolism: "Blending opposites into a workable middle—recovery through rhythm.",
    imageUrl: img("major-14"),
  },
  {
    id: "major-15",
    name: { en: "The Devil", fa: "شیطان" },
    arcana: "major",
    keywords: {
      upright: ["attachment", "habit", "shame", "temptation", "patterns"],
      reversed: ["freedom", "breakthrough", "honesty", "release", "awareness"],
    },
    symbolism: "Bondage you consent to—naming cravings and fear that run the show.",
    imageUrl: img("major-15"),
  },
  {
    id: "major-16",
    name: { en: "The Tower", fa: "برج" },
    arcana: "major",
    keywords: {
      upright: ["sudden change", "truth", "collapse", "awakening", "rupture"],
      reversed: ["avoidance", "delayed crash", "fear", "denial", "repair"],
    },
    symbolism: "A shock that dismantles what could not hold—clarity through upheaval.",
    imageUrl: img("major-16"),
  },
  {
    id: "major-17",
    name: { en: "The Star", fa: "ستاره" },
    arcana: "major",
    keywords: {
      upright: ["hope", "calm", "renewal", "faith", "gentleness"],
      reversed: ["discouragement", "doubt", "emptiness", "cynicism", "fatigue"],
    },
    symbolism: "Quiet reassurance after difficulty—hope as a steady small light.",
    imageUrl: img("major-17"),
  },
  {
    id: "major-18",
    name: { en: "The Moon", fa: "ماه" },
    arcana: "major",
    keywords: {
      upright: ["uncertainty", "dreams", "intuition", "anxiety", "projection"],
      reversed: ["clarity", "fear lifting", "confusion", "avoidance", "paranoia"],
    },
    symbolism: "Moving through fog—feelings and projections blur what is real.",
    imageUrl: img("major-18"),
  },
  {
    id: "major-19",
    name: { en: "The Sun", fa: "خورشید" },
    arcana: "major",
    keywords: {
      upright: ["vitality", "clarity", "joy", "warmth", "honesty"],
      reversed: ["dimmed", "overexposure", "naivety", "fatigue", "doubt"],
    },
    symbolism: "Illumination—seeing things plainly and feeling alive in the light.",
    imageUrl: img("major-19"),
  },
  {
    id: "major-20",
    name: { en: "Judgement", fa: "قیامت" },
    arcana: "major",
    keywords: {
      upright: ["reckoning", "renewal", "call", "forgiveness", "integration"],
      reversed: ["guilt", "doubt", "delay", "noise", "avoidance"],
    },
    symbolism: "A wake-up call—hearing what life is asking you to own and begin again.",
    imageUrl: img("major-20"),
  },
  {
    id: "major-21",
    name: { en: "The World", fa: "جهان" },
    arcana: "major",
    keywords: {
      upright: ["completion", "integration", "wholeness", "travel", "closure"],
      reversed: ["incompletion", "loose ends", "restlessness", "stuck", "repeat"],
    },
    symbolism: "A full-circle moment—mastery as integration, not perfection.",
    imageUrl: img("major-21"),
  },
];

type SuitKey = "cups" | "wands" | "swords" | "pentacles";

const SUIT_META: Record<SuitKey, { enSuit: string; faSuit: string; tone: string }> = {
  wands: { enSuit: "Wands", faSuit: "چوبدست‌ها", tone: "drive, creativity, and initiative" },
  cups: { enSuit: "Cups", faSuit: "جام‌ها", tone: "emotion, bonding, and inner life" },
  swords: { enSuit: "Swords", faSuit: "شمشیرها", tone: "thought, truth-telling, and mental stress" },
  pentacles: { enSuit: "Pentacles", faSuit: "سکه‌ها", tone: "work, body, resources, and stability" },
};

type Pip = { idNum: string; rank: number | "page" | "knight" | "queen" | "king"; en: string; fa: string };

const PIPS: Pip[] = [
  { idNum: "01", rank: 1, en: "Ace", fa: "آس" },
  { idNum: "02", rank: 2, en: "Two", fa: "دو" },
  { idNum: "03", rank: 3, en: "Three", fa: "سه" },
  { idNum: "04", rank: 4, en: "Four", fa: "چهار" },
  { idNum: "05", rank: 5, en: "Five", fa: "پنج" },
  { idNum: "06", rank: 6, en: "Six", fa: "شش" },
  { idNum: "07", rank: 7, en: "Seven", fa: "هفت" },
  { idNum: "08", rank: 8, en: "Eight", fa: "هشت" },
  { idNum: "09", rank: 9, en: "Nine", fa: "نه" },
  { idNum: "10", rank: 10, en: "Ten", fa: "ده" },
  { idNum: "page", rank: "page", en: "Page", fa: "پیج" },
  { idNum: "knight", rank: "knight", en: "Knight", fa: "شوالیه" },
  { idNum: "queen", rank: "queen", en: "Queen", fa: "ملکه" },
  { idNum: "king", rank: "king", en: "King", fa: "پادشاه" },
];

function keywordsForMinor(suit: SuitKey): { upright: string[]; reversed: string[] } {
  switch (suit) {
    case "cups":
      return {
        upright: ["attachment", "tenderness", "empathy", "reconciliation", "longing"],
        reversed: ["mood swings", "distance", "resentment", "overload", "avoidance"],
      };
    case "wands":
      return {
        upright: ["momentum", "courage", "desire", "creative spark", "leadership"],
        reversed: ["burnout", "conflict", "delay", "ego", "scattered"],
      };
    case "swords":
      return {
        upright: ["clarity", "truth", "boundaries", "analysis", "decision"],
        reversed: ["rumination", "harsh words", "anxiety", "confusion", "coldness"],
      };
    case "pentacles":
      return {
        upright: ["work", "resources", "skill", "security", "patience"],
        reversed: ["scarcity", "mistrust", "overwork", "rigidity", "delay"],
      };
  }
}

function buildMinors(): TarotCard[] {
  const out: TarotCard[] = [];
  for (const suit of Object.keys(SUIT_META) as SuitKey[]) {
    const meta = SUIT_META[suit];
    const kw = keywordsForMinor(suit);
    for (const pip of PIPS) {
      const id = `${suit}-${pip.idNum}`;
      const nameEn = `${pip.en} of ${meta.enSuit}`;
      const nameFa = `${pip.fa} ${meta.faSuit}`;
      const symbolism = `A focused moment in ${meta.enSuit.toLowerCase()} life—${meta.tone}.`;
      out.push({
        id,
        name: { en: nameEn, fa: nameFa },
        arcana: "minor",
        suit,
        rank: pip.rank,
        keywords: { upright: kw.upright, reversed: kw.reversed },
        symbolism,
        imageUrl: img(id),
      });
    }
  }
  return out;
}

const MINORS = buildMinors();

export const TAROT_DECK: TarotCard[] = [...MAJORS, ...MINORS];

export const MAJOR_ARCANA = TAROT_DECK.filter((c) => c.arcana === "major");
export const MINOR_ARCANA = TAROT_DECK.filter((c) => c.arcana === "minor");

export const getCardById = (id: string): TarotCard | undefined => TAROT_DECK.find((c) => c.id === id);

export type TarotCardDisplay = {
  id: string;
  name: { en: string; fa: string };
  imageUrl: string;
  thumbnailUrl: string;
  keywords: { upright: string[]; reversed: string[] };
};

export const TAROT_DECK_DISPLAY: TarotCardDisplay[] = TAROT_DECK.map((c) => ({
  id: c.id,
  name: c.name,
  imageUrl: cardIdToImageUrl(c.id),
  thumbnailUrl: cardIdToThumbUrl(c.id),
  keywords: c.keywords,
}));

export const getCardDisplay = (id: string): TarotCardDisplay | undefined => {
  const row = TAROT_DECK_DISPLAY.find((c) => c.id === id);
  if (!row) return undefined;
  return {
    ...row,
    imageUrl: cardIdToImageUrl(id),
    thumbnailUrl: cardIdToThumbUrl(id),
  };
};
