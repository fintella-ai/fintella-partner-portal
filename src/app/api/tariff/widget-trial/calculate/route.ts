import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCorsHeaders } from "@/lib/widget-auth";
import { checkWidgetRateLimit } from "@/lib/widget-rate-limit";
import { parseTrialKey, verifyTrialKey, toPartialTariffResult, type FullTariffResult } from "@/lib/widget-trial";
import {
  lookupCombinedRate,
  calculateIeepaDuty,
  calculateInterest,
  checkEligibility,
  type RateRecord,
  type QuarterlyRate,
} from "@/lib/tariff-calculator";
import { IEEPA_TERMINATION_DATE } from "@/lib/tariff-countries";

export const dynamic = "force-dynamic";

const IEEPA_TERMINATION = IEEPA_TERMINATION_DATE;

/** Pull the trial key from the X-Trial-Key header, Bearer auth, or the body. */
function extractTrialKey(req: NextRequest, body: Record<string, unknown>): string | null {
  const header = req.headers.get("x-trial-key");
  if (header) return header.trim();
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  if (typeof body?.trialKey === "string" && body.trialKey) return body.trialKey.trim();
  return null;
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(req.headers.get("origin"), null),
  });
}

/**
 * POST /api/tariff/widget-trial/calculate
 *
 * Key-authenticated. Runs the Tariff Intelligence Engine for a single entry but
 * returns a PARTIAL result — eligibility, deadlines, and filing method only.
 * The rate and every refund dollar amount stay locked until the prospect
 * upgrades to a paid plan via the engage flow.
 */
export async function POST(req: NextRequest) {
  const cors = getCorsHeaders(req.headers.get("origin"), null);

  const body = await req.json().catch(() => ({}));
  const trialKey = extractTrialKey(req, body);
  if (!trialKey) {
    return NextResponse.json({ error: "Missing trial key" }, { status: 401, headers: cors });
  }

  const parsed = parseTrialKey(trialKey);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid trial key" }, { status: 401, headers: cors });
  }

  const record = await prisma.widgetTrialKey.findUnique({
    where: { keyId: parsed.keyId },
    select: { id: true, keyHint: true, status: true, secretHash: true },
  });
  if (!record || !(await verifyTrialKey(trialKey, record.secretHash))) {
    return NextResponse.json({ error: "Invalid trial key" }, { status: 401, headers: cors });
  }
  if (record.status === "revoked") {
    return NextResponse.json({ error: "Trial key revoked" }, { status: 403, headers: cors });
  }

  // Per-key rate limit (reuse the widget limiter, keyed by the hint).
  const rateCheck = checkWidgetRateLimit(record.keyHint);
  if (!rateCheck.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterMs: rateCheck.retryAfterMs },
      {
        status: 429,
        headers: { ...cors, "Retry-After": String(Math.ceil((rateCheck.retryAfterMs || 60000) / 1000)) },
      },
    );
  }

  try {
    const { countryOfOrigin, entryDate, enteredValue } = body as {
      countryOfOrigin?: string;
      entryDate?: string;
      enteredValue?: number | string;
    };

    if (!countryOfOrigin || !entryDate || enteredValue == null) {
      return NextResponse.json(
        { error: "countryOfOrigin, entryDate, and enteredValue are required" },
        { status: 400, headers: cors },
      );
    }
    const parsedDate = new Date(entryDate);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "Invalid entryDate format" }, { status: 400, headers: cors });
    }
    const numericValue = Number(enteredValue);
    if (isNaN(numericValue) || numericValue <= 0) {
      return NextResponse.json(
        { error: "enteredValue must be a positive number" },
        { status: 400, headers: cors },
      );
    }

    const countryCode = countryOfOrigin.toUpperCase();

    // Matching IEEPA rates for this country + date
    const allRates = await prisma.ieepaRate.findMany({ where: { countryCode } });
    const matchingRates: RateRecord[] = allRates.filter((r) => {
      if (r.effectiveDate > parsedDate) return false;
      if (r.endDate && r.endDate <= parsedDate) return false;
      return true;
    });

    const rateLookup = lookupCombinedRate(matchingRates);
    const ieepaDuty = calculateIeepaDuty(numericValue, rateLookup.combinedRate);

    const eligibilityResult = checkEligibility({
      entryDate: parsedDate,
      entryType: "01",
      liquidationDate: null,
      isAdCvd: false,
      countryOfOrigin: countryCode,
    });

    const interestRows = await prisma.interestRate.findMany({ orderBy: { startDate: "asc" } });
    const quarterRates: QuarterlyRate[] = interestRows.map((ir) => ({
      startDate: ir.startDate,
      endDate: ir.endDate,
      rate: Number(ir.nonCorporateRate),
    }));
    const estimatedInterest = calculateInterest(ieepaDuty, parsedDate, IEEPA_TERMINATION, quarterRates);
    const estimatedRefund = Math.round((ieepaDuty + estimatedInterest) * 100) / 100;

    const full: FullTariffResult = {
      countryOfOrigin: countryCode,
      entryDate,
      enteredValue: numericValue,
      ieepaRate: rateLookup.combinedRate,
      rateName: rateLookup.rateName,
      rateBreakdown: rateLookup.breakdown,
      ieepaDuty,
      estimatedInterest,
      estimatedRefund,
      eligibility: eligibilityResult.status,
      eligibilityReason: eligibilityResult.reason,
      deadlineDays: eligibilityResult.deadlineDays,
      isUrgent: eligibilityResult.isUrgent,
      deadlineDate: eligibilityResult.deadlineDate,
      filingMethod: eligibilityResult.filingMethod,
    };

    // Record usage (best-effort — never block the response on it).
    await prisma.widgetTrialKey
      .update({
        where: { id: record.id },
        data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
      })
      .catch(() => {});

    return NextResponse.json(
      {
        ...toPartialTariffResult(full),
        upgradeMessage: "Upgrade to a paid plan to unlock the full refund estimate and file.",
      },
      { headers: cors },
    );
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: cors });
  }
}
