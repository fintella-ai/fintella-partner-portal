// src/app/api/admin/partner-dm-flags/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const REVIEWER_ROLES = new Set(["super_admin", "admin", "partner_support"]);

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!role || !REVIEWER_ROLES.has(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = new URL(req.url).searchParams.get("status") || "pending"; // "pending" | "reviewed" | "all"
  const where =
    status === "pending" ? { reviewedAt: null } :
    status === "reviewed" ? { reviewedAt: { not: null } } :
    {};

  const flags = await prisma.partnerDmFlag.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { message: true },
  });
  return NextResponse.json({ flags });
}
