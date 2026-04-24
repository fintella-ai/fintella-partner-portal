import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/email-events/stats
 *
 * Per-template engagement aggregate for the Automations → Email
 * Templates page. Returns one row per template key the caller has
 * events for in the requested window.
 *
 * Query params:
 *   - days: lookback window in days, default 30, max 365
 *
 * Response shape:
 *   { stats: Record<templateKey, {
 *       sent, delivered, opens, uniqueOpens, clicks, uniqueClicks,
 *       bounced, dropped, unsubscribed, deliveryRate, openRate, clickRate
 *     }>, windowDays }
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (!["super_admin", "admin"].includes(role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const daysRaw = Number(req.nextUrl.searchParams.get("days") || "30");
  const days = Number.isFinite(daysRaw) && daysRaw > 0 && daysRaw <= 365 ? Math.floor(daysRaw) : 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    // `sent` is authoritative from EmailLog (every outbound real send
    // gets logged). Engagement events come from EmailEvent.
    const [sentCounts, events] = await Promise.all([
      prisma.emailLog.groupBy({
        by: ["template"],
        where: { status: "sent", createdAt: { gte: cutoff } },
        _count: { _all: true },
      }),
      prisma.emailEvent.findMany({
        where: { createdAt: { gte: cutoff }, template: { not: null } },
        select: { template: true, event: true, providerMessageId: true },
      }),
    ]);

    type Bucket = {
      sent: number;
      delivered: number;
      opens: number;
      uniqueOpens: number;
      clicks: number;
      uniqueClicks: number;
      bounced: number;
      dropped: number;
      unsubscribed: number;
    };
    const stats: Record<string, Bucket> = {};
    const ensure = (k: string): Bucket => {
      if (!stats[k]) {
        stats[k] = { sent: 0, delivered: 0, opens: 0, uniqueOpens: 0, clicks: 0, uniqueClicks: 0, bounced: 0, dropped: 0, unsubscribed: 0 };
      }
      return stats[k];
    };

    for (const r of sentCounts) ensure(r.template).sent = r._count._all;

    // Track unique opens/clicks per providerMessageId.
    const uniqueOpenSet: Record<string, Set<string>> = {};
    const uniqueClickSet: Record<string, Set<string>> = {};

    for (const e of events) {
      if (!e.template) continue;
      const b = ensure(e.template);
      switch (e.event) {
        case "delivered": b.delivered += 1; break;
        case "open":
          b.opens += 1;
          (uniqueOpenSet[e.template] ||= new Set()).add(e.providerMessageId);
          break;
        case "click":
          b.clicks += 1;
          (uniqueClickSet[e.template] ||= new Set()).add(e.providerMessageId);
          break;
        case "bounce": b.bounced += 1; break;
        case "dropped": b.dropped += 1; break;
        case "unsubscribe":
        case "group_unsubscribe":
          b.unsubscribed += 1;
          break;
      }
    }
    for (const k of Object.keys(stats)) {
      stats[k].uniqueOpens = (uniqueOpenSet[k]?.size) || 0;
      stats[k].uniqueClicks = (uniqueClickSet[k]?.size) || 0;
    }

    const withRates: Record<string, Bucket & { deliveryRate: number; openRate: number; clickRate: number }> = {};
    for (const [k, b] of Object.entries(stats)) {
      const deliveryRate = b.sent > 0 ? b.delivered / b.sent : 0;
      const openRate = b.delivered > 0 ? b.uniqueOpens / b.delivered : 0;
      const clickRate = b.delivered > 0 ? b.uniqueClicks / b.delivered : 0;
      withRates[k] = { ...b, deliveryRate, openRate, clickRate };
    }

    return NextResponse.json({ stats: withRates, windowDays: days });
  } catch (err) {
    console.error("[admin/email-events/stats] error:", err);
    return NextResponse.json({ error: "Failed to compute stats" }, { status: 500 });
  }
}
