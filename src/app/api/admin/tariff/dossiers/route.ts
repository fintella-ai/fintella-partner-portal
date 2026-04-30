import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/tariff/dossiers
 * List all tariff dossiers with partner info. Optional ?status= filter.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!["super_admin", "admin", "accounting", "partner_support"].includes(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const where: any = {};
    const status = req.nextUrl.searchParams.get("status");
    if (status) where.status = status;

    const dossiers = await prisma.tariffDossier.findMany({
      where,
      include: {
        partner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            partnerCode: true,
          },
        },
        _count: { select: { entries: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = dossiers.map((d) => ({
      ...d,
      partnerName: d.partner
        ? `${d.partner.firstName} ${d.partner.lastName}`
        : null,
      entryCount: d._count.entries,
    }));

    return NextResponse.json({ dossiers: result });
  } catch (err) {
    console.error("[admin/tariff/dossiers] Error:", err);
    return NextResponse.json({ error: "Failed to fetch dossiers" }, { status: 500 });
  }
}
