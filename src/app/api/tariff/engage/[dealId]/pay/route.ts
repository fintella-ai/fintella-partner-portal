import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chargeOneTime } from "@/lib/nmi-gateway";
import {
  TARIFF_DIY_SERVICE,
  TARIFF_UPFRONT_FEE_CENTS,
  type TariffEngagementState,
} from "@/lib/tariff-engagement";

export const dynamic = "force-dynamic";

/**
 * POST /api/tariff/engage/[dealId]/pay
 *
 * Charges the upfront DIY dossier fee against a Collect.js payment token.
 * The amount is SERVER-AUTHORITATIVE (taken from the deal's stored fee), never
 * from the client. On success the deal is marked paid (unlocking the self-file
 * kit) and a PaymentLog row is written. Idempotent — re-paying a paid deal is a
 * no-op success.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { dealId: string } },
) {
  try {
    const { dealId } = params;
    const body = await req.json().catch(() => ({}));
    const paymentToken = body?.paymentToken;

    if (!paymentToken || typeof paymentToken !== "string") {
      return NextResponse.json({ error: "Missing payment token" }, { status: 400 });
    }

    const deal = await prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal || deal.serviceOfInterest !== TARIFF_DIY_SERVICE) {
      return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
    }

    const sf = (deal.serviceFields as any) || {};

    // Idempotency — already paid
    if (sf.upfrontStatus === "paid") {
      return NextResponse.json({ success: true, alreadyPaid: true, dealId });
    }

    const amountCents: number =
      typeof sf.upfrontFeeCents === "number" && sf.upfrontFeeCents > 0
        ? sf.upfrontFeeCents
        : TARIFF_UPFRONT_FEE_CENTS;

    const [firstName, ...rest] = (deal.clientName || "Client").split(" ");
    const lastName = rest.join(" ");

    const result = await chargeOneTime(paymentToken, amountCents, {
      email: deal.clientEmail || undefined,
      firstName,
      lastName,
      orderId: deal.id,
      orderDescription: "IEEPA Tariff Refund — DIY dossier fee",
    });

    const succeeded = result.response === "1";

    await prisma.paymentLog.create({
      data: {
        partnerCode: deal.partnerCode || "DIRECT",
        amount: amountCents,
        currency: "usd",
        status: succeeded ? "success" : "failed",
        gatewayTxnId: result.transactionid || null,
        gatewayResponse: result.responsetext || null,
        description: `Tariff DIY upfront fee — deal ${deal.id}`,
      },
    });

    if (!succeeded) {
      return NextResponse.json(
        { error: result.responsetext || "Payment declined" },
        { status: 402 },
      );
    }

    const nextState: Partial<TariffEngagementState> = {
      upfrontStatus: "paid",
      upfrontTxnId: result.transactionid,
      paidAt: new Date().toISOString(),
    };

    await prisma.deal.update({
      where: { id: deal.id },
      data: {
        stage: deal.stage === "lead_submitted" ? "client_engaged" : deal.stage,
        serviceFields: { ...sf, ...nextState },
      },
    });

    return NextResponse.json({
      success: true,
      dealId: deal.id,
      transactionId: result.transactionid,
      amountCents,
    });
  } catch (err: any) {
    console.error("[tariff-pay] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
