import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
import { checkPublicRateLimit } from "@/lib/tariff-rate-limiter";

export const dynamic = "force-dynamic";

// IEEPA termination date — duties after this date are not refundable
const IEEPA_TERMINATION = new Date("2026-02-24T00:00:00Z");

const MAX_ENTRIES = 500;

interface RequestEntry {
  countryOfOrigin: string;
  entryDate: string;
  enteredValue: number;
  entryNumber?: string;
  entryType?: string;
  liquidationDate?: string;
  liquidationStatus?: string;
  hasAdCvd?: boolean;
}

/**
 * POST /api/tariff/calculate
 *
 * Public endpoint — no auth required.
 * Accepts an array of customs entries and returns refund calculations.
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
    // ── Parse body ─────────────────────────────────────────────────────
    const body = await req.json();
    const entries: RequestEntry[] = body?.entries;

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: "Request body must include a non-empty `entries` array" },
        { status: 400 },
      );
    }

    if (entries.length > MAX_ENTRIES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_ENTRIES} entries per request` },
        { status: 400 },
      );
    }

    // ── Load all IEEPA rates from DB (small table, ~300 rows) ──────────
    const allRates = await prisma.ieepaRate.findMany();

    // ── Load interest rate quarters ────────────────────────────────────
    const interestRows = await prisma.interestRate.findMany({
      orderBy: { startDate: "asc" },
    });

    const quarterRates: QuarterlyRate[] = interestRows.map((ir) => ({
      startDate: ir.startDate,
      endDate: ir.endDate,
      rate: Number(ir.nonCorporateRate),
    }));

    // ── Process each entry ─────────────────────────────────────────────
    const results: Array<{
      index: number;
      countryOfOrigin: string;
      entryDate: string;
      enteredValue: number;
      entryNumber?: string;
      combinedRate: number;
      rateBreakdown: { fentanyl?: number; reciprocal?: number; section122?: number };
      estimatedDuty: number;
      estimatedInterest: number;
      eligibility: { status: string; reason: string; deadlineDays?: number; isUrgent?: boolean };
    }> = [];

    const dossierEntries: EntryForDossier[] = [];

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];

      // Validate required fields
      if (!e.countryOfOrigin || !e.entryDate || e.enteredValue == null) {
        results.push({
          index: i,
          countryOfOrigin: e.countryOfOrigin || "",
          entryDate: e.entryDate || "",
          enteredValue: e.enteredValue || 0,
          entryNumber: e.entryNumber,
          combinedRate: 0,
          rateBreakdown: {},
          estimatedDuty: 0,
          estimatedInterest: 0,
          eligibility: {
            status: "error",
            reason: "Missing required fields: countryOfOrigin, entryDate, enteredValue",
          },
        });
        continue;
      }

      const entryDate = new Date(e.entryDate);
      if (isNaN(entryDate.getTime())) {
        results.push({
          index: i,
          countryOfOrigin: e.countryOfOrigin,
          entryDate: e.entryDate,
          enteredValue: e.enteredValue,
          entryNumber: e.entryNumber,
          combinedRate: 0,
          rateBreakdown: {},
          estimatedDuty: 0,
          estimatedInterest: 0,
          eligibility: { status: "error", reason: "Invalid entryDate format" },
        });
        continue;
      }

      const countryCode = e.countryOfOrigin.toUpperCase();

      // Filter matching rates: countryCode matches, effectiveDate <= entryDate,
      // endDate is null OR endDate > entryDate
      const matchingRates: RateRecord[] = allRates.filter((r) => {
        if (r.countryCode !== countryCode) return false;
        if (r.effectiveDate > entryDate) return false;
        if (r.endDate && r.endDate <= entryDate) return false;
        return true;
      });

      const rateLookup = lookupCombinedRate(matchingRates);

      const duty = calculateIeepaDuty(e.enteredValue, rateLookup.combinedRate);

      // Eligibility check
      const entryType = e.entryType || "01"; // default to standard consumption entry
      const liquidationDate = e.liquidationDate ? new Date(e.liquidationDate) : undefined;

      const eligibility = checkEligibility({
        entryDate,
        entryType,
        liquidationDate: liquidationDate || null,
        isAdCvd: e.hasAdCvd || false,
      });

      // Interest calculation
      // Interest end date = min(liquidationDate, IEEPA termination date)
      let interestEndDate = IEEPA_TERMINATION;
      if (liquidationDate && liquidationDate < IEEPA_TERMINATION) {
        interestEndDate = liquidationDate;
      }

      const interest = calculateInterest(duty, entryDate, interestEndDate, quarterRates);

      results.push({
        index: i,
        countryOfOrigin: countryCode,
        entryDate: e.entryDate,
        enteredValue: e.enteredValue,
        entryNumber: e.entryNumber,
        combinedRate: rateLookup.combinedRate,
        rateBreakdown: rateLookup.breakdown,
        estimatedDuty: duty,
        estimatedInterest: interest,
        eligibility: {
          status: eligibility.status,
          reason: eligibility.reason,
          deadlineDays: eligibility.deadlineDays,
          isUrgent: eligibility.isUrgent,
        },
      });

      dossierEntries.push({
        enteredValue: e.enteredValue,
        estimatedRefund: duty,
        estimatedInterest: interest,
        eligibility,
      });
    }

    // ── Aggregate summary ──────────────────────────────────────────────
    const summary = aggregateDossier(dossierEntries);

    return NextResponse.json(
      { summary, entries: results },
      {
        headers: {
          "X-RateLimit-Remaining": String(rl.remaining),
        },
      },
    );
  } catch (err) {
    console.error("[tariff/calculate] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
