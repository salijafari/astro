import { Redis as IoRedis } from "ioredis";

/**
 * Redis client when REDIS_URL is set; otherwise null (in-memory fallbacks in callers).
 */
export const redis = process.env.REDIS_URL ? new IoRedis(process.env.REDIS_URL) : null;
