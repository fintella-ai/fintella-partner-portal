import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/recover
 * Public endpoint — client-facing refund calculator form submission.
 * Creates a Deal (direct client for tariff refund service) in the admin
 * deals pipeline, NOT a PartnerLead (which is for partner recruitment).
 * If partnerCode is provided (via ?ref= or utm_content), the deal is
 * attributed to that partner for commission tracking.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      companyName, contactName, email, phone, importProducts,
      estimatedDuties, estimatedRefund, partnerCode, entryPeriod,
      htsCategory, title, city, state, importsGoods, importCountries,
      annualImportValue, importerOfRecord, businessEntityType,
      affiliateNotes, ein,
    } = body;

    if (!companyName?.trim() || !contactName?.trim() || !email?.trim()) {
      return NextResponse.json({ error: "Company name, contact name, and email are required" }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }

    const names = contactName.trim().split(/\s+/);
    const firstName = names[0] || contactName.trim();
    const lastName = names.slice(1).join(" ") || "";

    // Snapshot the L1 commission rate if a partner referred this client
    let l1RateSnapshot: number | null = null;
    if (partnerCode) {
      const partner = await prisma.partner.findUnique({
        where: { partnerCode },
        select: { commissionRate: true },
      });
      l1RateSnapshot = partner?.commissionRate ?? null;
    }

    // Create a Deal — this is a direct client, not a partner lead
    const deal = await prisma.deal.create({
      data: {
        dealName: `${firstName} ${lastName} — ${companyName}`.trim(),
        partnerCode: partnerCode || "UNATTRIBUTED",
        stage: "lead_submitted",
        serviceOfInterest: "Tariff Refund Support",
        clientFirstName: firstName,
        clientLastName: lastName,
        clientName: `${firstName} ${lastName}`.trim(),
        clientEmail: email.trim().toLowerCase(),
        clientPhone: phone?.trim() || null,
        clientTitle: title?.trim() || null,
        legalEntityName: companyName.trim(),
        businessCity: city?.trim() || null,
        businessState: state?.trim() || null,
        importsGoods: importsGoods || importProducts || null,
        importCountries: importCountries || null,
        annualImportValue: annualImportValue || (estimatedDuties ? `$${Number(estimatedDuties).toLocaleString()}` : null),
        importerOfRecord: importerOfRecord || null,
        affiliateNotes: affiliateNotes || null,
        l1CommissionRate: l1RateSnapshot,
        estimatedRefundAmount: estimatedRefund ? Number(estimatedRefund) : 0,
        notes: [
          `Source: /recover landing page`,
          importProducts ? `Import category: ${importProducts}` : null,
          htsCategory ? `HTS: ${htsCategory}` : null,
          entryPeriod ? `Entry period: ${entryPeriod}` : null,
          estimatedDuties ? `Est. duties: $${Number(estimatedDuties).toLocaleString()}` : null,
          businessEntityType ? `Entity type: ${businessEntityType}` : null,
          ein ? `EIN: ${ein}` : null,
          partnerCode ? `Referred by: ${partnerCode}` : "Direct (no partner referral)",
        ].filter(Boolean).join(" | "),
      },
    });

    // Notify admins
    const admins = await prisma.user.findMany({
      where: { role: { in: ["super_admin", "admin"] } },
      select: { email: true },
    });
    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          recipientType: "admin",
          recipientId: admin.email,
          type: "new_deal",
          title: "New Client from Landing Page",
          message: `${firstName} ${lastName} (${companyName}) submitted via /recover. ${partnerCode ? `Referred by ${partnerCode}.` : "Direct lead."}`,
          link: `/admin/deals?deal=${deal.id}`,
        },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, dealId: deal.id }, { status: 201 });
  } catch (err) {
    console.error("[api/recover] error:", err);
    return NextResponse.json({ error: "Failed to submit. Please try again." }, { status: 500 });
  }
}
