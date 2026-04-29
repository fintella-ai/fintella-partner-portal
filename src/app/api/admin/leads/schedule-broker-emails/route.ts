import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTimezoneForState } from "@/lib/us-timezones";

const ADMIN_ROLES = ["super_admin", "admin"];
const BATCH_PER_DAY = 50;

/**
 * POST /api/admin/leads/schedule-broker-emails
 * Schedules broker recruitment emails for the next available Tue/Thu
 * at 9 AM in each broker's local timezone. If the closest Tue/Thu
 * already has 50+ scheduled, moves to the following Tue/Thu.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.includes((session.user as any).role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { leadIds, preferredDate } = await req.json();
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json({ error: "leadIds required" }, { status: 400 });
  }

  const leads = await prisma.partnerLead.findMany({
    where: { id: { in: leadIds }, status: "prospect", scheduledSendAt: null, emailSentAt: null },
  });

  const existing = await prisma.partnerLead.groupBy({
    by: ["scheduledSendAt"],
    where: { scheduledSendAt: { not: null }, emailSentAt: null },
    _count: true,
  });

  const dateCounts: Record<string, number> = {};
  for (const row of existing) {
    if (row.scheduledSendAt) {
      const key = row.scheduledSendAt.toISOString().split("T")[0];
      dateCounts[key] = (dateCounts[key] || 0) + row._count;
    }
  }

  let scheduled = 0;
  const sendTimes: Record<string, number> = {};

  for (const lead of leads) {
    const stateMatch = (lead.notes || "").match(/Location:.*,\s*(\w{2})/);
    const state = stateMatch?.[1] || "NY";
    const tz = getTimezoneForState(state);
    const sendAt = preferredDate
      ? buildSendAtForDate(preferredDate, tz)
      : findNextOpenSlot(tz, dateCounts);

    await prisma.partnerLead.update({
      where: { id: lead.id },
      data: { scheduledSendAt: sendAt },
    });

    const dayKey = sendAt.toISOString().split("T")[0];
    dateCounts[dayKey] = (dateCounts[dayKey] || 0) + 1;
    sendTimes[dayKey] = (sendTimes[dayKey] || 0) + 1;
    scheduled++;
  }

  return NextResponse.json({
    scheduled,
    skipped: leadIds.length - scheduled,
    sendTimes,
  });
}

function findNextOpenSlot(tz: string, dateCounts: Record<string, number>): Date {
  const now = new Date();
  for (let d = 0; d < 60; d++) {
    const candidate = new Date(now.getTime() + d * 86400000);
    const local = new Date(candidate.toLocaleString("en-US", { timeZone: tz }));
    const dow = local.getDay();

    if (dow !== 2 && dow !== 4) continue;
    if (d === 0 && local.getHours() >= 9) continue;

    local.setHours(9, 0, 0, 0);
    const offset = candidate.getTime() - local.getTime();
    const sendAt = new Date(local.getTime() + offset);
    const dayKey = sendAt.toISOString().split("T")[0];

    if ((dateCounts[dayKey] || 0) < BATCH_PER_DAY) {
      return sendAt;
    }
  }

  const fallback = new Date(now.getTime() + 2 * 86400000);
  fallback.setUTCHours(14, 0, 0, 0);
  return fallback;
}

function buildSendAtForDate(dateStr: string, tz: string): Date {
  const target = new Date(dateStr + "T09:00:00");
  const nowInTz = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
  const offset = new Date().getTime() - nowInTz.getTime();
  return new Date(target.getTime() + offset);
}
