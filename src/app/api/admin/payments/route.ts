import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!role || !["super_admin", "admin", "accounting"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = 50;

  const [payments, total] = await Promise.all([
    prisma.paymentLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.paymentLog.count(),
  ]);

  const totalRevenue = await prisma.paymentLog.aggregate({
    where: { status: "success" },
    _sum: { amount: true },
  });

  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);

  const monthRevenue = await prisma.paymentLog.aggregate({
    where: { status: "success", createdAt: { gte: thisMonth } },
    _sum: { amount: true },
  });

  return NextResponse.json({
    payments,
    total,
    page,
    limit,
    stats: {
      totalRevenue: totalRevenue._sum.amount || 0,
      monthRevenue: monthRevenue._sum.amount || 0,
    },
  });
}
