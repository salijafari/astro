import { DateTime } from "luxon";
import { redis } from "./redis.js";

type Scope = string | number;

export const cacheKey = {
  dailyHoroscope: (userId: string, day: string) => `daily_horoscope:${userId}:${day}`,
  natalChart: (userId: string) => `natal_chart:${userId}`,
  transits: (userId: string, day: string) => `transits:${userId}:${day}`,
  astroEvents: (userId: string, window: Scope) => `astro_events:${userId}:${window}`,
  compatibility: (userId: string, personId: string) => `compatibility:${userId}:${personId}`,
  lifeChallenges: (userId: string) => `life_challenges:${userId}`,
  futureSeer: (userId: string, domain: string, window: string) => `future_seer:${userId}:${domain}:${window}`,
  /** v2: includes `language` on PromptContext — bump invalidates stale Redis entries. */
  promptContext: (userId: string) => `prompt_context:v2:${userId}`,
} as const;

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  const v = await redis.get(key);
  if (!v) return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

export async function cacheSetJson(key: string, value: unknown, ttlSec: number): Promise<void> {
  if (!redis) return;
  await redis.set(key, JSON.stringify(value), "EX", ttlSec);
}

export async function cacheSetUntilLocalMidnight(key: string, value: unknown, timezone: string): Promise<void> {
  const now = DateTime.now().setZone(timezone || "UTC");
  const next = now.plus({ days: 1 }).startOf("day");
  const ttl = Math.max(60, Math.round(next.diff(now, "seconds").seconds));
  await cacheSetJson(key, value, ttl);
}
