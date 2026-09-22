import type { z } from "zod";
import { getRedis } from "@/lib/redis";
import type { JsonValue, TaskFilters } from "@/lib/types";

/** Bump when a cached shape changes, so old entries are ignored rather than parsed. */
const NAMESPACE = "tm:v2";

export const CACHE_TTL = {
  projectList: 60,
  workspaceStats: 60,
  projectDetail: 30,
} as const;

export const cacheKeys = {
  projectList: (): string => `${NAMESPACE}:projects:list`,
  workspaceStats: (): string => `${NAMESPACE}:stats:workspace`,
  projectDetail: (projectId: string, filters: TaskFilters): string =>
    [
      NAMESPACE,
      "project",
      projectId,
      filters.status,
      filters.priority,
      filters.sort,
      encodeURIComponent(filters.search),
    ].join(":"),
  projectDetailPattern: (projectId: string): string =>
    `${NAMESPACE}:project:${projectId}:*`,
};

/**
 * Read-through cache. Every failure path — no Redis, connection error, stale shape
 * — falls back to `load()`, so the cache can only make things faster, never break
 * them.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  schema: z.ZodType<T>,
  load: () => Promise<T>,
): Promise<T> {
  const redis = getRedis();

  if (redis === null) {
    return load();
  }

  try {
    const hit = await redis.get(key);

    if (hit !== null) {
      const decoded: JsonValue = JSON.parse(hit);
      const parsed = schema.safeParse(decoded);

      if (parsed.success) {
        return parsed.data;
      }
      // Shape drifted since this entry was written — drop it and refetch.
      await redis.del(key);
    }
  } catch (caught) {
    console.warn(`[cache] read failed for ${key}: ${caught instanceof Error ? caught.message : "unknown"}`);
  }

  const fresh = await load();

  try {
    await redis.set(key, JSON.stringify(fresh), "EX", ttlSeconds);
  } catch (caught) {
    console.warn(`[cache] write failed for ${key}: ${caught instanceof Error ? caught.message : "unknown"}`);
  }

  return fresh;
}

/**
 * Same as `cached`, for loaders that can report "no such record". A `null` is never
 * stored: caching absence would pin a 404 for the whole TTL after the row appears.
 */
export async function cachedNullable<T>(
  key: string,
  ttlSeconds: number,
  schema: z.ZodType<T>,
  load: () => Promise<T | null>,
): Promise<T | null> {
  const redis = getRedis();

  if (redis === null) {
    return load();
  }

  try {
    const hit = await redis.get(key);

    if (hit !== null) {
      const decoded: JsonValue = JSON.parse(hit);
      const parsed = schema.safeParse(decoded);

      if (parsed.success) {
        return parsed.data;
      }
      await redis.del(key);
    }
  } catch (caught) {
    console.warn(
      `[cache] read failed for ${key}: ${caught instanceof Error ? caught.message : "unknown"}`,
    );
  }

  const fresh = await load();

  if (fresh === null) {
    return null;
  }

  try {
    await redis.set(key, JSON.stringify(fresh), "EX", ttlSeconds);
  } catch (caught) {
    console.warn(
      `[cache] write failed for ${key}: ${caught instanceof Error ? caught.message : "unknown"}`,
    );
  }

  return fresh;
}

async function deleteByPattern(pattern: string): Promise<void> {
  const redis = getRedis();

  if (redis === null) {
    return;
  }

  let cursor = "0";

  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = nextCursor;

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== "0");
}

/**
 * Called after every write. Drops the two workspace-wide entries plus every
 * filter variant of the affected project.
 */
export async function invalidateProject(projectId: string | null): Promise<void> {
  const redis = getRedis();

  if (redis === null) {
    return;
  }

  try {
    await redis.del(cacheKeys.projectList(), cacheKeys.workspaceStats());

    if (projectId !== null) {
      await deleteByPattern(cacheKeys.projectDetailPattern(projectId));
    }
  } catch (caught) {
    console.warn(
      `[cache] invalidation failed: ${caught instanceof Error ? caught.message : "unknown"}`,
    );
  }
}
