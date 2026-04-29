import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;
  if (!["super_admin", "admin"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const referrals = await prisma.widgetReferral.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      partner: { select: { firstName: true, lastName: true, partnerCode: true } },
      widgetSession: { select: { platform: true } },
    },
  });

  return NextResponse.json({ referrals });
}
