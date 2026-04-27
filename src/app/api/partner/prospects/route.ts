import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const partnerCode = (session.user as { partnerCode?: string }).partnerCode;
  if (!partnerCode) return NextResponse.json({ error: "Not a partner" }, { status: 403 });

  const prospects = await prisma.partnerProspect.findMany({
    where: { partnerCode },
    orderBy: { updatedAt: "desc" },
  });

  const stats = {
    total: prospects.length,
    new: prospects.filter((p) => p.stage === "new").length,
    contacted: prospects.filter((p) => p.stage === "contacted").length,
    callBooked: prospects.filter((p) => p.stage === "call_booked").length,
    qualified: prospects.filter((p) => p.stage === "qualified").length,
    submitted: prospects.filter((p) => p.stage === "submitted").length,
    won: prospects.filter((p) => p.stage === "won").length,
    lost: prospects.filter((p) => p.stage === "lost").length,
  };

  return NextResponse.json({ prospects, stats });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const partnerCode = (session.user as { partnerCode?: string }).partnerCode;
  if (!partnerCode) return NextResponse.json({ error: "Not a partner" }, { status: 403 });

  const body = await req.json();
  if (!body.companyName?.trim() || !body.contactName?.trim())
    return NextResponse.json({ error: "Company name and contact name required" }, { status: 400 });

  const validSources = ["referral", "linkedin", "cold_outreach", "ai_screener", "website", "event", "other"];

  const prospect = await prisma.partnerProspect.create({
    data: {
      partnerCode,
      companyName: body.companyName.trim(),
      contactName: body.contactName.trim(),
      contactEmail: body.contactEmail?.trim() || null,
      contactPhone: body.contactPhone?.trim() || null,
      industry: body.industry?.trim() || null,
      importVolume: body.importVolume || null,
      productTypes: body.productTypes?.trim() || null,
      annualDuties: body.annualDuties?.trim() || null,
      source: validSources.includes(body.source) ? body.source : null,
      notes: body.notes?.trim() || null,
      nextFollowUpAt: body.nextFollowUpAt ? new Date(body.nextFollowUpAt) : null,
    },
  });

  return NextResponse.json({ prospect }, { status: 201 });
}
