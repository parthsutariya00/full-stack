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
