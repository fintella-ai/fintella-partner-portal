import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeGettingStarted } from "@/lib/getting-started";

/**
 * GET /api/admin/partners/[id]/getting-started
 *
 * Admin-only read of any partner's Getting-Started checklist + signup
 * timestamp. Accepts either a Prisma cuid id or a partnerCode in params.id,
 * matching the forgiving resolution used by the parent /admin/partners/[id]
 * route so deep links by code keep working.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (!["super_admin", "admin", "accounting", "partner_support"].includes(role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const needle = params.id;
  const partner = await prisma.partner.findFirst({
    where: { OR: [{ id: needle }, { partnerCode: needle.toUpperCase() }] },
    select: { partnerCode: true, signupDate: true, firstName: true, lastName: true, status: true },
  });
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  try {
    const checklist = await computeGettingStarted(partner.partnerCode);
    return NextResponse.json({
      partnerCode: partner.partnerCode,
      firstName: partner.firstName,
      lastName: partner.lastName,
      status: partner.status,
      signupDate: partner.signupDate,
      ...checklist,
    });
  } catch (err) {
    console.error("[admin/partners/getting-started] compute failed:", err);
    return NextResponse.json({ error: "Failed to compute checklist" }, { status: 500 });
  }
}
