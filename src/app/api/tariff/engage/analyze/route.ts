import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  lookupCombinedRate,
  calculateIeepaDuty,
  calculateInterest,
  checkEligibility,
  aggregateDossier,
  classifyDealTier,
  type RateRecord,
  type QuarterlyRate,
  type EntryForDossier,
} from "@/lib/tariff-calculator";
import { IEEPA_TERMINATION_DATE } from "@/lib/tariff-countries";
import { checkPublicRateLimit } from "@/lib/tariff-rate-limiter";

export const dynamic = "force-dynamic";

const MAX_ENTRIES = 500;

interface InEntry {
  countryOfOrigin: string;
  entryDate: string;
  enteredValue: number;
  entryNumber?: string;
  entryType?: string;
  liquidationDate?: string | null;
  hasAdCvd?: boolean;
  isUsmca?: boolean;
  isDrawback?: boolean;
}

/**
 * POST /api/tariff/engage/analyze
 *
 * Public, rate-limited. Runs the TIE pipeline on a client's entries and
 * PERSISTS a TariffDossier (source public_calculator) so the downstream
 * DIY engagement + self-file kit have real entry data to work from.
 * Returns the dossierId, an aggregate summary, and the deal tier.
 */
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rl = checkPublicRateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests — please wait a moment." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs ?? 60_000) / 1000)) } },
    );
  }

  try {
    const body = await req.json();
    const entries: InEntry[] = body?.entries;
    const clientCompany: string = (body?.clientCompany || body?.company || "Prospective Client").toString();
    const clientEmail: string | undefined = body?.clientEmail || body?.email || undefined;
    const clientContact: string | undefined = body?.clientName || body?.clientContact || undefined;
    const clientPhone: string | undefined = body?.phone || body?.clientPhone || undefined;

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: "`entries` array is required" }, { status: 400 });
    }
    if (entries.length > MAX_ENTRIES) {
      return NextResponse.json({ error: `Maximum ${MAX_ENTRIES} entries` }, { status: 400 });
    }

    const allRates = await prisma.ieepaRate.findMany();
    const interestRows = await prisma.interestRate.findMany({ orderBy: { startDate: "asc" } });
    const quarterRates: QuarterlyRate[] = interestRows.map((ir) => ({
      startDate: ir.startDate,
      endDate: ir.endDate,
      rate: Number(ir.nonCorporateRate),
    }));

    const dossierEntries: EntryForDossier[] = [];
    const entryRows: Array<Record<string, unknown>> = [];

    for (const e of entries) {
      if (!e.countryOfOrigin || !e.entryDate || e.enteredValue == null) continue;
      const entryDate = new Date(e.entryDate);
      if (isNaN(entryDate.getTime())) continue;

      const countryCode = e.countryOfOrigin.toUpperCase();
      const matchingRates: RateRecord[] = allRates.filter((r) => {
        if (r.countryCode !== countryCode) return false;
        if (r.effectiveDate > entryDate) return false;
        if (r.endDate && r.endDate <= entryDate) return false;
        return true;
      });

      const rateLookup = lookupCombinedRate(matchingRates);
      const duty = calculateIeepaDuty(e.enteredValue, rateLookup.combinedRate);
      const entryType = e.entryType || "01";
      const liquidationDate = e.liquidationDate ? new Date(e.liquidationDate) : undefined;

      const eligibility = checkEligibility({
        entryDate,
        entryType,
        liquidationDate: liquidationDate || null,
        isAdCvd: e.hasAdCvd || false,
        countryOfOrigin: countryCode,
        isUsmca: e.isUsmca || false,
        isDrawback: e.isDrawback || false,
      });

      let interestEndDate = IEEPA_TERMINATION_DATE;
      if (liquidationDate && liquidationDate < IEEPA_TERMINATION_DATE) interestEndDate = liquidationDate;
      const interest = calculateInterest(duty, entryDate, interestEndDate, quarterRates);

      dossierEntries.push({ enteredValue: e.enteredValue, estimatedRefund: duty, estimatedInterest: interest, eligibility });

      entryRows.push({
        entryNumber: e.entryNumber || null,
        entryDate,
        entryType,
        countryOfOrigin: countryCode,
        enteredValue: e.enteredValue,
        ieepaRate: rateLookup.combinedRate,
        ieepaDuty: duty,
        estimatedInterest: interest,
        estimatedRefund: duty + interest,
        liquidationDate: liquidationDate || null,
        liquidationStatus: liquidationDate ? "liquidated" : "unliquidated",
        eligibility: mapEligibilityStatus(eligibility.status),
        eligibilityReason: eligibility.reason,
        deadlineDate: eligibility.deadlineDate || null,
        deadlineDays: eligibility.deadlineDays ?? null,
        isUrgent: eligibility.isUrgent || false,
        needsReview: eligibility.needsReview || false,
        extractedFrom: "manual",
      });
    }

    if (entryRows.length === 0) {
      return NextResponse.json({ error: "No valid entries to analyze" }, { status: 400 });
    }

    const summary = aggregateDossier(dossierEntries);
    const totalDuties = dossierEntries.reduce((s, e) => s + e.estimatedRefund, 0);
    const tier = classifyDealTier(totalDuties);

    const dossier = await prisma.tariffDossier.create({
      data: {
        clientCompany,
        clientContact: clientContact || null,
        clientEmail: clientEmail || null,
        clientPhone: clientPhone || null,
        status: "ready",
        source: "public_calculator",
        totalEnteredValue: summary.totalEnteredValue,
        totalEstRefund: summary.totalEstRefund,
        totalEstInterest: summary.totalEstInterest,
        entryCount: summary.entryCount,
        eligibleCount: summary.eligibleCount,
        excludedCount: summary.excludedCount,
        urgentCount: summary.urgentCount,
        nearestDeadline: summary.nearestDeadline,
        deadlineDays: summary.deadlineDays,
        entries: { create: entryRows as any },
      },
    });

    return NextResponse.json({
      success: true,
      dossierId: dossier.id,
      tier,
      summary: {
        ...summary,
        totalRefundWithInterest: summary.totalEstRefund + summary.totalEstInterest,
      },
    });
  } catch (err: any) {
    console.error("[tariff-analyze] Error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

function mapEligibilityStatus(
  status: string,
): "eligible" | "excluded_type" | "excluded_expired" | "excluded_adcvd" | "excluded_protest" | "unknown" {
  switch (status) {
    case "eligible": return "eligible";
    case "excluded_type": return "excluded_type";
    case "excluded_expired": return "excluded_expired";
    case "excluded_adcvd": return "excluded_adcvd";
    case "excluded_date": return "excluded_protest";
    default: return "unknown"; // excluded_drawback / excluded_usmca → unknown (no enum value)
  }
}
