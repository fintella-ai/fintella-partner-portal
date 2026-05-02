import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/widget-analytics/funnel?range=7d|30d|all
 * Returns funnel data per variant for the given date range.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!["super_admin", "admin"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const range = req.nextUrl.searchParams.get("range") || "30d";
  let since: Date | undefined;
  if (range === "7d") {
    since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  } else if (range === "30d") {
    since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }
  // "all" => no date filter

  const where: any = {};
  if (since) {
    where.createdAt = { gte: since };
  }

  // Group by variantName + event, count
  const impressions = await prisma.widgetImpression.groupBy({
    by: ["variantName", "event"],
    where,
    _count: { id: true },
  });

  // Pivot into funnel rows
  const variantMap = new Map<
    string,
    {
      variantName: string;
      loaded: number;
      opened: number;
      calc_started: number;
      calc_completed: number;
      referral_started: number;
      referral_submitted: number;
      chat_opened: number;
    }
  >();

  for (const row of impressions) {
    if (!variantMap.has(row.variantName)) {
      variantMap.set(row.variantName, {
        variantName: row.variantName,
        loaded: 0,
        opened: 0,
        calc_started: 0,
        calc_completed: 0,
        referral_started: 0,
        referral_submitted: 0,
        chat_opened: 0,
      });
    }
    const entry = variantMap.get(row.variantName)!;
    if (row.event in entry) {
      (entry as any)[row.event] = row._count.id;
    }
  }

  return NextResponse.json({ funnel: Array.from(variantMap.values()) });
}
