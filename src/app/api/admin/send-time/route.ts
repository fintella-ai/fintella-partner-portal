import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeOptimalSendTimes } from "@/lib/send-time-optimizer";

/**
 * GET /api/admin/send-time
 *
 * Returns all PartnerEngagementWindow records with aggregate stats.
 * Accessible to all admin roles.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as Record<string, unknown>).role as string;
  if (!["super_admin", "admin", "accounting", "partner_support"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const windows = await prisma.partnerEngagementWindow.findMany({
      orderBy: { computedAt: "desc" },
    });

    const total = windows.length;
    const withData = windows.filter((w) => w.sampleSize > 0);
    const avgOpenRate =
      withData.length > 0
        ? Math.round(
            (withData.reduce((sum, w) => sum + (w.openRate || 0), 0) /
              withData.length) *
              10000
          ) / 10000
        : 0;

    return NextResponse.json({
      windows,
      stats: {
        total,
        withData: withData.length,
        avgOpenRate,
        lastComputed: windows[0]?.computedAt || null,
      },
    });
  } catch {
    // Table might not exist yet
    return NextResponse.json({
      windows: [],
      stats: { total: 0, withData: 0, avgOpenRate: 0, lastComputed: null },
    });
  }
}

/**
 * POST /api/admin/send-time
 *
 * Triggers a recomputation of optimal send times from EmailEvent data.
 * super_admin only.
 */
export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as Record<string, unknown>).role as string;
  if (role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden — super_admin only" }, { status: 403 });
  }

  const result = await computeOptimalSendTimes();

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
