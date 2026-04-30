import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { runAudit, type AuditEntry } from "@/lib/tariff-audit";
import { getRoutingBucket } from "@/lib/tariff-calculator";
import { ClientSummaryDocument, type ClientSummaryData, type PdfEntry } from "@/lib/tariff-pdf";
import React from "react";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(
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

  const dossier = await prisma.tariffDossier.findFirst({
    where: { id: params.id, partner: { partnerCode } },
    include: {
      entries: { orderBy: { createdAt: "asc" } },
      partner: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          companyName: true,
        },
      },
    },
  });

  if (!dossier) {
    return NextResponse.json({ error: "Dossier not found" }, { status: 404 });
  }

  if (dossier.entries.length === 0) {
    return NextResponse.json({ error: "Dossier has no entries" }, { status: 400 });
  }

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

  const auditResult = runAudit(auditEntries);

  const pdfEntries: PdfEntry[] = dossier.entries.map((e) => ({
    entryNumber: e.entryNumber,
    countryOfOrigin: e.countryOfOrigin,
    entryDate: e.entryDate.toISOString(),
    enteredValue: Number(e.enteredValue),
    ieepaRate: Number(e.ieepaRate),
    ieepaDuty: Number(e.ieepaDuty),
    estimatedInterest: Number(e.estimatedInterest),
    estimatedRefund: Number(e.estimatedRefund),
    eligibility: e.eligibility,
    routingBucket: getRoutingBucket(e.eligibility),
    deadlineDays: e.deadlineDays,
    isUrgent: e.isUrgent,
  }));

  const routing = {
    selfFile: { count: 0, totalRefund: 0 },
    legalRequired: { count: 0, totalRefund: 0 },
    notApplicable: { count: 0, totalRefund: 0 },
  };
  for (const entry of pdfEntries) {
    const bucket = entry.routingBucket as keyof typeof routing;
    if (bucket in routing) {
      routing[bucket].count++;
      routing[bucket].totalRefund += entry.estimatedRefund;
    }
  }

  const topIssues = auditResult.errors.slice(0, 5).map((c) => c.message);
  const partner = dossier.partner;
  const partnerFullName = partner
    ? [partner.firstName, partner.lastName].filter(Boolean).join(" ") || "Partner"
    : "Partner";

  const data: ClientSummaryData = {
    clientCompany: dossier.clientCompany,
    clientContact: dossier.clientContact,
    clientEmail: dossier.clientEmail,
    importerNumber: dossier.importerNumber,
    partnerName: partnerFullName,
    partnerCompany: partner?.companyName ?? null,
    partnerEmail: partner?.email ?? null,
    partnerPhone: partner?.phone ?? null,
    generatedAt: new Date().toISOString(),
    dossierId: dossier.id,
    entries: pdfEntries,
    summary: {
      entryCount: dossier.entries.length,
      eligibleCount: Number(dossier.eligibleCount),
      excludedCount: Number(dossier.excludedCount),
      urgentCount: Number(dossier.urgentCount),
      totalEnteredValue: Number(dossier.totalEnteredValue),
      totalEstRefund: Number(dossier.totalEstRefund),
      totalEstInterest: Number(dossier.totalEstInterest),
      nearestDeadline: dossier.nearestDeadline?.toISOString() ?? null,
      deadlineDays: dossier.deadlineDays,
    },
    audit: {
      score: auditResult.score,
      passed: auditResult.passed,
      total: auditResult.summary.total,
      passedCount: auditResult.summary.passed,
      failed: auditResult.summary.failed,
      warnings: auditResult.summary.warnings,
      topIssues,
    },
    routing,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(React.createElement(ClientSummaryDocument, { data }) as any);
  const uint8 = new Uint8Array(buffer);

  const filename = `fintella-recovery-analysis-${dossier.clientCompany.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(uint8, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
