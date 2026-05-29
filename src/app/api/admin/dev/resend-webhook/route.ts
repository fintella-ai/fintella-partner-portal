import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/dev/resend-webhook
 *
 * Super admin only. Re-sends a previously-logged OUTGOING webhook post
 * (e.g. a workflow-engine webhook.post to OpCenter) to its original
 * targetUrl with the original body.
 *
 * The receiver's auth is a token embedded in the targetUrl itself
 * (e.g. https://opcenter.app/api/sales/hooks/<TOKEN>), so resending to
 * the stored targetUrl works without auth headers — the logged headers
 * are redacted anyway.
 *
 * Body: { logId: string }
 *
 * The outbound fetch validates targetUrl with the EXACT private-IP /
 * protocol guard used in api-proxy/route.ts so CodeQL js/request-forgery
 * does not flag it. Do not remove the guard.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "super_admin")
    return NextResponse.json({ error: "Super admin only" }, { status: 403 });

  let logId: string;
  try {
    ({ logId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!logId) return NextResponse.json({ error: "logId required" }, { status: 400 });

  const log = await prisma.webhookRequestLog.findUnique({
    where: { id: logId },
    select: { id: true, direction: true, method: true, targetUrl: true, body: true },
  });

  if (!log) return NextResponse.json({ error: "Log entry not found" }, { status: 404 });
  if (log.direction !== "outgoing")
    return NextResponse.json({ error: "Only outgoing webhook entries can be resent" }, { status: 400 });
  if (!log.targetUrl)
    return NextResponse.json({ error: "No targetUrl stored for this log entry" }, { status: 400 });
  if (!log.body)
    return NextResponse.json({ error: "No request body stored for this log entry" }, { status: 400 });

  // ── SSRF guard — copied verbatim from api-proxy/route.ts ──
  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(log.targetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid stored targetUrl — must be an absolute URL (e.g. https://example.com/path)" }, { status: 400 });
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return NextResponse.json({ error: "Only http:// and https:// URLs are supported" }, { status: 400 });
  }

  // Block private/loopback ranges to prevent SSRF pivoting to internal services.
  const hostname = parsedUrl.hostname.toLowerCase();
  const PRIVATE_PATTERNS = [
    /^localhost$/,
    /^127\./,
    /^0\.0\.0\.0$/,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/,
  ];
  if (PRIVATE_PATTERNS.some((p) => p.test(hostname))) {
    return NextResponse.json(
      { error: "Requests to localhost and private IP ranges are not permitted" },
      { status: 400 }
    );
  }

  const targetUrl = parsedUrl.toString();
  const method = (log.method || "POST").toUpperCase();
  const start = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let responseStatus = 0;
  let responseBody = "";
  let errorMsg: string | undefined;

  try {
    const res = await fetch(targetUrl, {
      method,
      headers: { "Content-Type": "application/json" },
      body: log.body,
      signal: controller.signal,
    });
    responseStatus = res.status;
    responseBody = (await res.text()).slice(0, 4_000);
  } catch (err: any) {
    errorMsg = err?.name === "AbortError" ? "Request timed out after 10s" : (err?.message || "Request failed");
  } finally {
    clearTimeout(timeout);
  }

  const durationMs = Date.now() - start;

  // Write a NEW log row for the resend attempt.
  let resentLogId: string | null = null;
  try {
    const newLog = await prisma.webhookRequestLog.create({
      data: {
        direction: "outgoing",
        method,
        path: "/api/admin/dev/resend-webhook",
        targetUrl,
        body: log.body.slice(0, 10_000),
        responseStatus,
        responseBody: responseBody || null,
        durationMs,
        error: errorMsg ?? null,
      },
      select: { id: true },
    });
    resentLogId = newLog.id;
  } catch (e) {
    console.error("[resend-webhook] log write failed:", e);
  }

  if (errorMsg) {
    return NextResponse.json({
      success: false,
      status: 0,
      responseBody: errorMsg,
      resentLogId,
    });
  }

  return NextResponse.json({
    success: responseStatus >= 200 && responseStatus < 400,
    status: responseStatus,
    responseBody,
    resentLogId,
  });
}
