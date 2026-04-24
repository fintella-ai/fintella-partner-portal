import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Orphaned admin-chat cleanup.
 *
 * An AdminChatThread is orphaned when `type = "deal"` + `dealId` points
 * at a Deal that no longer exists (typically because the deal was hard-
 * deleted after the thread was created). Deleting the thread cascades
 * to AdminChatMessage + AdminChatMention + AdminChatReadState via
 * existing schema cascades, so a single prisma.adminChatThread.delete
 * cleans up everything.
 *
 * Parallels /api/admin/dev/orphaned-ledger (#440) — two-step flow:
 *   GET  → preview count + sample rows
 *   POST → { confirm: true } → actually delete
 *
 * Super admin only.
 */

async function findOrphans() {
  const [threads, deals] = await Promise.all([
    prisma.adminChatThread.findMany({
      where: { type: "deal", dealId: { not: null } },
      include: { _count: { select: { messages: true } } },
    }),
    prisma.deal.findMany({ select: { id: true } }),
  ]);
  const dealIds = new Set(deals.map((d) => d.id));
  return threads.filter((t) => !t.dealId || !dealIds.has(t.dealId));
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "super_admin") return NextResponse.json({ error: "Super admin only" }, { status: 403 });

  const orphans = await findOrphans();
  return NextResponse.json({
    count: orphans.length,
    totalMessages: orphans.reduce((s, t) => s + (t._count?.messages ?? 0), 0),
    sample: orphans.slice(0, 50).map((t) => ({
      id: t.id,
      dealId: t.dealId,
      messages: t._count?.messages ?? 0,
      lastMessageAt: t.lastMessageAt,
      createdAt: t.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "super_admin") return NextResponse.json({ error: "Super admin only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  if (body.confirm !== true) {
    return NextResponse.json(
      { error: "Pass `{ confirm: true }` to actually delete — this writes to the real DB." },
      { status: 400 }
    );
  }

  const orphans = await findOrphans();
  if (orphans.length === 0) {
    return NextResponse.json({ deleted: 0, messagesDeleted: 0 });
  }

  const ids = orphans.map((o) => o.id);
  const messagesDeleted = orphans.reduce((s, t) => s + (t._count?.messages ?? 0), 0);
  const result = await prisma.adminChatThread.deleteMany({ where: { id: { in: ids } } });

  return NextResponse.json({
    deleted: result.count,
    messagesDeleted,
    by: session.user.email || "unknown",
    at: new Date().toISOString(),
  });
}
