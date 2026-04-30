import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/* ── GET — list dossiers for authenticated partner ────────────────────────── */

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const partnerCode = (session.user as { partnerCode?: string }).partnerCode;
  if (!partnerCode) return NextResponse.json({ error: "Not a partner" }, { status: 403 });

  const dossiers = await prisma.tariffDossier.findMany({
    where: { partner: { partnerCode } },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { entries: true } } },
  });

  return NextResponse.json({ dossiers });
}

/* ── POST — create new dossier ────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const partnerCode = (session.user as { partnerCode?: string }).partnerCode;
  if (!partnerCode) return NextResponse.json({ error: "Not a partner" }, { status: 403 });

  const partner = await prisma.partner.findUnique({ where: { partnerCode } });
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  const body = await req.json();
  if (!body.clientCompany?.trim()) {
    return NextResponse.json({ error: "clientCompany is required" }, { status: 400 });
  }

  const validSources = ["public_calculator", "widget", "portal", "csv_upload", "document_ai", "manual"];
  const source = validSources.includes(body.source) ? body.source : "portal";

  const dossier = await prisma.tariffDossier.create({
    data: {
      partnerId: partner.id,
      clientCompany: body.clientCompany.trim(),
      clientContact: body.clientContact?.trim() || null,
      clientEmail: body.clientEmail?.trim() || null,
      clientPhone: body.clientPhone?.trim() || null,
      importerNumber: body.importerNumber?.trim() || null,
      source,
      status: "draft",
    },
  });

  return NextResponse.json({ dossier }, { status: 201 });
}
