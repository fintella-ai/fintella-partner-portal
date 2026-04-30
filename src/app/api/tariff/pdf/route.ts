import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { renderToBuffer } from "@react-pdf/renderer";
import { runAudit, type AuditEntry } from "@/lib/tariff-audit";
import { getRoutingBucket } from "@/lib/tariff-calculator";
import { ClientSummaryDocument, type ClientSummaryData, type PdfEntry } from "@/lib/tariff-pdf";
import React from "react";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface RequestEntry {
  entryNumber?: string | null;
  countryOfOrigin: string;
  entryDate: string;
  enteredValue: number;
  ieepaRate: number;
  estimatedDuty: number;
  estimatedInterest: number;
  eligibility: string;
  rateBreakdown?: { fentanyl?: number; reciprocal?: number; section122?: number };
  deadlineDays?: number | null;
  isUrgent?: boolean;
}

interface RequestBody {
  clientCompany?: string;
  clientContact?: string;
  importerNumber?: string;
  entries: RequestEntry[];
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as { name?: string; email?: string; partnerCode?: string; companyName?: string; phone?: string };
  if (!user.partnerCode) {
    return NextResponse.json({ error: "Not a partner" }, { status: 403 });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.entries?.length) {
    return NextResponse.json({ error: "No entries provided" }, { status: 400 });
  }

  const auditEntries: AuditEntry[] = body.entries.map((e) => ({
    entryNumber: e.entryNumber,
    entryDate: e.entryDate,
    countryOfOrigin: e.countryOfOrigin,
    enteredValue: e.enteredValue,
    ieepaRate: e.ieepaRate,
    eligibility: e.eligibility,
  }));

  const auditResult = runAudit(auditEntries);

  const pdfEntries: PdfEntry[] = body.entries.map((e) => {
    const refund = e.estimatedDuty + e.estimatedInterest;
    return {
      entryNumber: e.entryNumber,
      countryOfOrigin: e.countryOfOrigin,
      entryDate: e.entryDate,
      enteredValue: e.enteredValue,
      ieepaRate: e.ieepaRate,
      ieepaDuty: e.estimatedDuty,
      estimatedInterest: e.estimatedInterest,
      estimatedRefund: refund,
      eligibility: e.eligibility,
      routingBucket: getRoutingBucket(e.eligibility),
      deadlineDays: e.deadlineDays,
      isUrgent: e.isUrgent,
      rateBreakdown: e.rateBreakdown,
    };
  });

  const routing = {
    selfFile: { count: 0, totalRefund: 0 },
    legalRequired: { count: 0, totalRefund: 0 },
    notApplicable: { count: 0, totalRefund: 0 },
  };
  let totalValue = 0, totalRefund = 0, totalInterest = 0;
  let eligibleCount = 0, excludedCount = 0, urgentCount = 0;
  let nearestDays: number | null = null;

  for (const entry of pdfEntries) {
    totalValue += entry.enteredValue;
    totalRefund += entry.estimatedRefund;
    totalInterest += entry.estimatedInterest;

    const bucket = entry.routingBucket as keyof typeof routing;
    if (bucket in routing) {
      routing[bucket].count++;
      routing[bucket].totalRefund += entry.estimatedRefund;
    }

    if (entry.eligibility === "eligible") {
      eligibleCount++;
      if (entry.isUrgent) urgentCount++;
      if (entry.deadlineDays != null && (nearestDays === null || entry.deadlineDays < nearestDays)) {
        nearestDays = entry.deadlineDays;
      }
    } else {
      excludedCount++;
    }
  }

  const topIssues = auditResult.errors.slice(0, 5).map((c) => c.message);

  const data: ClientSummaryData = {
    clientCompany: body.clientCompany || "Client Analysis",
    clientContact: body.clientContact || null,
    clientEmail: null,
    importerNumber: body.importerNumber || null,
    partnerName: user.name || "Partner",
    partnerCompany: user.companyName || null,
    partnerEmail: user.email || null,
    partnerPhone: user.phone || null,
    generatedAt: new Date().toISOString(),
    dossierId: `QE-${Date.now().toString(36).toUpperCase()}`,
    entries: pdfEntries,
    summary: {
      entryCount: pdfEntries.length,
      eligibleCount,
      excludedCount,
      urgentCount,
      totalEnteredValue: totalValue,
      totalEstRefund: totalRefund,
      totalEstInterest: totalInterest,
      nearestDeadline: null,
      deadlineDays: nearestDays,
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

  const safeName = (body.clientCompany || "analysis").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  const filename = `fintella-recovery-analysis-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(uint8, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
