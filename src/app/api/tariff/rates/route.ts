import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/tariff/rates
 *
 * Public endpoint — no auth required.
 * Returns all countries with their IEEPA rate periods, grouped by country.
 */
export async function GET() {
  try {
    const rates = await prisma.ieepaRate.findMany({
      select: {
        countryCode: true,
        countryName: true,
        rateType: true,
        rate: true,
        effectiveDate: true,
        endDate: true,
        executiveOrder: true,
        name: true,
      },
      orderBy: [{ countryName: "asc" }, { effectiveDate: "asc" }],
    });

    // Group by countryCode
    const countries = new Map<
      string,
      {
        code: string;
        name: string;
        periods: Array<{
          rateType: string;
          rate: unknown;
          effectiveDate: Date;
          endDate: Date | null;
          executiveOrder: string;
          name: string;
        }>;
      }
    >();

    for (const r of rates) {
      if (!countries.has(r.countryCode)) {
        countries.set(r.countryCode, {
          code: r.countryCode,
          name: r.countryName,
          periods: [],
        });
      }
      countries.get(r.countryCode)!.periods.push({
        rateType: r.rateType,
        rate: r.rate,
        effectiveDate: r.effectiveDate,
        endDate: r.endDate,
        executiveOrder: r.executiveOrder,
        name: r.name,
      });
    }

    return NextResponse.json({
      countries: Array.from(countries.values()),
      totalCountries: countries.size,
      totalRates: rates.length,
    });
  } catch (err) {
    console.error("[tariff/rates] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
