import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chargeOneTime } from "@/lib/nmi-gateway";
import { sendEmail } from "@/lib/sendgrid";
import {
  TARIFF_DIY_SERVICE,
  TARIFF_UPFRONT_FEE_CENTS,
  type TariffEngagementState,
} from "@/lib/tariff-engagement";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fintella.partners";

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
    const isPerFile = sf.pricingModel === "per_file_volume";
    const scope: "sample" | "full" = body?.scope === "sample" ? "sample" : "full";

    // Idempotency
    if (sf.fullStatus === "paid" || (!isPerFile && sf.upfrontStatus === "paid")) {
      return NextResponse.json({ success: true, alreadyPaid: true, dealId, fullUnlocked: true });
    }
    if (isPerFile && scope === "sample" && sf.sampleStatus === "paid") {
      return NextResponse.json({ success: true, alreadyPaid: true, dealId, sampleUnlocked: true });
    }

    // Determine the server-authoritative amount for this scope.
    let amountCents: number;
    let desc: string;
    if (isPerFile) {
      if (scope === "sample") {
        amountCents = Number(sf.sampleCents) || 0;
        desc = "per-file sample (1 file)";
      } else {
        amountCents = sf.sampleStatus === "paid" ? Number(sf.remainderCents) || 0 : Number(sf.fullCents) || 0;
        desc = sf.sampleStatus === "paid" ? "per-file remainder (unlock all)" : "per-file (all files)";
      }
    } else {
      amountCents = typeof sf.upfrontFeeCents === "number" && sf.upfrontFeeCents > 0 ? sf.upfrontFeeCents : TARIFF_UPFRONT_FEE_CENTS;
      desc = "DIY dossier fee";
    }

    const nextState: Partial<TariffEngagementState> = { paidAt: new Date().toISOString() };

    // $0 (e.g. single-file remainder already covered by the sample) — no charge.
    if (amountCents > 0) {
      const [firstName, ...rest] = (deal.clientName || "Client").split(" ");
      const lastName = rest.join(" ");
      const result = await chargeOneTime(paymentToken, amountCents, {
        email: deal.clientEmail || undefined,
        firstName,
        lastName,
        orderId: `${deal.id}-${scope}`,
        orderDescription: `IEEPA Tariff Refund — ${desc}`,
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
          description: `Tariff DIY — ${desc} — deal ${deal.id}`,
        },
      });
      if (!succeeded) {
        return NextResponse.json({ error: result.responsetext || "Payment declined" }, { status: 402 });
      }
      nextState.upfrontTxnId = result.transactionid;
    }

    // Apply unlock state
    if (isPerFile && scope === "sample") {
      nextState.sampleStatus = "paid";
    } else {
      nextState.fullStatus = "paid";
      nextState.upfrontStatus = "paid";
      if (isPerFile) nextState.sampleStatus = "paid";
    }

    await prisma.deal.update({
      where: { id: deal.id },
      data: {
        stage: deal.stage === "lead_submitted" ? "client_engaged" : deal.stage,
        serviceFields: { ...sf, ...nextState },
      },
    });

    const fullyPaid = nextState.fullStatus === "paid" || nextState.upfrontStatus === "paid";

    // Fire-and-forget: email the kit links only once the FULL set is unlocked.
    if (fullyPaid && deal.clientEmail) {
      const base = `${APP_URL}/api/tariff/engage/${deal.id}/kit`;
      sendEmail({
        to: deal.clientEmail,
        toName: deal.clientName || undefined,
        subject: "Your IEEPA Tariff Refund self-file kit is ready",
        template: "tariff_diy_kit",
        partnerCode: deal.partnerCode || null,
        text:
          `Thank you — your payment is confirmed and your substantiated CAPE self-file kit is ready.\n\n` +
          `Recovery analysis (PDF): ${base}?format=pdf\n` +
          `CAPE declaration (CSV): ${base}?format=csv\n` +
          `Step-by-step self-file guide: ${base}?format=guide\n\n` +
          `Fintella is not a law firm and does not provide legal advice. This kit is informational and prepared for your self-filing.`,
        html:
          `<p>Thank you — your payment is confirmed and your substantiated <strong>CAPE self-file kit</strong> is ready.</p>` +
          `<p>` +
          `<a href="${base}?format=pdf">⬇ Recovery analysis (PDF)</a><br>` +
          `<a href="${base}?format=csv">⬇ CAPE declaration (CSV)</a><br>` +
          `<a href="${base}?format=guide">⬇ Step-by-step self-file guide</a>` +
          `</p>` +
          `<p style="font-size:12px;color:#888">Fintella is not a law firm and does not provide legal advice. This kit is informational and prepared for your self-filing.</p>`,
      }).catch((e) => console.error("[tariff-pay] kit email failed:", e));
    }

    return NextResponse.json({
      success: true,
      dealId: deal.id,
      transactionId: nextState.upfrontTxnId || null,
      amountCents,
      scope,
      sampleUnlocked: nextState.sampleStatus === "paid",
      fullUnlocked: fullyPaid,
    });
  } catch (err: any) {
    console.error("[tariff-pay] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
