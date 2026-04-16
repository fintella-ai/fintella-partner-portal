import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/dev/api-proxy
 *
 * Super admin only. Proxies an arbitrary HTTP request to a given URL,
 * forwarding caller-supplied headers and body, then returns the response.
 * Every call is logged to WebhookRequestLog with direction="outgoing".
 *
 * Body: {
 *   url: string                     — target URL (http:// or https://)
 *   method: string                  — GET, POST, PATCH, PUT, DELETE
 *   headers: Record<string,string>  — forwarded verbatim
 *   body?: unknown                  — serialised as JSON if present and method !== GET
 * }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "super_admin")
    return NextResponse.json({ error: "Super admin only" }, { status: 403 });

  let url: string;
  let method: string;
  let headers: Record<string, string>;
  let body: unknown;

  try {
    ({ url, method = "POST", headers = {}, body } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL — must be an absolute URL (e.g. https://example.com/path)" }, { status: 400 });
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return NextResponse.json({ error: "Only http:// and https:// URLs are supported" }, { status: 400 });
  }

  const allowedMethods = ["GET", "POST", "PATCH", "PUT", "DELETE"];
  const upperMethod = String(method).toUpperCase();
  if (!allowedMethods.includes(upperMethod)) {
    return NextResponse.json({ error: `Unsupported method "${method}". Allowed: ${allowedMethods.join(", ")}` }, { status: 400 });
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

  const start = Date.now();
  const targetUrl = parsedUrl.toString();

  // Build request headers
  const reqHeaders = new Headers();
  if (!Object.keys(headers).some((k) => k.toLowerCase() === "content-type") && upperMethod !== "GET") {
    reqHeaders.set("Content-Type", "application/json");
  }
  for (const [k, v] of Object.entries(headers)) {
    if (k && v !== undefined) reqHeaders.set(k, String(v));
  }

  // Serialise outgoing body
  let bodyStr: string | undefined;
  if (upperMethod !== "GET" && body !== undefined) {
    bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  }

  // Capture outgoing headers for the log (redact auth values)
  const REDACTED = new Set(["authorization", "x-fintella-api-key", "x-webhook-secret", "cookie"]);
  const logHeaders: Record<string, string> = {};
  reqHeaders.forEach((v, k) => { logHeaders[k] = REDACTED.has(k.toLowerCase()) ? "[REDACTED]" : v; });

  const fetchInit: RequestInit = { method: upperMethod, headers: reqHeaders };
  if (bodyStr !== undefined) fetchInit.body = bodyStr;

  let responseStatus = 0;
  let rawText = "";
  let responseBody: unknown;
  let errorMsg: string | undefined;

  try {
    const res = await fetch(targetUrl, fetchInit);
    const durationMs = Date.now() - start;
    responseStatus = res.status;

    const contentType = res.headers.get("content-type") || "";
    try {
      rawText = await res.text();
      responseBody = contentType.includes("json") ? JSON.parse(rawText) : rawText;
    } catch {
      responseBody = rawText;
    }

    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => { responseHeaders[k] = v; });

    // Log outgoing call — fire-and-forget
    prisma.webhookRequestLog.create({
      data: {
        direction: "outgoing",
        method: upperMethod,
        path: "/api/admin/dev/api-proxy",
        targetUrl,
        headers: JSON.stringify(logHeaders),
        body: bodyStr ? bodyStr.slice(0, 10_000) : null,
        responseStatus,
        responseBody: rawText.slice(0, 4_000),
        durationMs,
      },
    }).catch((e) => console.error("[api-log] outgoing write failed:", e));

    return NextResponse.json({
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
      headers: responseHeaders,
      body: responseBody,
      durationMs,
      url: targetUrl,
      method: upperMethod,
    });
  } catch (err: any) {
    errorMsg = err?.message || "Request failed";
    const durationMs = Date.now() - start;

    prisma.webhookRequestLog.create({
      data: {
        direction: "outgoing",
        method: upperMethod,
        path: "/api/admin/dev/api-proxy",
        targetUrl,
        headers: JSON.stringify(logHeaders),
        body: bodyStr ? bodyStr.slice(0, 10_000) : null,
        responseStatus: 0,
        durationMs,
        error: errorMsg,
      },
    }).catch(() => {});

    return NextResponse.json({
      status: 0,
      statusText: "Network error",
      ok: false,
      headers: {},
      body: { error: errorMsg },
      durationMs,
      url: targetUrl,
      method: upperMethod,
    });
  }
}
