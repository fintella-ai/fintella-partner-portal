import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/tariff/dossiers/[id]
 * Single dossier with entries and partner info.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!["super_admin", "admin", "accounting", "partner_support"].includes(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const dossier = await prisma.tariffDossier.findUnique({
      where: { id: params.id },
      include: {
        partner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            partnerCode: true,
          },
        },
        entries: {
          orderBy: { entryDate: "desc" },
        },
      },
    });

    if (!dossier)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      ...dossier,
      partnerName: dossier.partner
        ? `${dossier.partner.firstName} ${dossier.partner.lastName}`
        : null,
    });
  } catch (err) {
    console.error("[admin/tariff/dossiers/id GET] Error:", err);
    return NextResponse.json({ error: "Failed to fetch dossier" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/tariff/dossiers/[id]
 * Update dossier fields (status, clientCompany, etc.)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!["super_admin", "admin"].includes(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const allowedFields = [
      "status",
      "clientCompany",
      "clientContact",
      "clientEmail",
      "clientPhone",
      "importerNumber",
    ];
    const data: any = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) data[key] = body[key];
    }

    if (data.status === "converted" && !body.skipConvertedAt) {
      data.convertedAt = new Date();
    }

    const updated = await prisma.tariffDossier.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[admin/tariff/dossiers/id PUT] Error:", err);
    return NextResponse.json({ error: "Failed to update dossier" }, { status: 500 });
  }
}
