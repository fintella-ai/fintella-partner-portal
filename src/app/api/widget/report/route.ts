import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { verifyWidgetJwt, getCorsHeaders } from "@/lib/widget-auth";
import { prisma } from "@/lib/prisma";
import { ClientSummaryDocument, type ClientSummaryData, type PdfEntry } from "@/lib/tariff-pdf";
import React from "react";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// ── Types ──────────────────────────────────────────────────────────────────

interface ReqEntry {
  entryNumber?: string | null;
  countryOfOrigin: string;
  entryDate: string;
  enteredValue: number;
  combinedRate: number;
  estimatedRefund: number;
  routingBucket: string;
  eligibility: { status: string; deadlineDays?: number; isUrgent?: boolean };
}

interface ReqBody {
  entries: ReqEntry[];
  summary: {
    totalEntries: number;
    totalEnteredValue: number;
    totalEstimatedRefund: number;
    selfFileCount: number;
    selfFileRefund: number;
    needsLegalCount: number;
    needsLegalRefund: number;
    notApplicableCount: number;
    auditScore: number;
    auditPassed: boolean;
    auditErrors: number;
    auditWarnings: number;
  };
  audit: {
    score: number;
    passed: boolean;
    errors: { message: string; fix?: string }[];
    warnings: { message: string }[];
  };
  clientCompany?: string;
  partnerName?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function extractToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

// ── OPTIONS (CORS preflight) ──────────────────────────────────────────────

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(req.headers.get("origin"), null),
  });
}

// ── POST — render PDF ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin, null);

  const token = extractToken(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: cors });
  }

  const payload = verifyWidgetJwt(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401, headers: cors });
  }

  let body: ReqBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
  }

  if (!body.entries?.length) {
    return NextResponse.json({ error: "No entries provided" }, { status: 400, headers: cors });
  }

  // Look up partner for name/company
  const partner = await prisma.partner.findUnique({
    where: { id: payload.sub },
    select: { firstName: true, lastName: true, companyName: true, email: true, phone: true },
  });
  const partnerName = body.partnerName
    || (partner ? `${partner.firstName || ""} ${partner.lastName || ""}`.trim() : "Partner");

  // Map entries to PDF shape
  const pdfEntries: PdfEntry[] = body.entries.map((e) => {
    const duty = e.enteredValue * e.combinedRate;
    const interest = e.estimatedRefund - duty;
    return {
      entryNumber: e.entryNumber,
      countryOfOrigin: e.countryOfOrigin,
      entryDate: e.entryDate,
      enteredValue: e.enteredValue,
      ieepaRate: e.combinedRate,
      ieepaDuty: Math.max(duty, 0),
      estimatedInterest: Math.max(interest, 0),
      estimatedRefund: e.estimatedRefund,
      eligibility: e.eligibility.status,
      routingBucket: e.routingBucket,
      deadlineDays: e.eligibility.deadlineDays ?? null,
      isUrgent: e.eligibility.isUrgent,
    };
  });

  // Build routing summary
  const routing = {
    selfFile: { count: 0, totalRefund: 0 },
    legalRequired: { count: 0, totalRefund: 0 },
    notApplicable: { count: 0, totalRefund: 0 },
  };

  let totalValue = 0;
  let totalRefund = 0;
  let totalInterest = 0;
  let eligibleCount = 0;
  let excludedCount = 0;
  let urgentCount = 0;
  let nearestDays: number | null = null;

  for (const entry of pdfEntries) {
    totalValue += entry.enteredValue;
    totalRefund += entry.estimatedRefund;
    totalInterest += entry.estimatedInterest;

    const bucketMap: Record<string, keyof typeof routing> = {
      self_file: "selfFile",
      legal_required: "legalRequired",
      not_applicable: "notApplicable",
    };
    const key = bucketMap[entry.routingBucket];
    if (key) {
      routing[key].count++;
      routing[key].totalRefund += entry.estimatedRefund;
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

  const topIssues = body.audit.errors.slice(0, 5).map((e) => e.message);

  const data: ClientSummaryData = {
    clientCompany: body.clientCompany || "Widget Analysis",
    clientContact: null,
    clientEmail: null,
    importerNumber: null,
    partnerName,
    partnerCompany: partner?.companyName || null,
    partnerEmail: partner?.email || null,
    partnerPhone: partner?.phone || null,
    generatedAt: new Date().toISOString(),
    dossierId: `WR-${Date.now().toString(36).toUpperCase()}`,
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
      score: body.audit.score,
      passed: body.audit.passed,
      total: body.summary.auditErrors + body.summary.auditWarnings + body.audit.errors.length,
      passedCount: 0,
      failed: body.summary.auditErrors,
      warnings: body.summary.auditWarnings,
      topIssues,
    },
    routing,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(React.createElement(ClientSummaryDocument, { data }) as any);
  const uint8 = new Uint8Array(buffer);

  return new NextResponse(uint8, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="fintella-audit-report.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
