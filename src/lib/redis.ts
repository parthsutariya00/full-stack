import Redis from "ioredis";
import { env } from "@/lib/env";

type RedisGlobal = typeof globalThis & {
  redisClient?: Redis;
};

const globalForRedis = globalThis as RedisGlobal;

/**
 * Returns the shared client, or `null` when REDIS_URL is unset — the cache layer
 * then degrades to reading straight from PostgreSQL. Connection failures are
 * logged and swallowed rather than thrown, so a Redis outage never takes the app
 * down with it.
 */
export function getRedis(): Redis | null {
  if (env.REDIS_URL === undefined) {
    return null;
  }

  if (globalForRedis.redisClient === undefined) {
    const client = new Redis(env.REDIS_URL, {
      // Fail fast: a cache read must never hold a request open.
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
      enableOfflineQueue: false,
      retryStrategy: (attempt: number): number | null =>
        attempt > 5 ? null : Math.min(attempt * 200, 2_000),
    });

    client.on("error", (error: Error) => {
      console.warn(`[redis] ${error.message}`);
    });

    globalForRedis.redisClient = client;
  }

  return globalForRedis.redisClient;
}
