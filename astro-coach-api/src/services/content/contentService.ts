import { prisma } from "../../lib/prisma.js";
import { cacheGetJson, cacheSetJson } from "../../lib/cache.js";
import { redis } from "../../lib/redis.js";
import { ZODIAC_SIGNS, type ZodiacSign } from "../../constants/astrology/signs.js";
import { PLANETS, type Planet } from "../../constants/astrology/planets.js";
import { HOUSES, type AstrologicalHouse } from "../../constants/astrology/houses.js";
import { TRANSIT_MEANINGS, type TransitMeaning } from "../../constants/astrology/transits.js";
import { TAROT_DECK, type TarotCard } from "../../constants/tarotDeck.js";
import { COFFEE_SYMBOLS, type TasseographySymbol } from "../../constants/tasseographySymbols.js";
import { CHALLENGE_LIBRARY, type LifeChallenge } from "../../constants/challengeLibrary.js";
import { CONFLICT_FRAMEWORK, type ConflictType } from "../../constants/conflictFramework.js";
import { SAFETY_RESPONSES, type SafetyResponse } from "../../constants/safetyResponses.js";

// ─── Cache TTLs ───────────────────────────────────────────────────────────────
const TTL = {
  sign: 86400,        // 24h
  planet: 86400,      // 24h
  house: 86400,       // 24h
  transit: 43200,     // 12h
  tarot: 86400,       // 24h
  coffeeSymbol: 86400, // 24h
  challenge: 86400,   // 24h
  conflict: 86400,    // 24h
  prompt: 900,        // 15min — admin edits prompts frequently
  safety: 300,        // 5min — critical, must update fast
} as const;

const CK = {
  sign: (s: string) => `content:sign:${s.toLowerCase()}`,
  planet: (p: string) => `content:planet:${p.toLowerCase()}`,
  house: (n: number) => `content:house:${n}`,
  transit: (planet: string, target: string, aspect: string) =>
    `content:transit:${planet.toLowerCase()}:${target.toLowerCase()}:${aspect.toLowerCase()}`,
  tarot: (id: number) => `content:tarot:${id}`,
  coffeeSymbol: (s: string) => `content:coffee:${s.toLowerCase()}`,
  challenge: (id: string) => `content:challenge:${id}`,
  conflict: (id: string) => `content:conflict:${id}`,
  prompt: (featureId: string, templateKey: string) => `content:prompt:${featureId}:${templateKey}`,
  safety: (flagType: string) => `content:safety:${flagType}`,
};

/** Delete a Redis key directly. Used by admin routes to invalidate after save. */
export async function invalidateContentCache(key: string): Promise<void> {
  if (redis) {
    await redis.del(key);
  }
}

export { CK as contentCacheKeys };

// ─── Sign ─────────────────────────────────────────────────────────────────────

/**
 * Fetches zodiac sign meaning via Redis → PostgreSQL → static fallback.
 */
export const getSignMeaning = async (signName: string): Promise<ZodiacSign | null> => {
  const key = CK.sign(signName);

  const cached = await cacheGetJson<ZodiacSign>(key);
  if (cached) return cached;

  const dbRow = await prisma.astrologySign.findUnique({
    where: { sign: signName },
  });

  if (dbRow) {
    const val = dbRow as unknown as ZodiacSign;
    await cacheSetJson(key, val, TTL.sign);
    return val;
  }

  const fallback = ZODIAC_SIGNS.find(
    (s) => s.sign.toLowerCase() === signName.toLowerCase()
  ) ?? null;

  if (fallback) await cacheSetJson(key, fallback, TTL.sign);
  return fallback;
};

// ─── Planet ──────────────────────────────────────────────────────────────────

/**
 * Fetches planet meaning via Redis → PostgreSQL → static fallback.
 */
