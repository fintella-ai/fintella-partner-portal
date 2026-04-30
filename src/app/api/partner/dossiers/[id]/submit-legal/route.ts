import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/sendgrid";

export const dynamic = "force-dynamic";

/**
 * POST /api/partner/dossiers/[id]/submit-legal
 *
 * Partner-authenticated endpoint. Converts a dossier to a Deal referral
 * and fires an admin notification email.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const partnerCode = (session.user as { partnerCode?: string }).partnerCode;
  if (!partnerCode) {
    return NextResponse.json({ error: "Not a partner" }, { status: 403 });
  }

  // Verify dossier ownership and status
  const dossier = await prisma.tariffDossier.findFirst({
    where: { id: params.id, partner: { partnerCode } },
    include: {
      partner: { select: { firstName: true, lastName: true, email: true, partnerCode: true } },
    },
  });

  if (!dossier) {
    return NextResponse.json({ error: "Dossier not found" }, { status: 404 });
  }

  if (dossier.dealId) {
    return NextResponse.json(
      { error: "Dossier already submitted as a deal" },
      { status: 409 },
    );
  }

  if (dossier.status !== "ready" && dossier.status !== "draft") {
    return NextResponse.json(
      { error: `Cannot submit dossier with status "${dossier.status}"` },
      { status: 400 },
    );
  }

  // Create deal from dossier
  const deal = await prisma.deal.create({
    data: {
      dealName: dossier.clientCompany,
      partnerCode,
      stage: "lead_submitted",
      estimatedRefundAmount: dossier.totalEstRefund
        ? Number(dossier.totalEstRefund)
        : 0,
      clientEmail: dossier.clientEmail || null,
      clientName: dossier.clientContact || null,
    },
  });

  // Update dossier with deal link
  const updatedDossier = await prisma.tariffDossier.update({
    where: { id: params.id },
    data: {
      dealId: deal.id,
      status: "submitted",
      convertedAt: new Date(),
    },
  });

  // Fire-and-forget admin notification email
  const partnerName = dossier.partner
    ? `${dossier.partner.firstName} ${dossier.partner.lastName}`
    : partnerCode;
  const estRefund = dossier.totalEstRefund
    ? `$${Number(dossier.totalEstRefund).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "N/A";

  sendEmail({
    to: process.env.ADMIN_EMAIL || "admin@fintella.partners",
    subject: `[Legal Review] New dossier submitted: ${dossier.clientCompany}`,
    template: "dossier_legal_submission",
    partnerCode,
    text: [
      `Partner ${partnerName} (${partnerCode}) has submitted a dossier for legal review.`,
      "",
      `Client: ${dossier.clientCompany}`,
      `Contact: ${dossier.clientContact || "N/A"}`,
      `Email: ${dossier.clientEmail || "N/A"}`,
      `Entries: ${dossier.entryCount}`,
      `Eligible: ${dossier.eligibleCount}`,
      `Estimated Refund: ${estRefund}`,
      "",
      `Deal ID: ${deal.id}`,
      `Dossier ID: ${dossier.id}`,
      "",
      "Review at: https://fintella.partners/admin/deals",
    ].join("\n"),
    html: [
      `<p>Partner <strong>${partnerName}</strong> (${partnerCode}) has submitted a dossier for legal review.</p>`,
      "<table style='border-collapse:collapse;'>",
      `<tr><td style='padding:4px 12px 4px 0;font-weight:bold;'>Client</td><td>${dossier.clientCompany}</td></tr>`,
      `<tr><td style='padding:4px 12px 4px 0;font-weight:bold;'>Contact</td><td>${dossier.clientContact || "N/A"}</td></tr>`,
      `<tr><td style='padding:4px 12px 4px 0;font-weight:bold;'>Email</td><td>${dossier.clientEmail || "N/A"}</td></tr>`,
      `<tr><td style='padding:4px 12px 4px 0;font-weight:bold;'>Entries</td><td>${dossier.entryCount}</td></tr>`,
      `<tr><td style='padding:4px 12px 4px 0;font-weight:bold;'>Eligible</td><td>${dossier.eligibleCount}</td></tr>`,
      `<tr><td style='padding:4px 12px 4px 0;font-weight:bold;'>Est. Refund</td><td>${estRefund}</td></tr>`,
      "</table>",
      `<p><a href="https://fintella.partners/admin/deals">Review in Admin</a></p>`,
    ].join("\n"),
  }).catch((err) => {
    console.error("[submit-legal] Admin notification email failed:", err);
  });

  return NextResponse.json({ deal, dossier: updatedDossier }, { status: 201 });
}
