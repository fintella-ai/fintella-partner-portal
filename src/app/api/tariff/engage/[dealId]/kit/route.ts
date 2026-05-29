import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { runAudit, type AuditEntry } from "@/lib/tariff-audit";
import { getRoutingBucket } from "@/lib/tariff-calculator";
import { ClientSummaryDocument, type ClientSummaryData, type PdfEntry } from "@/lib/tariff-pdf";
import { TARIFF_DIY_SERVICE } from "@/lib/tariff-engagement";
import { TARIFF_SELFFILE_GUIDE, renderGuideMarkdown } from "@/lib/tariff-selffile-guide";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/tariff/engage/[dealId]/kit?format=pdf|csv|guide
 *
 * Delivers the DIY self-file kit for a PAID tariff engagement:
 *   - pdf   → substantiated recovery-analysis PDF (default)
 *   - csv   → CAPE-ready CSV of eligible entries
 *   - guide → step-by-step self-file guide (Markdown)
 *   - (no format) → JSON manifest describing what's available
 *
 * Gated on serviceFields.upfrontStatus === "paid". The dealId (a cuid) acts as
 * the access token; no session required so the client can download from email.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { dealId: string } },
) {
  const deal = await prisma.deal.findUnique({ where: { id: params.dealId } });
  if (!deal || deal.serviceOfInterest !== TARIFF_DIY_SERVICE) {
    return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  }
  const sf = (deal.serviceFields as any) || {};
  if (sf.upfrontStatus !== "paid") {
    return NextResponse.json({ error: "Payment required to access your kit" }, { status: 402 });
  }

  const dossier = await prisma.tariffDossier.findFirst({
    where: { dealId: deal.id },
    include: { entries: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  const format = new URL(req.url).searchParams.get("format") || "manifest";

  // ── Guide (no dossier required) ───────────────────────────────────────────
  if (format === "guide") {
    return new NextResponse(renderGuideMarkdown(), {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="ieepa-cape-self-file-guide.md"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (!dossier || dossier.entries.length === 0) {
    if (format === "manifest") {
      return NextResponse.json({
        dealId: deal.id,
        paid: true,
        hasDossier: false,
        guide: TARIFF_SELFFILE_GUIDE,
        message: "No analyzed entries on file yet — guide is available; PDF/CSV unlock once entries are analyzed.",
      });
    }
    return NextResponse.json({ error: "No analyzed entries for this engagement" }, { status: 400 });
  }

  // ── CAPE CSV — eligible entries that have an entry number ──────────────────
  if (format === "csv") {
    const numbers = dossier.entries
      .filter((e) => e.eligibility === "eligible" && e.entryNumber)
      .map((e) => e.entryNumber as string);
    const csv = ["Entry Number", ...numbers].join("\n");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cape-declaration-${deal.id}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // ── Manifest (JSON) ───────────────────────────────────────────────────────
  if (format === "manifest") {
    const eligibleWithNumbers = dossier.entries.filter((e) => e.eligibility === "eligible" && e.entryNumber).length;
    return NextResponse.json({
      dealId: deal.id,
      paid: true,
      hasDossier: true,
      dossierId: dossier.id,
      summary: {
        entryCount: dossier.entryCount,
        eligibleCount: dossier.eligibleCount,
        excludedCount: dossier.excludedCount,
        urgentCount: dossier.urgentCount,
        totalEstRefund: Number(dossier.totalEstRefund || 0),
        totalEstInterest: Number(dossier.totalEstInterest || 0),
        capeReadyEntries: eligibleWithNumbers,
        nearestDeadline: dossier.nearestDeadline?.toISOString() ?? null,
        deadlineDays: dossier.deadlineDays,
      },
      downloads: {
        pdf: `/api/tariff/engage/${deal.id}/kit?format=pdf`,
        csv: `/api/tariff/engage/${deal.id}/kit?format=csv`,
        guide: `/api/tariff/engage/${deal.id}/kit?format=guide`,
      },
      guide: TARIFF_SELFFILE_GUIDE,
    });
  }

  // ── PDF (default) ─────────────────────────────────────────────────────────
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

  const data: ClientSummaryData = {
    clientCompany: dossier.clientCompany,
    clientContact: dossier.clientContact,
    clientEmail: dossier.clientEmail,
    importerNumber: dossier.importerNumber,
    partnerName: "Fintella",
    partnerCompany: null,
    partnerEmail: null,
    partnerPhone: null,
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
      topIssues: auditResult.errors.slice(0, 5).map((c) => c.message),
    },
    routing,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(React.createElement(ClientSummaryDocument, { data }) as any);
  const filename = `fintella-recovery-analysis-${dossier.clientCompany.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
