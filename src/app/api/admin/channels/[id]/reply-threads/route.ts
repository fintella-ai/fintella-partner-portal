// src/app/api/admin/channels/[id]/reply-threads/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAnyAdmin } from "@/lib/permissions";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!isAnyAdmin(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const threads = await prisma.channelReplyThread.findMany({
    where: { channelId: params.id },
    orderBy: { lastMessageAt: "desc" },
  });
  const partnerCodes = threads.map((t) => t.partnerCode);
  const partners = partnerCodes.length
    ? await prisma.partner.findMany({ where: { partnerCode: { in: partnerCodes } }, select: { partnerCode: true, firstName: true, lastName: true } })
    : [];
  const pMap: Record<string, string> = {};
  for (const p of partners) pMap[p.partnerCode] = `${p.firstName} ${p.lastName}`.trim();

  const unreadCounts = await prisma.channelReplyMessage.groupBy({
    by: ["threadId"],
    where: { thread: { channelId: params.id }, senderType: "partner", readByAdmin: false },
    _count: true,
  });
  const unreadMap: Record<string, number> = {};
  for (const u of unreadCounts) unreadMap[u.threadId] = u._count;

  return NextResponse.json({
    threads: threads.map((t) => ({
      ...t,
      partnerName: pMap[t.partnerCode] ?? t.partnerCode,
      unreadCount: unreadMap[t.id] ?? 0,
    })),
  });
}
