/**
 * Persists deterministic transit payloads for mantra + transits UI (Transits V2 daily cache).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

export type UpsertDailyTransitCacheInput = {
  userId: string;
  localDate: string;
  language: string;
  dominantEventId: string | null;
  eventsJson: Prisma.InputJsonValue;
  ingressesJson?: Prisma.InputJsonValue | null;
  lunationsJson?: Prisma.InputJsonValue | null;
  retrogradesJson?: Prisma.InputJsonValue | null;
  moonContextJson?: Prisma.InputJsonValue | null;
  expiresAt: Date;
};

/**
 * Upserts a row in UserTransitDailyCache for the given local calendar day and language.
 */
export async function upsertUserTransitDailyCache(input: UpsertDailyTransitCacheInput): Promise<void> {
  const {
    userId,
    localDate,
    language,
    dominantEventId,
    eventsJson,
    ingressesJson,
    lunationsJson,
    retrogradesJson,
    moonContextJson,
    expiresAt,
  } = input;

  await prisma.userTransitDailyCache.upsert({
    where: {
      userId_localDate_language: { userId, localDate, language },
    },
    create: {
      userId,
      localDate,
      language,
      dominantEventId,
      eventsJson,
      ingressesJson: ingressesJson ?? undefined,
      lunationsJson: lunationsJson ?? undefined,
      retrogradesJson: retrogradesJson ?? undefined,
      moonContextJson: moonContextJson ?? undefined,
      expiresAt,
    },
    update: {
      dominantEventId,
      eventsJson,
      ingressesJson: ingressesJson ?? undefined,
      lunationsJson: lunationsJson ?? undefined,
      retrogradesJson: retrogradesJson ?? undefined,
      moonContextJson: moonContextJson ?? undefined,
      expiresAt,
      computedAt: new Date(),
    },
  });
}
