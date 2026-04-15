import { NextRequest, NextResponse } from "next/server";
import { sendMonthlyNewsletterToAllPartners } from "@/lib/sendgrid";

/**
 * GET /api/cron/monthly-newsletter
 *
 * Vercel Cron target. Fires on the 1st of each month at 14:00 UTC
 * (configured in vercel.json "crons"). Iterates every active partner
 * and sends one email using the `monthly_newsletter` EmailTemplate row,
 * so super admins can edit the body from /admin/communications Templates.
 *
 * Auth: Vercel Cron pings arrive with a CRON_SECRET header. If the
 * env var is set we require a match. If it's unset (dev/demo), we
 * allow anyone — same pattern as the rest of our env-gated features.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await sendMonthlyNewsletterToAllPartners();
  return NextResponse.json({ ok: true, ...result, firedAt: new Date().toISOString() });
}
