import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/ai/conversations
 * Returns the current user's AI conversation list (most recent first).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const partnerCode = (session.user as any).partnerCode as string | undefined;
  const userId = partnerCode || session.user.email || "";
  if (!userId) return NextResponse.json({ error: "Could not identify user" }, { status: 400 });

  try {
    const conversations = await prisma.aiConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
      take: 50,
    });

    return NextResponse.json({
      conversations: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        messageCount: c._count.messages,
      })),
    });
  } catch (err) {
    console.error("[api/ai/conversations] error:", err);
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
  }
}
