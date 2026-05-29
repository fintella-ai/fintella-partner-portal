import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { voidAuth, captureAuth } from "@/lib/nmi-gateway";
import { TARIFF_DIY_SERVICE, type TariffEngagementState } from "@/lib/tariff-engagement";
import { computeRiskScore, deriveRiskInput } from "@/lib/tariff-risk-score";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["super_admin", "admin", "accounting", "partner_support"];
// Approving/declining moves money (void vs capture) — restrict to financial roles.
const DECISION_ROLES = ["super_admin", "admin", "accounting"];

async function loadDossierRisk(dealId: string) {
  const dossier = await prisma.tariffDossier.findFirst({
    where: { dealId },
    include: { entries: true },
  });
  if (!dossier) return { dossier: null, risk: null };
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
  return { dossier, risk: computeRiskScore(input) };
}

/** GET — single buyout deal + fresh risk score + engagement state. */
export async function GET(req: NextRequest, { params }: { params: { dealId: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.includes((session.user as any).role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const deal = await prisma.deal.findUnique({ where: { id: params.dealId } });
  if (!deal || deal.serviceOfInterest !== TARIFF_DIY_SERVICE) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }
  const sf = (deal.serviceFields as unknown as TariffEngagementState) || {};
  if (sf.pricingModel !== "buyout") {
    return NextResponse.json({ error: "Not a buyout deal" }, { status: 400 });
  }

  const { dossier, risk } = await loadDossierRisk(deal.id);
  return NextResponse.json({
    dealId: deal.id,
    dealName: deal.dealName,
    clientName: deal.clientName,
    clientEmail: deal.clientEmail,
    company: deal.legalEntityName,
    partnerCode: deal.partnerCode,
    createdAt: deal.createdAt,
    engagement: sf,
    estimatedRefund: dossier?.totalEstRefund ? Number(dossier.totalEstRefund) : null,
    entryCount: dossier?.entryCount ?? 0,
    risk,
  });
}

/**
 * POST — record an underwriting decision.
 * body: { action: "approve" | "decline", note?: string }
 *   approve → voidAuth(hold)  : release the upfront hold (fee netted from payout)
 *   decline → captureAuth(hold): capture the upfront fee (Fintella keeps it)
 */
export async function POST(req: NextRequest, { params }: { params: { dealId: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!DECISION_ROLES.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  if (action !== "approve" && action !== "decline") {
    return NextResponse.json({ error: "action must be 'approve' or 'decline'" }, { status: 400 });
  }

  const deal = await prisma.deal.findUnique({ where: { id: params.dealId } });
  if (!deal || deal.serviceOfInterest !== TARIFF_DIY_SERVICE) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }
  const sf = (deal.serviceFields as unknown as TariffEngagementState) || {};
  if (sf.pricingModel !== "buyout") {
    return NextResponse.json({ error: "Not a buyout deal" }, { status: 400 });
  }
  if ((sf.underwritingStatus ?? "pending") !== "pending") {
    return NextResponse.json(
      { error: `Already ${sf.underwritingStatus}` },
      { status: 409 },
    );
  }

  const holdTxn = sf.upfrontTxnId;
  // Settle the NMI auth hold according to the decision (best-effort; demo-safe).
  let gateway = null;
  if (holdTxn) {
    gateway = action === "approve" ? await voidAuth(holdTxn) : await captureAuth(holdTxn);
    await prisma.paymentLog.create({
      data: {
        partnerCode: deal.partnerCode || "DIRECT",
        amount: sf.upfrontFeeCents ?? 0,
        currency: "usd",
        status: action === "approve" ? "voided" : gateway.response === "1" ? "success" : "failed",
        gatewayTxnId: gateway.transactionid || holdTxn,
        gatewayResponse: gateway.responsetext || null,
        description: `Tariff buyout underwriting ${action} — deal ${deal.id}`,
      },
    });
  }

  const nextState: Partial<TariffEngagementState> = {
    underwritingStatus: action === "approve" ? "approved" : "declined",
    // Decline captures the hold (fee earned); approve voids it (netted later).
    upfrontStatus: action === "decline" ? "paid" : "unpaid",
  };

  await prisma.deal.update({
    where: { id: deal.id },
    data: {
      stage: action === "approve" ? "client_engaged" : deal.stage,
      serviceFields: {
        ...(deal.serviceFields as object),
        ...nextState,
        underwritingNote: typeof body?.note === "string" ? body.note.slice(0, 1000) : undefined,
        underwritingDecidedBy: (session.user as any).email || (session.user as any).id || null,
        underwritingDecidedAt: new Date().toISOString(),
      },
    },
  });

  return NextResponse.json({
    success: true,
    dealId: deal.id,
    underwritingStatus: nextState.underwritingStatus,
    holdAction: holdTxn ? (action === "approve" ? "voided" : "captured") : "none",
    gateway: gateway ? { response: gateway.response, text: gateway.responsetext } : null,
  });
}
