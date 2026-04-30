import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import {
  lookupCombinedRate,
  calculateIeepaDuty,
  calculateInterest,
  checkEligibility,
  aggregateDossier,
  type RateRecord,
  type QuarterlyRate,
  type EntryForDossier,
} from "@/lib/tariff-calculator";

export const dynamic = "force-dynamic";

/* ── POST — add entries to a dossier ──────────────────────────────────────── */

interface EntryInput {
  countryOfOrigin: string;
  entryDate: string;
  enteredValue: number;
  entryNumber?: string;
  entryType?: string;
  liquidationDate?: string;
  liquidationStatus?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const partnerCode = (session.user as { partnerCode?: string }).partnerCode;
  if (!partnerCode) return NextResponse.json({ error: "Not a partner" }, { status: 403 });

  // Verify dossier ownership
  const dossier = await prisma.tariffDossier.findFirst({
    where: { id: params.id, partner: { partnerCode } },
  });
  if (!dossier) {
    return NextResponse.json({ error: "Dossier not found" }, { status: 404 });
  }

  const body = await req.json();
  const entriesInput: EntryInput[] = body.entries;
  if (!Array.isArray(entriesInput) || entriesInput.length === 0) {
    return NextResponse.json({ error: "entries array is required" }, { status: 400 });
  }

  // Load rate data for lookups
  const [ieepaRates, interestRates] = await Promise.all([
    prisma.ieepaRate.findMany({ orderBy: { effectiveDate: "asc" } }),
    prisma.interestRate.findMany({ orderBy: { startDate: "asc" } }),
  ]);

  // Convert InterestRate rows to QuarterlyRate format
  const quarterlyRates: QuarterlyRate[] = interestRates.map((ir) => ({
    startDate: ir.startDate,
    endDate: ir.endDate,
    rate: Number(ir.nonCorporateRate),
  }));

  const now = new Date();
  const createdEntries = [];

  for (const input of entriesInput) {
    if (!input.countryOfOrigin || !input.entryDate || input.enteredValue == null) {
      continue; // skip invalid rows
    }

    const entryDate = new Date(input.entryDate);
    const enteredValue = Number(input.enteredValue);
    const countryCode = input.countryOfOrigin.toUpperCase();
    const entryType = input.entryType || "01"; // default consumption entry
    const liquidationDate = input.liquidationDate ? new Date(input.liquidationDate) : null;

    // Look up applicable IEEPA rates for this country/date
    const matchingRates: RateRecord[] = ieepaRates.filter((r) => {
      return (
        r.countryCode === countryCode &&
        r.effectiveDate <= entryDate &&
        (r.endDate == null || r.endDate >= entryDate)
      );
    });

    const rateLookup = lookupCombinedRate(matchingRates);
    const ieepaDuty = calculateIeepaDuty(enteredValue, rateLookup.combinedRate);

    // Interest from entry date (deposit date) to today
    const estimatedInterest = calculateInterest(ieepaDuty, entryDate, now, quarterlyRates);
    const estimatedRefund = ieepaDuty + estimatedInterest;

    // Eligibility check
    const eligibility = checkEligibility({
      entryDate,
      entryType,
      liquidationDate,
      isAdCvd: false,
    });

    // Map eligibility status to EntryEligibility enum
    const eligibilityEnum = mapEligibilityStatus(eligibility.status);

    // Map liquidation status to LiquidationStatus enum
    const liqStatus = mapLiquidationStatus(input.liquidationStatus);

    // Find matching rate ID for linking
    const primaryRate = matchingRates.length > 0 ? matchingRates[0] : null;

    const entry = await prisma.tariffEntry.create({
      data: {
        dossierId: params.id,
        entryNumber: input.entryNumber || null,
        entryDate,
        entryType,
        countryOfOrigin: countryCode,
        enteredValue: new Decimal(enteredValue),
        ieepaRateId: primaryRate?.id || null,
        ieepaRate: new Decimal(rateLookup.combinedRate),
        ieepaDuty: new Decimal(ieepaDuty),
        estimatedInterest: new Decimal(estimatedInterest),
        estimatedRefund: new Decimal(estimatedRefund),
        liquidationDate,
        liquidationStatus: liqStatus,
        eligibility: eligibilityEnum,
        eligibilityReason: eligibility.reason,
        deadlineDate: eligibility.deadlineDate || null,
        deadlineDays: eligibility.deadlineDays ?? null,
        isUrgent: eligibility.isUrgent || false,
        htsCodes: [],
        chapter99Codes: [],
        extractedFrom: "manual",
      },
    });

    createdEntries.push(entry);
  }

  // Re-aggregate dossier summary
  const allEntries = await prisma.tariffEntry.findMany({
    where: { dossierId: params.id },
  });

  const dossierEntries: EntryForDossier[] = allEntries.map((e) => ({
    enteredValue: Number(e.enteredValue),
    estimatedRefund: Number(e.estimatedRefund),
    estimatedInterest: Number(e.estimatedInterest),
    eligibility: {
      status: e.eligibility,
      reason: e.eligibilityReason || "",
      deadlineDays: e.deadlineDays ?? undefined,
      isUrgent: e.isUrgent,
      deadlineDate: e.deadlineDate ?? undefined,
    },
  }));

  const summary = aggregateDossier(dossierEntries);

  // Update dossier with aggregated summary
  const updatedDossier = await prisma.tariffDossier.update({
    where: { id: params.id },
    data: {
      entryCount: summary.entryCount,
      eligibleCount: summary.eligibleCount,
      excludedCount: summary.excludedCount,
      urgentCount: summary.urgentCount,
      totalEnteredValue: new Decimal(summary.totalEnteredValue),
      totalEstRefund: new Decimal(summary.totalEstRefund),
      totalEstInterest: new Decimal(summary.totalEstInterest),
      nearestDeadline: summary.nearestDeadline,
      deadlineDays: summary.deadlineDays,
      status: summary.entryCount > 0 ? "ready" : "draft",
    },
    include: { entries: { orderBy: { createdAt: "asc" } } },
  });

  return NextResponse.json({
    dossier: updatedDossier,
    created: createdEntries.length,
    summary,
  }, { status: 201 });
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function mapEligibilityStatus(
  status: string,
): "eligible" | "excluded_type" | "excluded_expired" | "excluded_adcvd" | "excluded_protest" | "unknown" {
  switch (status) {
    case "eligible": return "eligible";
    case "excluded_type": return "excluded_type";
    case "excluded_expired": return "excluded_expired";
    case "excluded_adcvd": return "excluded_adcvd";
    case "excluded_date": return "excluded_protest"; // closest match for date exclusion
    default: return "unknown";
  }
}

function mapLiquidationStatus(
  status?: string,
): "unliquidated" | "liquidated" | "final" | "unknown" {
  if (!status) return "unknown";
  const lower = status.toLowerCase();
  if (lower === "liquidated") return "liquidated";
  if (lower === "unliquidated") return "unliquidated";
  if (lower === "final") return "final";
  return "unknown";
}
