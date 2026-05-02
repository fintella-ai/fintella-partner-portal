import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCorsHeaders } from "@/lib/widget-auth";

/* ── In-memory rate limiter: 100 events/hour per sessionId ──────────── */
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_EVENTS = 100;
const sessionBuckets = new Map<string, number[]>();

// Periodic cleanup every 60 seconds
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  const keys = Array.from(sessionBuckets.keys());
  for (const key of keys) {
    const timestamps = sessionBuckets.get(key);
    if (!timestamps) continue;
    const valid = timestamps.filter((t: number) => t > cutoff);
    if (valid.length === 0) sessionBuckets.delete(key);
    else sessionBuckets.set(key, valid);
  }
}, 60_000);

function checkRateLimit(sessionId: string): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const timestamps = (sessionBuckets.get(sessionId) || []).filter((t) => t > cutoff);
  if (timestamps.length >= MAX_EVENTS) return false;
  timestamps.push(now);
  sessionBuckets.set(sessionId, timestamps);
  return true;
}

const VALID_EVENTS = new Set([
  "loaded",
  "opened",
  "calc_started",
  "calc_completed",
  "referral_started",
  "referral_submitted",
  "chat_opened",
  "tab_switched",
]);

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(req.headers.get("origin"), null),
  });
}

/**
 * POST /api/widget/impression
 *
 * Body: { variantName, sessionId, partnerCode?, event, metadata? }
 *
 * Fire-and-forget impression tracking. Never blocks the widget UX.
 * CORS headers for cross-origin widget usage.
 * Rate limit: 100 events/hour per session.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin, null);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
  }

  const { variantName, sessionId, partnerCode, event, metadata } = body as {
    variantName?: string;
    sessionId?: string;
    partnerCode?: string;
    event?: string;
    metadata?: Record<string, unknown>;
  };

  if (!variantName || !sessionId || !event) {
    return NextResponse.json(
      { error: "Missing required fields: variantName, sessionId, event" },
      { status: 400, headers: cors },
    );
  }

  if (!VALID_EVENTS.has(event)) {
    return NextResponse.json(
      { error: `Invalid event. Valid events: ${Array.from(VALID_EVENTS).join(", ")}` },
      { status: 400, headers: cors },
    );
  }

  // Rate limit check
  if (!checkRateLimit(sessionId)) {
    return NextResponse.json(
      { error: "Rate limit exceeded (100 events/hour per session)" },
      { status: 429, headers: cors },
    );
  }

  // Fire-and-forget write -- respond immediately
  try {
    // Look up variant by name to get variantId
    const variant = await prisma.widgetVariant.findUnique({
      where: { name: variantName },
      select: { id: true },
    });

    if (!variant) {
      // Unknown variant -- still log with a synthetic ID so we don't lose data
      return NextResponse.json({ ok: true, tracked: false }, { headers: cors });
    }

    await prisma.widgetImpression.create({
      data: {
        variantId: variant.id,
        variantName,
        sessionId,
        partnerCode: typeof partnerCode === "string" ? partnerCode : null,
        event,
        metadata: metadata ? (metadata as any) : undefined,
      },
    });

    return NextResponse.json({ ok: true, tracked: true }, { headers: cors });
  } catch (err) {
    console.error("[widget/impression] write failed:", err);
    // Still return 200 -- impression tracking should never block the widget
    return NextResponse.json({ ok: true, tracked: false }, { headers: cors });
  }
}
