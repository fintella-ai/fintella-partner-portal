import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/deals
 * Returns the current partner's direct deals, downline partners, and downline deals.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const partnerCode = (session.user as any).partnerCode;
  if (!partnerCode) return NextResponse.json({ error: "Not a partner" }, { status: 403 });

  try {
    // Direct deals
    const directDeals = await prisma.deal.findMany({
      where: { partnerCode },
      orderBy: { createdAt: "desc" },
    });

    // Downline partners
    const downlinePartners = await prisma.partner.findMany({
      where: { referredByPartnerCode: partnerCode },
      orderBy: { createdAt: "desc" },
    });

    // Downline deals (deals from partners this user recruited)
    const downlineCodes = downlinePartners.map((p) => p.partnerCode);
    const downlineDeals = downlineCodes.length > 0
      ? await prisma.deal.findMany({
          where: { partnerCode: { in: downlineCodes } },
          orderBy: { createdAt: "desc" },
        })
      : [];

    // Attach partner name to each downline deal
    const partnerMap: Record<string, string> = {};
    for (const p of downlinePartners) {
      partnerMap[p.partnerCode] = `${p.firstName} ${p.lastName}`;
    }
    const downlineDealsWithNames = downlineDeals.map((d) => ({
      ...d,
      submittingPartnerName: partnerMap[d.partnerCode] || d.partnerCode,
    }));

    return NextResponse.json({
      directDeals,
      downlinePartners,
      downlineDeals: downlineDealsWithNames,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch deals" }, { status: 500 });
  }
}

/**
 * POST /api/deals
 * Partner submits a new lead/deal.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const partnerCode = (session.user as any).partnerCode;
  if (!partnerCode) return NextResponse.json({ error: "Not a partner" }, { status: 403 });

  try {
    const body = await req.json();

    const deal = await prisma.deal.create({
      data: {
        dealName: body.businessName || body.dealName,
        partnerCode,
        clientName: body.businessName || body.clientName || null,
        clientEmail: body.email || body.clientEmail || null,
        clientPhone: body.phone || body.clientPhone || null,
        stage: "new_lead",
        productType: body.productType || null,
        importedProducts: body.importedProducts || null,
        estimatedRefundAmount: body.estimatedAnnualImportValue ? parseFloat(body.estimatedAnnualImportValue) : 0,
        notes: body.notes || null,
      },
    });

    return NextResponse.json({ deal }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to submit lead" }, { status: 500 });
  }
}
