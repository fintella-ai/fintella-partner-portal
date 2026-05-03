import { NextRequest, NextResponse } from "next/server";
import { computeOptimalSendTimes } from "@/lib/send-time-optimizer";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/compute-send-times
 *
 * Vercel Cron target. Runs weekly. Recomputes optimal send times for all
 * partners based on the last 90 days of EmailEvent engagement data.
 *
 * Auth: Bearer CRON_SECRET
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await computeOptimalSendTimes();

  return NextResponse.json({
    ok: true,
    ...result,
    computedAt: new Date().toISOString(),
  });
}
