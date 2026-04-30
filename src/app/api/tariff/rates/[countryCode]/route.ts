import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/tariff/rates/[countryCode]
 *
 * Public endpoint — no auth required.
 * Returns the IEEPA rate timeline for a single country.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { countryCode: string } },
) {
  try {
    const code = params.countryCode.toUpperCase();

    const rates = await prisma.ieepaRate.findMany({
      where: { countryCode: code },
      orderBy: { effectiveDate: "asc" },
    });

    if (rates.length === 0) {
      return NextResponse.json(
        { error: `No IEEPA rates found for: ${code}` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      countryCode: code,
      countryName: rates[0].countryName,
      timeline: rates,
    });
  } catch (err) {
    console.error("[tariff/rates/countryCode] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
