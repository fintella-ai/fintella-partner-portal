import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/tariff/rates
 * List all IEEPA rates. Optional ?countryCode= and ?rateType= filters.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!["super_admin", "admin", "accounting", "partner_support"].includes(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const where: any = {};
    const countryCode = req.nextUrl.searchParams.get("countryCode");
    if (countryCode) where.countryCode = countryCode;
    const rateType = req.nextUrl.searchParams.get("rateType");
    if (rateType) where.rateType = rateType;

    const rates = await prisma.ieepaRate.findMany({
      where,
      orderBy: [{ countryName: "asc" }, { effectiveDate: "desc" }],
    });

    return NextResponse.json({ rates });
  } catch (err) {
    console.error("[admin/tariff/rates] Error:", err);
    return NextResponse.json({ error: "Failed to fetch rates" }, { status: 500 });
  }
}

/**
 * POST /api/admin/tariff/rates
 * Add a new custom IEEPA rate (isSeeded: false).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!["super_admin", "admin"].includes(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();

    const required = [
      "executiveOrder",
      "name",
      "rateType",
      "countryCode",
      "countryName",
      "rate",
      "effectiveDate",
    ];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 },
        );
      }
    }

    const rate = await prisma.ieepaRate.create({
      data: {
        executiveOrder: body.executiveOrder,
        name: body.name,
        rateType: body.rateType,
        countryCode: body.countryCode,
        countryName: body.countryName,
        rate: body.rate,
        effectiveDate: new Date(body.effectiveDate),
        endDate: body.endDate ? new Date(body.endDate) : null,
        htsChapter99: body.htsChapter99 || null,
        appliesTo: body.appliesTo || "all",
        notes: body.notes || null,
        isSeeded: false,
      },
    });

    return NextResponse.json(rate, { status: 201 });
  } catch (err) {
    console.error("[admin/tariff/rates POST] Error:", err);
    return NextResponse.json({ error: "Failed to create rate" }, { status: 500 });
  }
}
