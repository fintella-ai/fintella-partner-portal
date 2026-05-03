import { NextRequest, NextResponse } from "next/server";
import { buildCommsGraph } from "@/lib/comms-graph";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/comms-graph
 *
 * Vercel Cron target. Designed for weekly execution.
 * Builds the cross-partner communications graph by correlating template
 * sends with downstream referral, deal, and recruitment activity.
 *
 * Auth: CRON_SECRET bearer token (same pattern as other cron endpoints).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await buildCommsGraph();

    console.log(
      `[cron/comms-graph] Complete: ${result.edgesCreated} created, ${result.edgesUpdated} updated, ${result.summariesComputed} summaries`
    );

    return NextResponse.json({
      ok: true,
      ...result,
      computedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cron/comms-graph] error:", e);
    return NextResponse.json(
      { error: "Comms graph build failed", detail: String(e) },
      { status: 500 }
    );
  }
}
