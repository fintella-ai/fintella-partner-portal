import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * GET /api/admin/dev/signwell-template?id=<template_id>
 *
 * Admin-only diagnostic. Fetches a SignWell template by id via the
 * SignWell API and returns a compact summary showing every recipient
 * placeholder plus its fields, so we can see EXACTLY what
 * placeholder_name / role strings our code needs to match when sending.
 *
 * Returns the raw template JSON too so the admin can spot anything
 * weird the summary might miss. Gated to super_admin + admin since it
 * exposes template internals.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as any).role;
  if (!["super_admin", "admin"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const templateIdRaw = req.nextUrl.searchParams.get("id");
  if (!templateIdRaw) {
    return NextResponse.json(
      { error: "Pass ?id=<template_id> in the query string." },
      { status: 400 }
    );
  }
  // Strict allowlist validation — SignWell template IDs are UUIDs
  // (8-4-4-4-12 hex). Reject anything that doesn't match so a user
  // can't inject path segments or other URLs into the SignWell API
  // call (CodeQL SSRF mitigation).
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(templateIdRaw)) {
    return NextResponse.json(
      { error: "Invalid template id format. Expected a UUID (e.g. 7594a34a-0a86-45b5-9d20-629215993230)." },
      { status: 400 }
    );
  }
  const templateId = templateIdRaw;

  const apiKey = process.env.SIGNWELL_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "SIGNWELL_API_KEY not configured on the server." },
      { status: 500 }
    );
  }

  // SignWell template API paths. /document_templates/<id> is the
  // current documented endpoint; the others are legacy variants we
  // try as fallbacks before giving up.
  const candidateUrls = [
    `https://www.signwell.com/api/v1/document_templates/${templateId}`,
    `https://www.signwell.com/api/v1/document_templates/${templateId}/`,
    `https://www.signwell.com/api/v2/document_templates/${templateId}`,
    `https://www.signwell.com/api/v1/templates/${templateId}`,
    `https://www.signwell.com/api/v1/template/${templateId}`,
  ];

  let raw: any = null;
  const attempts: Array<{ url: string; status: number; snippet: string }> = [];
  for (const url of candidateUrls) {
    const res = await fetch(url, {
      headers: {
        "X-Api-Key": apiKey,
        Accept: "application/json",
      },
    });
    const body = await res.text();
    attempts.push({
      url,
      status: res.status,
      snippet: body.slice(0, 200),
    });
    if (res.ok) {
      try {
        raw = JSON.parse(body);
        break;
      } catch {
        // not JSON, keep trying
      }
    }
  }

  if (!raw) {
    return NextResponse.json(
      {
        error: "SignWell API rejected every candidate URL.",
        attempts,
      },
      { status: 502 }
    );
  }

  // SignWell exposes recipients under different field names depending on
  // API version: placeholders, recipients, template_fields, etc. Pull
  // whatever we can find and normalize into a compact summary.
  const placeholders =
    raw.placeholders || raw.recipients || raw.template_recipients || [];
  const summary = (Array.isArray(placeholders) ? placeholders : []).map((p: any, idx: number) => ({
    index: idx + 1,
    id: p.id,
    role: p.role || p.placeholder_name || null,
    placeholder_name: p.placeholder_name || p.role || null,
    name: p.name || null,
    email: p.email || null,
    color: p.color || null,
    fields_count: Array.isArray(p.fields) ? p.fields.length : null,
    fields: Array.isArray(p.fields)
      ? p.fields.map((f: any) => ({
          id: f.id,
          api_id: f.api_id,
          type: f.type,
          required: f.required,
        }))
      : undefined,
  }));

  // Also grab any top-level fields array if SignWell returns one.
  const topLevelFields = Array.isArray(raw.fields)
    ? raw.fields.map((f: any) => ({
        id: f.id,
        api_id: f.api_id,
        type: f.type,
        placeholder_name: f.placeholder_name,
        recipient_id: f.recipient_id,
      }))
    : [];

  return NextResponse.json(
    {
      template_id: templateId,
      name: raw.name,
      summary_recipients: summary,
      top_level_fields: topLevelFields,
      raw,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
