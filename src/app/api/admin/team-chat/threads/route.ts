// src/app/api/admin/team-chat/threads/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAnyAdmin } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const adminEmail = session?.user?.email;
  if (!adminEmail || !isAnyAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const threads = await prisma.adminChatThread.findMany({
    where: {
      OR: [
        { type: "global" },
        { type: "deal", lastMessageAt: { gte: thirtyDaysAgo } },
      ],
    },
    orderBy: [{ type: "asc" }, { lastMessageAt: "desc" }],
    include: {
      readStates: { where: { adminEmail } },
      _count: { select: { messages: { where: { deletedAt: null } } } },
    },
  });

  // Enrich with deal names for deal-type threads
  const dealIds = threads.filter((t) => t.type === "deal" && t.dealId).map((t) => t.dealId!);
  const deals = dealIds.length
    ? await prisma.deal.findMany({ where: { id: { in: dealIds } }, select: { id: true, dealName: true } })
    : [];
  const dealMap: Record<string, string> = {};
  for (const d of deals) dealMap[d.id] = d.dealName;

  // Compute unread count per thread
  const enriched = await Promise.all(threads.map(async (t) => {
    const rs = t.readStates[0];
    const unreadCount = await prisma.adminChatMessage.count({
      where: {
        threadId: t.id,
        deletedAt: null,
        senderEmail: { not: adminEmail },
        createdAt: rs ? { gt: rs.lastReadAt } : undefined,
      },
    });
    const { readStates: _r, _count, ...rest } = t;
    return {
      ...rest,
      dealName: t.dealId ? dealMap[t.dealId] ?? null : null,
      messageCount: _count.messages,
      unreadCount,
    };
  }));

  return NextResponse.json({ threads: enriched });
}
