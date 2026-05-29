import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkEligibility } from "@/lib/tariff-calculator";
import { scoreExtraction, aggregateRun } from "@/lib/accuracy-scoring";
import { ACCURACY_FIXTURES } from "@/lib/__tests__/fixtures/accuracy-fixtures";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["super_admin", "admin", "accounting", "partner_support"];
const RUN_ROLES = ["super_admin", "admin"];

/**
 * GET /api/admin/accuracy-kpi
 * Returns recent accuracy runs (newest first) for the KPI report.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.includes((session.user as any).role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const runs = await prisma.accuracyRun.findMany({ orderBy: { runDate: "desc" }, take: 50 });
  return NextResponse.json({ runs, fixtureCount: ACCURACY_FIXTURES.length });
}

/**
 * POST /api/admin/accuracy-kpi
 * Runs the labeled fixtures: scores extraction precision (actual vs expected),
 * confidence calibration, and eligibility/calc accuracy (deterministic via
 * checkEligibility), then persists an AccuracyRun and returns it + drift vs the
 * previous run. Writes to the real DB.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!RUN_ROLES.includes((session.user as any).role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // 1. Extraction precision + confidence calibration.
    const scored = ACCURACY_FIXTURES.map((f) => ({
      score: scoreExtraction(f.expected, f.actual),
      confidence: f.confidence,
    }));
    const agg = aggregateRun(scored);

    // 2. Eligibility / calc accuracy (deterministic — rule + date based).
    const calcFixtures = ACCURACY_FIXTURES.filter((f) => f.calc);
    const calcResults = calcFixtures.map((f) => {
      const c = f.calc!;
      const result = checkEligibility({
        entryDate: new Date(c.entryDate),
        entryType: "01",
        liquidationDate: null,
        isAdCvd: false,
        countryOfOrigin: c.countryOfOrigin,
      });
      return {
        fixtureId: f.id,
        expectedEligibility: c.expectedEligibility,
        actualEligibility: result.status,
        match: result.status === c.expectedEligibility,
      };
    });
    const calcAccuracy =
      calcResults.length === 0 ? null : calcResults.filter((r) => r.match).length / calcResults.length;

    const run = await prisma.accuracyRun.create({
      data: {
        totalFixtures: ACCURACY_FIXTURES.length,
        overallPrecision: agg.overallPrecision,
        calcAccuracy,
        fieldPrecision: agg.fieldPrecision as unknown as Prisma.InputJsonValue,
        confidenceCalibration: agg.confidenceCalibration as unknown as Prisma.InputJsonValue,
        calcResults: calcResults as unknown as Prisma.InputJsonValue,
        mode: "extraction",
        triggeredBy: (session.user as any).email || (session.user as any).id || null,
      },
    });

    // Drift vs the immediately-previous run.
    const prev = await prisma.accuracyRun.findFirst({
      where: { id: { not: run.id } },
      orderBy: { runDate: "desc" },
    });
    const drift = prev
      ? {
          previousRunId: prev.id,
          overallPrecisionDelta: Number((run.overallPrecision - prev.overallPrecision).toFixed(4)),
          calcAccuracyDelta:
            run.calcAccuracy != null && prev.calcAccuracy != null
              ? Number((run.calcAccuracy - prev.calcAccuracy).toFixed(4))
              : null,
        }
      : null;

    return NextResponse.json({ run, drift });
  } catch (err) {
    console.error("[accuracy-kpi] run failed:", err);
    return NextResponse.json({ error: "Accuracy run failed" }, { status: 500 });
  }
}