export const getPlanetMeaning = async (planetName: string): Promise<Planet | null> => {
  const key = CK.planet(planetName);

  const cached = await cacheGetJson<Planet>(key);
  if (cached) return cached;

  const dbRow = await prisma.astrologyPlanet.findUnique({
    where: { name: planetName },
  });

  if (dbRow) {
    const val = dbRow as unknown as Planet;
    await cacheSetJson(key, val, TTL.planet);
    return val;
  }

  const fallback = PLANETS.find(
    (p) => p.name.toLowerCase() === planetName.toLowerCase()
  ) ?? null;

  if (fallback) await cacheSetJson(key, fallback, TTL.planet);
  return fallback;
};

// ─── House ───────────────────────────────────────────────────────────────────

/**
 * Fetches house meaning via Redis → PostgreSQL → static fallback.
 */
export const getHouseMeaning = async (houseNumber: number): Promise<AstrologicalHouse | null> => {
  const key = CK.house(houseNumber);

  const cached = await cacheGetJson<AstrologicalHouse>(key);
  if (cached) return cached;

  const dbRow = await prisma.astrologyHouse.findUnique({
    where: { number: houseNumber },
  });

  if (dbRow) {
    const val = dbRow as unknown as AstrologicalHouse;
    await cacheSetJson(key, val, TTL.house);
    return val;
  }

  const fallback = HOUSES.find((h) => h.number === houseNumber) ?? null;
  if (fallback) await cacheSetJson(key, fallback, TTL.house);
  return fallback;
};

// ─── Transit ─────────────────────────────────────────────────────────────────

/**
 * Fetches transit meaning via Redis → PostgreSQL → static fallback.
 * Returns null if no match found anywhere.
 */
export const getTransitMeaning = async (
  planet: string,
  target: string,
  aspect: string
): Promise<TransitMeaning | null> => {
  const key = CK.transit(planet, target, aspect);

  const cached = await cacheGetJson<TransitMeaning>(key);
  if (cached) return cached;

  const dbRow = await prisma.astrologyTransit.findUnique({
    where: {
      transitPlanet_natalTarget_aspect: {
        transitPlanet: planet,
        natalTarget: target,
        aspect,
      },
    },
  });

  if (dbRow) {
    const val = dbRow as unknown as TransitMeaning;
    await cacheSetJson(key, val, TTL.transit);
    return val;
  }

  const fallback = TRANSIT_MEANINGS.find(
    (t) =>
      t.transitPlanet.toLowerCase() === planet.toLowerCase() &&
      t.natalTarget.toLowerCase() === target.toLowerCase() &&
      t.aspect.toLowerCase() === aspect.toLowerCase()
  ) ?? null;

  if (fallback) await cacheSetJson(key, fallback, TTL.transit);
  return fallback;
};

// ─── Tarot ───────────────────────────────────────────────────────────────────

/**
 * Fetches a tarot card by its 0-indexed ID via Redis → PostgreSQL → static fallback.
 */
export const getTarotCard = async (cardId: number): Promise<TarotCard | null> => {
  const key = CK.tarot(cardId);

  const cached = await cacheGetJson<TarotCard>(key);
  if (cached) return cached;

  const dbRow = await prisma.tarotCardContent.findUnique({
    where: { cardId },
  });

  if (dbRow) {
    const val = { ...dbRow, id: dbRow.cardId, number: dbRow.cardNumber } as unknown as TarotCard;
    await cacheSetJson(key, val, TTL.tarot);
    return val;
  }

  const fallback = TAROT_DECK.find((c) => c.id === cardId) ?? null;
  if (fallback) await cacheSetJson(key, fallback, TTL.tarot);
  return fallback;
};

// ─── Coffee Symbol ───────────────────────────────────────────────────────────

/**
 * Fetches coffee reading symbol meaning via Redis → PostgreSQL → static fallback.
 */
