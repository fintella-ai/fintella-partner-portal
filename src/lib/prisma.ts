import { PrismaClient } from "@prisma/client";
import { existsSync, copyFileSync } from "fs";
import { join } from "path";

// On Vercel, the filesystem is read-only except /tmp.
// Copy the DB to /tmp on first access so SQLite can write to it.
if (process.env.VERCEL && !existsSync("/tmp/dev.db")) {
  const src = join(process.cwd(), "prisma", "dev.db");
  if (existsSync(src)) {
    copyFileSync(src, "/tmp/dev.db");
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: process.env.VERCEL
      ? { db: { url: "file:/tmp/dev.db" } }
      : undefined,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
