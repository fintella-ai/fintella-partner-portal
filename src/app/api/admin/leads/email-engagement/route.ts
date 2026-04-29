import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["super_admin", "admin"];

/**
 * GET /api/admin/leads/email-engagement
 * Returns email engagement status for all broker recruitment emails.
 * Maps email → highest engagement level: clicked > opened > delivered > sent > bounced
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.includes((session.user as any).role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const logs = await prisma.emailLog.findMany({
    where: { template: "broker_recruitment_cold" },
    select: { toEmail: true, providerMessageId: true, status: true, createdAt: true },
  });

  if (logs.length === 0) {
    return NextResponse.json({ engagement: {} });
  }

  const msgIds = logs.map((l) => l.providerMessageId).filter(Boolean) as string[];

  const events = msgIds.length > 0
    ? await prisma.emailEvent.findMany({
        where: { providerMessageId: { in: msgIds } },
        select: { providerMessageId: true, event: true, timestamp: true },
      })
    : [];

  const msgIdToEmail = new Map<string, string>();
  for (const log of logs) {
    if (log.providerMessageId) {
      msgIdToEmail.set(log.providerMessageId, log.toEmail.toLowerCase());
    }
  }

  const EVENT_PRIORITY: Record<string, number> = {
    click: 5,
    open: 4,
    delivered: 3,
    processed: 2,
    deferred: 1,
    bounce: -1,
    dropped: -2,
    spamreport: -3,
  };

  const engagement: Record<string, { status: string; sentAt: string }> = {};

  for (const log of logs) {
    const email = log.toEmail.toLowerCase();
    if (!engagement[email]) {
      engagement[email] = {
        status: log.status === "sent" ? "sent" : log.status === "demo" ? "demo" : "failed",
        sentAt: log.createdAt.toISOString(),
      };
    }
  }

  for (const evt of events) {
    const email = msgIdToEmail.get(evt.providerMessageId);
    if (!email) continue;
    const current = engagement[email];
    if (!current) continue;
    const currentPriority = EVENT_PRIORITY[current.status] ?? 0;
    const eventPriority = EVENT_PRIORITY[evt.event] ?? 0;
    if (eventPriority > currentPriority) {
      engagement[email] = { ...current, status: evt.event };
    }
  }

  return NextResponse.json({ engagement });
}
