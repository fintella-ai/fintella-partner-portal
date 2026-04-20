// src/app/api/admin/partner-dm-flags/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const REVIEWER_ROLES = new Set(["super_admin", "admin", "partner_support"]);

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!role || !REVIEWER_ROLES.has(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const flag = await prisma.partnerDmFlag.findUnique({
    where: { id: params.id },
    include: { message: { include: { thread: true } } },
  });
  if (!flag) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 20 messages of context from the flagged message's thread (10 before + 10 after incl. flagged)
  const thread = flag.message.thread;
  const before = await prisma.partnerDmMessage.findMany({
    where: { threadId: thread.id, createdAt: { lt: flag.message.createdAt } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const after = await prisma.partnerDmMessage.findMany({
    where: { threadId: thread.id, createdAt: { gt: flag.message.createdAt } },
    orderBy: { createdAt: "asc" },
    take: 10,
  });
  const context = [...before.reverse(), flag.message, ...after];

  return NextResponse.json({ flag, thread, context });
}
