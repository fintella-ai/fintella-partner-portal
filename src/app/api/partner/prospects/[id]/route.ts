import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const partnerCode = (session.user as { partnerCode?: string }).partnerCode;
  if (!partnerCode) return NextResponse.json({ error: "Not a partner" }, { status: 403 });

  const prospect = await prisma.partnerProspect.findUnique({ where: { id: params.id } });
  if (!prospect || prospect.partnerCode !== partnerCode)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, any> = {};
  const validStages = ["new", "contacted", "call_booked", "qualified", "submitted", "won", "lost"];

  if (typeof body.companyName === "string") data.companyName = body.companyName.trim();
  if (typeof body.contactName === "string") data.contactName = body.contactName.trim();
  if (typeof body.contactEmail === "string") data.contactEmail = body.contactEmail.trim() || null;
  if (typeof body.contactPhone === "string") data.contactPhone = body.contactPhone.trim() || null;
  if (typeof body.industry === "string") data.industry = body.industry.trim() || null;
  if (typeof body.importVolume === "string") data.importVolume = body.importVolume;
  if (typeof body.productTypes === "string") data.productTypes = body.productTypes.trim() || null;
  if (typeof body.annualDuties === "string") data.annualDuties = body.annualDuties.trim() || null;
  if (typeof body.stage === "string" && validStages.includes(body.stage)) {
    data.stage = body.stage;
    if (body.stage === "call_booked") data.callBookedAt = new Date();
    if (body.stage === "submitted") data.submittedAt = new Date();
  }
  if (typeof body.score === "number") data.score = Math.min(100, Math.max(0, body.score));
  if (typeof body.notes === "string") data.notes = body.notes.trim() || null;
  if (typeof body.lostReason === "string") data.lostReason = body.lostReason.trim() || null;
  if (typeof body.dealId === "string") data.dealId = body.dealId;
  if (body.nextFollowUpAt !== undefined) data.nextFollowUpAt = body.nextFollowUpAt ? new Date(body.nextFollowUpAt) : null;

  const updated = await prisma.partnerProspect.update({ where: { id: params.id }, data });
  return NextResponse.json({ prospect: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const partnerCode = (session.user as { partnerCode?: string }).partnerCode;
  if (!partnerCode) return NextResponse.json({ error: "Not a partner" }, { status: 403 });

  const prospect = await prisma.partnerProspect.findUnique({ where: { id: params.id } });
  if (!prospect || prospect.partnerCode !== partnerCode)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.partnerProspect.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
