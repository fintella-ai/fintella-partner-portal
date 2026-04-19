// src/app/api/admin/team-chat/admins/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAnyAdmin } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!isAnyAdmin(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admins = await prisma.user.findMany({
    select: { email: true, name: true, role: true },
    orderBy: { email: "asc" },
  });
  return NextResponse.json({ admins });
}
