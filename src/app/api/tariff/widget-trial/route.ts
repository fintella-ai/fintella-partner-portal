import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkPublicRateLimit } from "@/lib/tariff-rate-limiter";
import {
  generateTrialKey,
  hashSecret,
  getTrialKeyHint,
  buildEmbedSnippet,
} from "@/lib/widget-trial";
import { TARIFF_DIY_SERVICE } from "@/lib/tariff-engagement";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/tariff/widget-trial
 *
 * Public, self-serve. A CRM/TMS prospect on /recover/tariff-diy requests a
 * free trial API key. We mint a key (store only its sha256 hash), capture an
 * optional lead Deal for follow-up, and return the key + a paste-ready embed
 * snippet + a link to the integration guide.
 *
 * Returns: { apiKey, keyHint, embedSnippet, docsUrl }
 */
export async function POST(req: NextRequest) {
  // ── Rate limit by IP (public mint endpoint) ────────────────────────────
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
        headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs ?? 60_000) / 1000)) },
      },
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const company = typeof body?.company === "string" ? body.company.trim() : "";
    const platform = typeof body?.platform === "string" ? body.platform.trim() : "";
    const contactName = typeof body?.clientName === "string" ? body.clientName.trim() : "";
    const ref = typeof body?.ref === "string" ? body.ref.trim() : "";

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }

    // Referring partner attribution (mirror the engage flow)
    let partnerCode = "DIRECT";
    if (ref) {
      const partner = await prisma.partner.findFirst({
        where: { partnerCode: { equals: ref, mode: "insensitive" } },
      });
      partnerCode = partner?.partnerCode || ref || "DIRECT";
    }

    // Mint the key — only the lookup id + bcrypt(secret) are persisted.
    const { apiKey, keyId, secret } = generateTrialKey();
    const secretHash = await hashSecret(secret);
    const keyHint = getTrialKeyHint(apiKey);

    // Optional lead Deal so the trial shows up in the pipeline for follow-up.
    let dealId: string | null = null;
    try {
      const deal = await prisma.deal.create({
        data: {
          dealName: `${company || email} — Widget Trial Key`,
          clientName: contactName || null,
          clientEmail: email,
          partnerCode,
          serviceOfInterest: TARIFF_DIY_SERVICE,
          legalEntityName: company || null,
          stage: "lead_submitted",
          tags: ["trial_key", "widget_upsell"],
          serviceFields: {
            pathway: "widget_trial",
            platform: platform || null,
            trialKeyHint: keyHint,
            status: "trial",
          },
        },
      });
      dealId = deal.id;
    } catch {
      // Lead capture is best-effort — never block key issuance on it.
      dealId = null;
    }

    await prisma.widgetTrialKey.create({
      data: {
        keyId,
        secretHash,
        keyHint,
        email,
        company: company || null,
        platform: platform || null,
        partnerCode: partnerCode === "DIRECT" ? null : partnerCode,
        dealId,
        status: "trial",
      },
    });

    const origin = req.nextUrl.origin;
    return NextResponse.json({
      apiKey,
      keyHint,
      embedSnippet: buildEmbedSnippet(apiKey, origin),
      docsUrl: `${origin}/docs/widget-trial`,
    });
  } catch {
    return NextResponse.json({ error: "Could not issue a trial key" }, { status: 500 });
  }
}
