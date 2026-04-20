// src/app/api/admin/channels/reply-threads/[id]/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAnyAdmin } from "@/lib/permissions";
import { publishPortalChatEvent } from "@/lib/portalChatEvents";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!isAnyAdmin(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const thread = await prisma.channelReplyThread.findUnique({ where: { id: params.id } });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = await prisma.channelReplyMessage.findMany({
    where: { threadId: params.id },
    orderBy: { createdAt: "asc" },
  });
  // Mark partner-side msgs as read by admin on open
  await prisma.channelReplyMessage.updateMany({
    where: { threadId: params.id, senderType: "partner", readByAdmin: false },
    data: { readByAdmin: true },
  });
  return NextResponse.json({ thread, messages });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const senderEmail = session?.user?.email;
  const senderName = session?.user?.name || senderEmail || "Admin";
  if (!senderEmail || !isAnyAdmin(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const content = body?.content;
  if (!content || typeof content !== "string" || content.length > 10_000) {
    return NextResponse.json({ error: "content required (≤10KB)" }, { status: 400 });
  }
  const thread = await prisma.channelReplyThread.findUnique({ where: { id: params.id } });
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  const msg = await prisma.channelReplyMessage.create({
    data: {
      threadId: params.id,
      senderType: "admin",
      senderEmail,
      senderName,
      content,
      readByAdmin: true,
    },
  });
  await prisma.channelReplyThread.update({
    where: { id: params.id },
    data: { lastMessageAt: new Date() },
  });
  // Notify the partner
  await prisma.notification.create({
    data: {
      recipientType: "partner",
      recipientId: thread.partnerCode,
      type: "channel_reply",
      title: `${senderName} replied`,
      message: content.slice(0, 100),
      link: `/dashboard/announcements?channelId=${thread.channelId}&thread=me`,
    },
  }).catch(() => {});
  await publishPortalChatEvent({
    event: "channel.reply.created",
    channelId: thread.channelId,
    threadId: thread.id,
    messageId: msg.id,
  });
  return NextResponse.json({ message: msg }, { status: 201 });
}
