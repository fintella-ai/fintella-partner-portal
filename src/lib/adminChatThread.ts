// src/lib/adminChatThread.ts
import type { PrismaClient } from "@prisma/client";

type Tx = Pick<PrismaClient, "adminChatThread">;

export async function getOrCreateDealThread(db: Tx, dealId: string) {
  const existing = await db.adminChatThread.findUnique({ where: { dealId } });
  if (existing) return existing;
  return db.adminChatThread.create({ data: { type: "deal", dealId } });
}
