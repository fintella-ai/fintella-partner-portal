import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcWaterfallCommissions, type PartnerChainNode } from "@/lib/commission";

/**
 * POST /api/admin/deals/[id]/payment-received
 *
 * Admin confirms Frost Law has paid Fintella for this closed-won deal. This is
 * the critical link in the commission chain — it both stamps the Deal and
 * creates the CommissionLedger entries (status="due") that the payout batch
 * flow picks up.
 *
 * Atomic: stamp Deal + create ledger rows + flip Deal commission status fields
 * + write a system DealNote. All in one Prisma transaction.
 *
 * Idempotent: if the deal is already stamped (paymentReceivedAt set), returns
 * 409 with the existing stamp so admins can't double-trigger.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (!["super_admin", "admin", "accounting"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminEmail = (session.user as any).email || "unknown";
  const adminName = (session.user as any).name || adminEmail;

  try {
    const deal = await prisma.deal.findUnique({ where: { id: params.id } });
    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    if (deal.stage !== "closedwon") {
      return NextResponse.json(
        { error: `Deal must be in closedwon stage (currently: ${deal.stage})` },
        { status: 400 }
      );
    }

    if (deal.paymentReceivedAt) {
      return NextResponse.json(
        {
          error: "Payment already marked received",
          paymentReceivedAt: deal.paymentReceivedAt.toISOString(),
          paymentReceivedBy: deal.paymentReceivedBy,
        },
        { status: 409 }
      );
    }

    if (!deal.firmFeeAmount || deal.firmFeeAmount <= 0) {
      return NextResponse.json(
        { error: "Deal has no firmFeeAmount set — set it before marking payment received" },
        { status: 400 }
      );
    }

    // Walk the partner chain upward from the submitter so we know who earns what.
    const submitter = await prisma.partner.findUnique({
      where: { partnerCode: deal.partnerCode },
    });
    if (!submitter) {
      return NextResponse.json(
        { error: `Submitting partner ${deal.partnerCode} not found` },
        { status: 400 }
      );
    }

    const chain: PartnerChainNode[] = [
      { partnerCode: submitter.partnerCode, tier: submitter.tier, commissionRate: submitter.commissionRate },
    ];

    if (submitter.tier === "l3" && submitter.referredByPartnerCode) {
      const l2 = await prisma.partner.findUnique({
        where: { partnerCode: submitter.referredByPartnerCode },
      });
      if (l2) {
        chain.push({ partnerCode: l2.partnerCode, tier: l2.tier, commissionRate: l2.commissionRate });
        if (l2.referredByPartnerCode) {
          const l1 = await prisma.partner.findUnique({
            where: { partnerCode: l2.referredByPartnerCode },
          });
          if (l1) chain.push({ partnerCode: l1.partnerCode, tier: l1.tier, commissionRate: l1.commissionRate });
        }
      }
    } else if (submitter.tier === "l2" && submitter.referredByPartnerCode) {
      const l1 = await prisma.partner.findUnique({
        where: { partnerCode: submitter.referredByPartnerCode },
      });
      if (l1) chain.push({ partnerCode: l1.partnerCode, tier: l1.tier, commissionRate: l1.commissionRate });
    }

    const waterfall = calcWaterfallCommissions(deal.firmFeeAmount, chain);

    // Build ledger entries to create — only non-zero amounts.
    const ledgerToCreate: Array<{ partnerCode: string; tier: string; amount: number }> = [];
    const l1Node = chain.find((n) => n.tier === "l1");
    const l2Node = chain.find((n) => n.tier === "l2");
    const l3Node = chain.find((n) => n.tier === "l3");
    if (l1Node && waterfall.l1Amount > 0) ledgerToCreate.push({ partnerCode: l1Node.partnerCode, tier: "l1", amount: waterfall.l1Amount });
    if (l2Node && waterfall.l2Amount > 0) ledgerToCreate.push({ partnerCode: l2Node.partnerCode, tier: "l2", amount: waterfall.l2Amount });
    if (l3Node && waterfall.l3Amount > 0) ledgerToCreate.push({ partnerCode: l3Node.partnerCode, tier: "l3", amount: waterfall.l3Amount });

    // Single atomic transaction — Deal stamp + ledger writes + audit note.
    const result = await prisma.$transaction(async (tx) => {
      const updatedDeal = await tx.deal.update({
        where: { id: params.id },
        data: {
          paymentReceivedAt: new Date(),
          paymentReceivedBy: adminEmail,
          l1CommissionStatus: waterfall.l1Amount > 0 ? "due" : deal.l1CommissionStatus,
          l2CommissionStatus: waterfall.l2Amount > 0 ? "due" : deal.l2CommissionStatus,
        },
      });

      const createdLedger = await Promise.all(
        ledgerToCreate.map((entry) =>
          tx.commissionLedger.create({
            data: {
              partnerCode: entry.partnerCode,
              dealId: deal.id,
              dealName: deal.dealName,
              tier: entry.tier,
              amount: entry.amount,
              status: "due",
              periodMonth: new Date().toISOString().slice(0, 7),
            },
          })
        )
      );

      const totalCommission = ledgerToCreate.reduce((s, e) => s + e.amount, 0);
      const noteBody =
        `Payment received from Frost Law confirmed by ${adminName} (${adminEmail}). ` +
        `Firm fee: $${deal.firmFeeAmount.toFixed(2)}. ` +
        `Commissions queued for payout: ${ledgerToCreate.length} entries totaling $${totalCommission.toFixed(2)} ` +
        `(${ledgerToCreate.map((e) => `${e.tier.toUpperCase()} ${e.partnerCode} $${e.amount.toFixed(2)}`).join(", ")}).`;

      await tx.dealNote.create({
        data: {
          dealId: deal.id,
          content: noteBody,
          authorName: adminName,
          authorEmail: adminEmail,
        },
      });

      return { updatedDeal, createdLedger, totalCommission };
    });

    return NextResponse.json({
      success: true,
      deal: result.updatedDeal,
      ledgerCount: result.createdLedger.length,
      totalCommission: result.totalCommission,
      ledger: result.createdLedger,
    });
  } catch (e) {
    console.error("payment-received error:", e);
    return NextResponse.json({ error: "Failed to mark payment received" }, { status: 500 });
  }
}