export const getCoffeeSymbol = async (symbolName: string): Promise<TasseographySymbol | null> => {
  const key = CK.coffeeSymbol(symbolName);

  const cached = await cacheGetJson<TasseographySymbol>(key);
  if (cached) return cached;

  const dbRow = await prisma.coffeeSymbol.findUnique({
    where: { symbol: symbolName.toLowerCase() },
  });

  if (dbRow) {
    const val = dbRow as unknown as TasseographySymbol;
    await cacheSetJson(key, val, TTL.coffeeSymbol);
    return val;
  }

  const fallback = COFFEE_SYMBOLS.find(
    (s) =>
      s.symbol.toLowerCase() === symbolName.toLowerCase() ||
      s.alternateNames.some((n) => n.toLowerCase() === symbolName.toLowerCase())
  ) ?? null;

  if (fallback) await cacheSetJson(key, fallback, TTL.coffeeSymbol);
  return fallback;
};

// ─── Challenge ───────────────────────────────────────────────────────────────

/**
 * Fetches life challenge entry via Redis → PostgreSQL → static fallback.
 */
export const getChallenge = async (challengeId: string): Promise<LifeChallenge | null> => {
  const key = CK.challenge(challengeId);

  const cached = await cacheGetJson<LifeChallenge>(key);
  if (cached) return cached;

  const dbRow = await prisma.challengeLibraryEntry.findUnique({
    where: { challengeId },
  });

  if (dbRow) {
    const val = dbRow as unknown as LifeChallenge;
    await cacheSetJson(key, val, TTL.challenge);
    return val;
  }

  const fallback = CHALLENGE_LIBRARY.find((c) => c.id === challengeId) ?? null;
  if (fallback) await cacheSetJson(key, fallback, TTL.challenge);
  return fallback;
};

// ─── Conflict Framework ──────────────────────────────────────────────────────

/**
 * Fetches conflict framework entry via Redis → PostgreSQL → static fallback.
 */
export const getConflictFramework = async (conflictTypeId: string): Promise<ConflictType | null> => {
  const key = CK.conflict(conflictTypeId);

  const cached = await cacheGetJson<ConflictType>(key);
  if (cached) return cached;

  const dbRow = await prisma.conflictFrameworkEntry.findUnique({
    where: { conflictTypeId },
  });

  if (dbRow) {
    const val = dbRow as unknown as ConflictType;
    await cacheSetJson(key, val, TTL.conflict);
    return val;
  }

  const fallback = CONFLICT_FRAMEWORK.find((c) => c.id === conflictTypeId) ?? null;
  if (fallback) await cacheSetJson(key, fallback, TTL.conflict);
  return fallback;
};

// ─── Prompt Template ─────────────────────────────────────────────────────────

/**
 * Fetches an AI prompt template via Redis → PostgreSQL → returns null.
 * Admin-edited prompts override the static prompt library functions.
 * Callers should fall back to the static prompt builder when this returns null.
 */
export const getPromptTemplate = async (
  featureId: string,
  templateKey: string
): Promise<string | null> => {
  const key = CK.prompt(featureId, templateKey);

  const cached = await cacheGetJson<string>(key);
  if (cached) return cached;

  const dbRow = await prisma.aiPromptTemplate.findUnique({
    where: { featureId_templateKey: { featureId, templateKey } },
  });

  if (dbRow?.isActive) {
    await cacheSetJson(key, dbRow.systemPrompt, TTL.prompt);
    return dbRow.systemPrompt;
  }

  return null;
};

// ─── Safety Response ─────────────────────────────────────────────────────────

/**
 * Fetches safety response via Redis → PostgreSQL → static fallback.
 */
export const getSafetyResponse = async (flagType: string): Promise<SafetyResponse | null> => {
  const key = CK.safety(flagType);

  const cached = await cacheGetJson<SafetyResponse>(key);
  if (cached) return cached;

  const dbRow = await prisma.safetyResponseContent.findUnique({
    where: { flagType },
  });

  if (dbRow) {
    const val = dbRow as unknown as SafetyResponse;
    await cacheSetJson(key, val, TTL.safety);
    return val;
  }

  const fallback = SAFETY_RESPONSES.find((s) => s.flagType === flagType) ?? null;
  if (fallback) await cacheSetJson(key, fallback, TTL.safety);
  return fallback;
};
