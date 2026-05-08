import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_ROLES = ["super_admin", "admin", "accounting", "partner_support"];

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes((session.user as any).role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const submission = await prisma.clientSubmission.findUnique({ where: { id: params.id } });
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let deal = null;
  if (submission.dealId) {
    deal = await prisma.deal.findUnique({
      where: { id: submission.dealId },
      select: {
        id: true, dealName: true, stage: true, estimatedRefundAmount: true,
        firmFeeAmount: true, l1CommissionAmount: true, l1CommissionStatus: true,
        notes: true, createdAt: true, partnerCode: true,
      },
    });
  }

  return NextResponse.json({ submission, deal });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes((session.user as any).role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.clientSubmission.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  const allowedFields: Record<string, true> = {
    firstName: true, lastName: true, email: true, phone: true, title: true,
    companyName: true, city: true, state: true, ein: true, businessEntityType: true,
    importsGoods: true, importCountries: true, annualImportValue: true,
    importerOfRecord: true, isImporterOfRecord: true, affiliateNotes: true,
    serviceOfInterest: true, importCategory: true, estimatedDuties: true,
    estimatedRefund: true, entryPeriod: true, partnerCode: true,
    dealId: true, dealStage: true, source: true, qualified: true, disqualifyReason: true,
  };

  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (allowedFields[key]) data[key] = value;
  }

  const updated = await prisma.clientSubmission.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json({ submission: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "super_admin" && role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.clientSubmission.delete({ where: { id: params.id } }).catch(() => {});
  return NextResponse.json({ success: true });
}
