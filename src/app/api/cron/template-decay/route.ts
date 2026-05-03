import { NextRequest, NextResponse } from "next/server";
import { detectTemplateDecay } from "@/lib/template-decay";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/template-decay
 *
 * Vercel Cron target. Designed for daily execution.
 * Computes baseline vs current open/click rates for each email template
 * and flags templates with >20% engagement decay.
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
    const result = await detectTemplateDecay();

    console.log(
      `[cron/template-decay] Complete: ${result.templatesAnalyzed} analyzed, ${result.decaying.length} decaying`
    );

    return NextResponse.json({
      ok: true,
      ...result,
      computedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cron/template-decay] error:", e);
    return NextResponse.json(
      { error: "Decay detection failed", detail: String(e) },
      { status: 500 }
    );
  }
}
