import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/partner/chat-queue
 * Returns the partner's position in the live chat queue.
 * Active chat sessions ordered by creation time — the partner's
 * position is their index in the queue.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const partnerCode = (session.user as { partnerCode?: string }).partnerCode;
  if (!partnerCode) return NextResponse.json({ error: "Not a partner" }, { status: 403 });

  const activeSessions = await prisma.chatSession.findMany({
    where: { status: "active" },
    orderBy: { createdAt: "asc" },
    select: { id: true, partnerCode: true, createdAt: true },
  });

  const mySession = activeSessions.find((s) => s.partnerCode === partnerCode);
  if (!mySession) {
    return NextResponse.json({ inQueue: false, position: 0, total: activeSessions.length });
  }

  const position = activeSessions.indexOf(mySession) + 1;

  return NextResponse.json({
    inQueue: true,
    position,
    total: activeSessions.length,
    sessionId: mySession.id,
  });
}
