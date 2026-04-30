import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  runAudit,
  generateCleanCapeEntries,
  formatCapeCSV,
  generateAuditReportCSV,
  type AuditEntry,
} from "@/lib/tariff-audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/partner/dossiers/[id]/package
 *
 * Partner-authenticated endpoint. Loads dossier entries, runs audit,
 * generates clean CAPE CSV + audit report CSV, and returns inline content.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const partnerCode = (session.user as { partnerCode?: string }).partnerCode;
  if (!partnerCode) {
    return NextResponse.json({ error: "Not a partner" }, { status: 403 });
  }

  // Verify dossier ownership
  const dossier = await prisma.tariffDossier.findFirst({
    where: { id: params.id, partner: { partnerCode } },
    include: { entries: { orderBy: { createdAt: "asc" } } },
  });

  if (!dossier) {
    return NextResponse.json({ error: "Dossier not found" }, { status: 404 });
  }

  // Map DB entries to AuditEntry format
  const auditEntries: AuditEntry[] = dossier.entries.map((e) => ({
    entryNumber: e.entryNumber,
    entryDate: e.entryDate,
    entryType: e.entryType,
    countryOfOrigin: e.countryOfOrigin,
    enteredValue: Number(e.enteredValue),
    liquidationDate: e.liquidationDate,
    liquidationStatus: e.liquidationStatus,
    hasAdCvd: e.hasAdCvd,
    ieepaRate: Number(e.ieepaRate),
    eligibility: e.eligibility,
  }));

  // Run audit
  const auditResult = runAudit(auditEntries);

  // Generate clean CAPE entries
  const cleanEntryNumbers = generateCleanCapeEntries(auditEntries, auditResult);

  // Generate CSVs
  const capeCsv = cleanEntryNumbers.length > 0
    ? formatCapeCSV(cleanEntryNumbers)
    : "";
  const auditReport = generateAuditReportCSV(auditResult);

  // Count entries that need legal review (failed errors but still have entry numbers)
  const failedIndices = new Set<number>();
  for (const check of auditResult.errors) {
    if (check.entryIndex !== undefined) {
      failedIndices.add(check.entryIndex);
    }
  }
  const needsLegal = auditEntries.filter(
    (_, i) => failedIndices.has(i) && auditEntries[i].entryNumber,
  ).length;

  return NextResponse.json({
    capeCsv,
    auditReport,
    summary: {
      totalEntries: auditEntries.length,
      eligibleForCape: cleanEntryNumbers.length,
      needsLegal,
      auditScore: auditResult.score,
    },
  });
}
