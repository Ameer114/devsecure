import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getEnv } from "@/lib/env";

const globalForDb = globalThis as unknown as { prisma?: PrismaClient };

function create() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: getEnv().DATABASE_URL }) });
}

// Reuse one client across hot reloads in development.
export const db = globalForDb.prisma ?? create();
if (process.env.NODE_ENV !== "production") globalForDb.prisma = db;
