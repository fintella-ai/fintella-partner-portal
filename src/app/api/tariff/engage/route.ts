import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendForSigning } from "@/lib/signwell";
import { classifyDealTier } from "@/lib/tariff-calculator";
import { deriveTariffTags } from "@/lib/tariff-deal-tags";
import {
  TARIFF_DIY_SERVICE,
  TARIFF_CONSENT_TEMPLATE_ID,
  TARIFF_SIGNWELL_APP_ID,
  TARIFF_SIGNER_ROLE,
  TARIFF_COSIGNER_ROLE,
  TARIFF_SIGNER_NAME_FIELD,
  computeEngagementPricing,
  requiresUnderwriting,
  type TariffPricingModel,
  type TariffAddOn,
  type TariffEngagementState,
} from "@/lib/tariff-engagement";

export const dynamic = "force-dynamic";

/**
 * POST /api/tariff/engage
 *
 * Public. Starts the DIY self-file engagement for a small-deal (Tier-1) IEEPA
 * refund client: creates a Deal, sends the consent / data-sharing + release for
 * e-signature (SignWell), and returns the signing URL. The upfront fee is
 * collected separately at /api/tariff/engage/[dealId]/pay after consent.
 *
 * Engagement state lives in Deal.serviceFields (no schema migration), mirroring
 * the Kwong intake pattern.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      clientName,
      email,
      company,
      phone,
      ref,
      dossierId,
      estimatedRefund,
    } = body || {};

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    const signerName = (clientName || company || "Client").toString().trim();

    // Dedup: same email engaged for the DIY tariff service in the last 5 minutes
    const recentDeal = await prisma.deal.findFirst({
      where: {
        clientEmail: email,
        serviceOfInterest: TARIFF_DIY_SERVICE,
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (recentDeal) {
      const sf = (recentDeal.serviceFields as any) || {};
      return NextResponse.json({
        success: true,
        dealId: recentDeal.id,
        signingUrl: sf.signwellSigningUrl || "",
        documentId: sf.signwellDocumentId || "",
        upfrontFeeCents: sf.upfrontFeeCents ?? 0,
        deduplicated: true,
      });
    }

    // Referring partner attribution
    let partnerCode = "DIRECT";
    if (ref && typeof ref === "string") {
      const partner = await prisma.partner.findFirst({
        where: { partnerCode: { equals: ref, mode: "insensitive" } },
      });
      partnerCode = partner?.partnerCode || ref || "DIRECT";
    }

    // Pricing model + add-ons
    const VALID_MODELS: TariffPricingModel[] = [
      "upfront", "widget_onetime", "widget_per_submission", "per_file_volume", "refund_percent", "dual", "buyout",
    ];
    const requested = (body?.pricingModel as TariffPricingModel) || "upfront";
    const pricingModel: TariffPricingModel = VALID_MODELS.includes(requested) ? requested : "upfront";
    const VALID_ADDONS: TariffAddOn[] = ["legal_review", "litigation_guarantee"];
    const addOns: TariffAddOn[] = Array.isArray(body?.addOns)
      ? body.addOns.filter((a: any) => VALID_ADDONS.includes(a))
      : [];
    const isWidget = pricingModel === "widget_onetime" || pricingModel === "widget_per_submission";

    // Pull file count + estimated refund from the linked dossier for volume / % pricing
    let fileCount = 1;
    let refundCents = 0;
    let totalDuties = 0;
    if (dossierId) {
      const d = await prisma.tariffDossier.findUnique({ where: { id: dossierId } }).catch(() => null);
      if (d) {
        fileCount = Math.max(1, d.entryCount || 1);
        totalDuties = Number(d.totalEstRefund || 0);
        refundCents = Math.round(totalDuties * 100) + Math.round(Number(d.totalEstInterest || 0) * 100);
      }
    }
    const isTier1 = classifyDealTier(totalDuties) === "tier1";

    const pricing = computeEngagementPricing(pricingModel, { fileCount, refundCents, addOns });

    const underwriting = requiresUnderwriting(pricingModel);

    const engagement: TariffEngagementState = {
      pathway: isWidget ? "widget" : "diy",
      pricingModel,
      consentTemplateId: TARIFF_CONSENT_TEMPLATE_ID,
      upfrontFeeCents: pricing.upfrontCents,
      backendBps: pricing.backendBps,
      addOns,
      platform: body?.platform || null,
      upfrontStatus: "unpaid",
      underwritingStatus: underwriting ? "pending" : undefined,
      dossierId: dossierId || null,
    };

    const deal = await prisma.deal.create({
      data: {
        dealName: `${signerName} — IEEPA Tariff Refund (DIY)`,
        clientName: signerName,
        clientEmail: email,
        clientPhone: phone || null,
        partnerCode,
        serviceOfInterest: TARIFF_DIY_SERVICE,
        legalEntityName: company || null,
        estimatedRefundAmount:
          typeof estimatedRefund === "number" && estimatedRefund > 0
            ? estimatedRefund
            : undefined,
        stage: "lead_submitted",
        tags: deriveTariffTags(totalDuties, isTier1),
        serviceFields: { ...engagement },
      },
    });

    // Link the dossier to this deal if one was provided
    if (dossierId) {
      await prisma.tariffDossier
        .update({ where: { id: dossierId }, data: { dealId: deal.id } })
        .catch(() => {});
    }

    // Resolve Fintella cosigner (required — SignWell 422s on template sends
    // without the second placeholder). Mirrors the Kwong intake flow.
    let cosignerEmail = "admin@fintella.partners";
    let cosignerName = "Fintella";
    try {
      const settings = await prisma.portalSettings.findFirst();
      if (settings) {
        cosignerEmail = (settings as any).fintellaSigner || cosignerEmail;
        cosignerName = (settings as any).fintellaSignerName || cosignerName;
      }
    } catch {}

    const swResult = await sendForSigning({
      name: `IEEPA Tariff Refund — Consent & Authorization — ${signerName}`,
      subject: "Fintella Tariff Refund — Consent & Data-Sharing Agreement",
      message:
        "Please review and sign to authorize Fintella to prepare your substantiated IEEPA tariff-refund file.",
      recipients: [
        { id: "1", email, name: signerName, role: TARIFF_SIGNER_ROLE },
        { id: "2", email: cosignerEmail, name: cosignerName, role: TARIFF_COSIGNER_ROLE },
      ],
      templateId: TARIFF_CONSENT_TEMPLATE_ID,
      templateFields: [{ api_id: TARIFF_SIGNER_NAME_FIELD, value: signerName }],
      apiApplicationId: TARIFF_SIGNWELL_APP_ID,
      metadata: { dealId: deal.id, service: "ieepa-tariff-refund-diy" },
    });

    const nextState: TariffEngagementState = {
      ...engagement,
      signwellDocumentId: swResult.documentId,
      signwellSigningUrl: swResult.embeddedSigningUrl || null,
      signwellStatus: "pending",
    };

    await prisma.deal.update({
      where: { id: deal.id },
      data: { serviceFields: { ...(deal.serviceFields as any), ...nextState } },
    });

    return NextResponse.json({
      success: true,
      dealId: deal.id,
      signingUrl: swResult.embeddedSigningUrl || "",
      documentId: swResult.documentId,
      upfrontFeeCents: pricing.upfrontCents,
      backendBps: pricing.backendBps,
      lineItems: pricing.lineItems,
      underwritingRequired: underwriting,
    });
  } catch (err: any) {
    console.error("[tariff-engage] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
