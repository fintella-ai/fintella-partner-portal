// src/app/api/admin/team-chat/messages/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAnyAdmin } from "@/lib/permissions";
import { publishAdminChatEvent } from "@/lib/adminChatEvents";

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

async function loadAndGate(
  params: { id: string },
  session: any,
  isSuperAdminOverride = false
) {
  const role = (session?.user as any)?.role;
  const email = session?.user?.email;
  if (!email || !isAnyAdmin(role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const msg = await prisma.adminChatMessage.findUnique({ where: { id: params.id } });
  if (!msg) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };

  const isSuper = role === "super_admin";
  const isSender = msg.senderEmail === email;
  const withinWindow = Date.now() - new Date(msg.createdAt).getTime() < EDIT_WINDOW_MS;
  const canAct = isSuper || (isSender && withinWindow) || isSuperAdminOverride;
  if (!canAct) {
    return { error: NextResponse.json({ error: "Edit window expired or not sender" }, { status: 403 }) };
  }
  return { msg };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const g = await loadAndGate(params, session);
  if (g.error) return g.error;
  const body = await req.json().catch(() => null);
  const content = body?.content;
  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }
  const updated = await prisma.adminChatMessage.update({
    where: { id: params.id },
    data: { content, editedAt: new Date() },
  });
  // Mirror edit into any DealNote rows that were spawned from this message
  await prisma.dealNote.updateMany({
    where: { sourceChatMessageId: params.id },
    data: { content },
  });
  await publishAdminChatEvent({ event: "message.updated", threadId: updated.threadId, messageId: updated.id });
  return NextResponse.json({ message: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const g = await loadAndGate(params, session);
  if (g.error) return g.error;
  const updated = await prisma.adminChatMessage.update({
    where: { id: params.id },
    data: { deletedAt: new Date() },
  });
  // Hard-delete the mirrored DealNote(s) so the deal page doesn't surface deleted chatter
  await prisma.dealNote.deleteMany({ where: { sourceChatMessageId: params.id } });
  await publishAdminChatEvent({ event: "message.deleted", threadId: updated.threadId, messageId: updated.id });
  return NextResponse.json({ ok: true });
}
