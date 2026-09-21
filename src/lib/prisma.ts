import { PrismaClient } from "@prisma/client";
import { env } from "@/lib/env";

type PrismaGlobal = typeof globalThis & {
  prismaClient?: PrismaClient;
};

const globalForPrisma = globalThis as PrismaGlobal;

export const prisma: PrismaClient =
  globalForPrisma.prismaClient ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  // Reuse one client across HMR reloads so dev does not exhaust the pool.
  globalForPrisma.prismaClient = prisma;
}
