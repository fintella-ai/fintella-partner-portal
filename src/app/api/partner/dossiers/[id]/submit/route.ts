import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/* ── POST — convert dossier to Deal referral ──────────────────────────────── */

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const partnerCode = (session.user as { partnerCode?: string }).partnerCode;
  if (!partnerCode) return NextResponse.json({ error: "Not a partner" }, { status: 403 });

  // Verify dossier ownership and status
  const dossier = await prisma.tariffDossier.findFirst({
    where: { id: params.id, partner: { partnerCode } },
  });
  if (!dossier) {
    return NextResponse.json({ error: "Dossier not found" }, { status: 404 });
  }

  if (dossier.status !== "ready" && dossier.status !== "draft") {
    return NextResponse.json(
      { error: `Cannot submit dossier with status "${dossier.status}"` },
      { status: 400 },
    );
  }

  if (dossier.dealId) {
    return NextResponse.json(
      { error: "Dossier already submitted as a deal" },
      { status: 409 },
    );
  }

  // Create deal from dossier
  const deal = await prisma.deal.create({
    data: {
      dealName: dossier.clientCompany,
      partnerCode,
      stage: "lead_submitted",
      estimatedRefundAmount: dossier.totalEstRefund ? Number(dossier.totalEstRefund) : 0,
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

  return NextResponse.json({ deal, dossier: updatedDossier }, { status: 201 });
}
