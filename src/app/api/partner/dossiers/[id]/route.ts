import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/* ── GET — single dossier with all entries ────────────────────────────────── */

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const partnerCode = (session.user as { partnerCode?: string }).partnerCode;
  if (!partnerCode) return NextResponse.json({ error: "Not a partner" }, { status: 403 });

  const dossier = await prisma.tariffDossier.findFirst({
    where: { id: params.id, partner: { partnerCode } },
    include: { entries: { orderBy: { createdAt: "asc" } } },
  });

  if (!dossier) {
    return NextResponse.json({ error: "Dossier not found" }, { status: 404 });
  }

  return NextResponse.json({ dossier });
}

/* ── PUT — update dossier fields ──────────────────────────────────────────── */

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const partnerCode = (session.user as { partnerCode?: string }).partnerCode;
  if (!partnerCode) return NextResponse.json({ error: "Not a partner" }, { status: 403 });

  // Verify ownership
  const existing = await prisma.tariffDossier.findFirst({
    where: { id: params.id, partner: { partnerCode } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Dossier not found" }, { status: 404 });
  }

  const body = await req.json();

  // Only allow updating safe fields
  const allowedFields = [
    "clientCompany", "clientContact", "clientEmail", "clientPhone",
    "importerNumber", "status",
  ] as const;

  const data: Record<string, string> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      data[field] = typeof body[field] === "string" ? body[field].trim() : body[field];
    }
  }

  // Validate status transitions
  if (data.status) {
    const validStatuses = ["draft", "analyzing", "ready", "submitted", "converted"];
    if (!validStatuses.includes(data.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
  }

  const dossier = await prisma.tariffDossier.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json({ dossier });
}
