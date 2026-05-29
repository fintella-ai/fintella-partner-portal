import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TARIFF_DIY_SERVICE, type TariffEngagementState } from "@/lib/tariff-engagement";
import { computeRiskScore, deriveRiskInput } from "@/lib/tariff-risk-score";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["super_admin", "admin", "accounting", "partner_support"];

/**
 * GET /api/admin/tariff/underwriting/queue?status=pending
 *
 * Lists buyout deals (pricingModel = "buyout") with their current underwriting
 * status and a freshly-computed risk score derived from the linked dossier.
 * Read-only — all four admin roles allowed.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!ADMIN_ROLES.includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = req.nextUrl.searchParams.get("status") || "pending"; // pending|approved|declined|all

  try {
    const deals = await prisma.deal.findMany({
      where: {
        serviceOfInterest: TARIFF_DIY_SERVICE,
        serviceFields: { path: ["pricingModel"], equals: "buyout" },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const rows = [];
    for (const deal of deals) {
      const sf = (deal.serviceFields as unknown as TariffEngagementState) || {};
      const uw = sf.underwritingStatus ?? "pending";
      if (status !== "all" && uw !== status) continue;

      const dossier = await prisma.tariffDossier.findFirst({
        where: { dealId: deal.id },
        include: { entries: true },
      });

      let risk = null;
      if (dossier) {
        const input = deriveRiskInput(
          {
            eligibleCount: dossier.eligibleCount,
            deadlineDays: dossier.deadlineDays,
            totalEstRefund: dossier.totalEstRefund ? Number(dossier.totalEstRefund) : 0,
            totalEstInterest: dossier.totalEstInterest ? Number(dossier.totalEstInterest) : 0,
          },
          dossier.entries.map((e) => ({
            eligibility: String(e.eligibility),
            eligibilityReason: e.eligibilityReason,
            liquidationStatus: String(e.liquidationStatus),
            hasAdCvd: e.hasAdCvd,
            needsReview: e.needsReview,
            deadlineDays: e.deadlineDays,
          })),
        );
        risk = computeRiskScore(input);
      }

      rows.push({
        dealId: deal.id,
        dealName: deal.dealName,
        clientName: deal.clientName,
        clientEmail: deal.clientEmail,
        company: deal.legalEntityName,
        partnerCode: deal.partnerCode,
        createdAt: deal.createdAt,
        underwritingStatus: uw,
        upfrontFeeCents: sf.upfrontFeeCents ?? null,
        hasHold: !!sf.upfrontTxnId,
        estimatedRefund: dossier?.totalEstRefund ? Number(dossier.totalEstRefund) : null,
        risk,
      });
    }

    return NextResponse.json({ status, count: rows.length, deals: rows });
  } catch (err) {
    console.error("[underwriting-queue] error:", err);
    return NextResponse.json({ error: "Failed to load underwriting queue" }, { status: 500 });
  }
}
