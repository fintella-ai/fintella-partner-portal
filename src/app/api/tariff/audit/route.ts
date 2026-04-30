import { NextRequest, NextResponse } from "next/server";
import { checkPublicRateLimit } from "@/lib/tariff-rate-limiter";
import { runAudit, type AuditEntry } from "@/lib/tariff-audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/tariff/audit
 *
 * Public endpoint — no auth required, rate-limited by IP.
 * Accepts { entries: AuditEntry[] } and returns an AuditResult.
 */
export async function POST(req: NextRequest) {
  // ── Rate limit by IP ───────────────────────────────────────────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const rl = checkPublicRateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterMs: rl.retryAfterMs },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.retryAfterMs ?? 60_000) / 1000)),
        },
      },
    );
  }

  try {
    const body = await req.json();
    const entries: AuditEntry[] = body?.entries;

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: "Request body must include a non-empty `entries` array" },
        { status: 400 },
      );
    }

    const result = runAudit(entries);

    return NextResponse.json(result, {
      headers: { "X-RateLimit-Remaining": String(rl.remaining) },
    });
  } catch (err) {
    console.error("[tariff/audit] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
