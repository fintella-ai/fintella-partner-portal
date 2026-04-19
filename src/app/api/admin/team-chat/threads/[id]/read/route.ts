// src/app/api/admin/team-chat/threads/[id]/read/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAnyAdmin } from "@/lib/permissions";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const adminEmail = session?.user?.email;
  if (!adminEmail || !isAnyAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const latest = await prisma.adminChatMessage.findFirst({
    where: { threadId: params.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  await prisma.adminChatReadState.upsert({
    where: { threadId_adminEmail: { threadId: params.id, adminEmail } },
    update: { lastReadMessageId: latest?.id ?? null, lastReadAt: new Date() },
    create: { threadId: params.id, adminEmail, lastReadMessageId: latest?.id ?? null, lastReadAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
