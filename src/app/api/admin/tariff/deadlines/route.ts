import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/tariff/deadlines
 * Urgent entries: deadlineDays <= 30, eligibility = eligible.
 * Sorted by deadlineDays ascending. Limit 100.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!["super_admin", "admin", "accounting", "partner_support"].includes(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const entries = await prisma.tariffEntry.findMany({
      where: {
        deadlineDays: { not: null, lte: 30 },
        eligibility: "eligible",
      },
      include: {
        dossier: {
          select: {
            id: true,
            clientCompany: true,
            partner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                partnerCode: true,
              },
            },
          },
        },
      },
      orderBy: { deadlineDays: "asc" },
      take: 100,
    });

    const result = entries.map((e) => ({
      id: e.id,
      dossierId: e.dossierId,
      clientCompany: e.dossier.clientCompany,
      partnerName: e.dossier.partner
        ? `${e.dossier.partner.firstName} ${e.dossier.partner.lastName}`
        : null,
      partnerCode: e.dossier.partner?.partnerCode || null,
      countryOfOrigin: e.countryOfOrigin,
      deadlineDays: e.deadlineDays,
      deadlineDate: e.deadlineDate,
      entryNumber: e.entryNumber,
      enteredValue: e.enteredValue,
      estimatedRefund: e.estimatedRefund,
    }));

    return NextResponse.json({ deadlines: result });
  } catch (err) {
    console.error("[admin/tariff/deadlines] Error:", err);
    return NextResponse.json({ error: "Failed to fetch deadlines" }, { status: 500 });
  }
}
