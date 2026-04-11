import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/documents/list
 * Returns all documents across all partners with partner names.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const documents = await prisma.document.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Get partner names
    const partnerCodes = Array.from(new Set(documents.map((d: any) => d.partnerCode)));
    const partners = await prisma.partner.findMany({
      where: { partnerCode: { in: partnerCodes } },
      select: { partnerCode: true, firstName: true, lastName: true },
    });

    const nameMap: Record<string, string> = {};
    partners.forEach((p: any) => {
      nameMap[p.partnerCode] = `${p.firstName} ${p.lastName}`;
    });

    const enriched = documents.map((d: any) => ({
      ...d,
      partnerName: nameMap[d.partnerCode] || d.partnerCode,
    }));

    return NextResponse.json({ documents: enriched });
  } catch {
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}
