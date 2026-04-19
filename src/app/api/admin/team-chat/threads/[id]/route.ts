// src/app/api/admin/team-chat/threads/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAnyAdmin } from "@/lib/permissions";
import { parseDealRefs } from "@/lib/parseMentions";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!isAnyAdmin(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
  const before = url.searchParams.get("before");

  const thread = await prisma.adminChatThread.findUnique({ where: { id: params.id } });
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  const messages = await prisma.adminChatMessage.findMany({
    where: { threadId: params.id, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { mentions: true },
  });

  // Collect all deal refs from message contents and resolve names in one round-trip
  const dealRefs = new Set<string>();
  for (const m of messages) for (const id of parseDealRefs(m.content)) dealRefs.add(id);
  const deals = dealRefs.size
    ? await prisma.deal.findMany({
        where: { id: { in: Array.from(dealRefs) } },
        select: { id: true, dealName: true },
      })
    : [];
  const dealMap: Record<string, string> = {};
  for (const d of deals) dealMap[d.id] = d.dealName;

  // Include deal name for the thread itself if type=deal
  let threadDealName: string | null = null;
  if (thread.type === "deal" && thread.dealId) {
    const d = await prisma.deal.findUnique({ where: { id: thread.dealId }, select: { dealName: true } });
    threadDealName = d?.dealName ?? null;
  }

  return NextResponse.json({
    thread: { ...thread, dealName: threadDealName },
    messages: messages.reverse(), // return oldest-first for UI append
    deals: dealMap,
  });
}
