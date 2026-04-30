import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCapeCsv, type EntryForCape } from "@/lib/tariff-calculator";

export const dynamic = "force-dynamic";

/* ── POST — generate CAPE-ready CSV ───────────────────────────────────────── */

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const partnerCode = (session.user as { partnerCode?: string }).partnerCode;
  if (!partnerCode) return NextResponse.json({ error: "Not a partner" }, { status: 403 });

  // Verify dossier ownership
  const dossier = await prisma.tariffDossier.findFirst({
    where: { id: params.id, partner: { partnerCode } },
    include: { entries: true },
  });
  if (!dossier) {
    return NextResponse.json({ error: "Dossier not found" }, { status: 404 });
  }

  if (dossier.entries.length === 0) {
    return NextResponse.json({ error: "Dossier has no entries" }, { status: 400 });
  }

  // Map entries to EntryForCape format
  const capeEntries: EntryForCape[] = dossier.entries.map((e) => ({
    entryNumber: e.entryNumber || "",
    status: e.eligibility,
    liquidationDate: e.liquidationDate,
  }));

  const csvBatches = generateCapeCsv(capeEntries);

  if (csvBatches.length === 0) {
    return NextResponse.json(
      { error: "No eligible liquidated entries for CAPE CSV" },
      { status: 400 },
    );
  }

  // Return first batch as CSV download
  const csvContent = csvBatches[0];

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cape-declaration-${dossier.id}.csv"`,
    },
  });
}
