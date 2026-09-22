import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is missing — copy .env.example to .env and set it."),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Optional: with no Redis configured the cache layer becomes a pass-through.
  REDIS_URL: z
    .string()
    .min(1)
    .optional()
    .transform((value): string | undefined => (value === "" ? undefined : value)),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
  REDIS_URL: process.env.REDIS_URL,
});

/**
 * S3-compatible bucket credentials — a Railway Storage Bucket in this app.
 *
 * Optional as a group: with none of them set the app runs exactly as before and
 * the upload UI reports that storage is unconfigured, so a missing bucket never
 * takes the whole app down at boot.
 *
 * Railway injects its bucket credentials under the bare names `ENDPOINT`,
 * `BUCKET`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY` and `REGION`. Those are read
 * first; the `STORAGE_*` names are the explicit local equivalents and win when
 * both are present.
 */
const storageSchema = z.object({
  endpoint: z.string().url(),
  bucket: z.string().min(1),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  region: z.string().min(1).default("auto"),
  /** Buckets predating Railway's virtual-hosted URLs, and most self-hosted S3 servers. */
  forcePathStyle: z.boolean().default(false),
});

export type StorageEnv = z.infer<typeof storageSchema>;

/** First non-empty value, so an unset Railway reference never masks a local one. */
function firstSet(...values: (string | undefined)[]): string | undefined {
  for (const value of values) {
    if (value !== undefined && value.trim() !== "") {
      return value.trim();
    }
  }
  return undefined;
}

function readStorageEnv(): StorageEnv | null {
  const parsed = storageSchema.safeParse({
    endpoint: firstSet(process.env.STORAGE_ENDPOINT, process.env.ENDPOINT),
    bucket: firstSet(process.env.STORAGE_BUCKET, process.env.BUCKET),
    accessKeyId: firstSet(process.env.STORAGE_ACCESS_KEY_ID, process.env.ACCESS_KEY_ID),
    secretAccessKey: firstSet(
      process.env.STORAGE_SECRET_ACCESS_KEY,
      process.env.SECRET_ACCESS_KEY,
    ),
    region: firstSet(process.env.STORAGE_REGION, process.env.REGION) ?? "auto",
    forcePathStyle: firstSet(process.env.STORAGE_FORCE_PATH_STYLE) === "true",
  });

  return parsed.success ? parsed.data : null;
}

export const storageEnv: StorageEnv | null = readStorageEnv();
