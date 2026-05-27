import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dryRunWorkflowTrigger } from "@/lib/workflow-engine";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { dealId, partnerCode, trigger } = await req.json();
  const triggerKey = trigger || "deal.created";

  let deal: any = null;
  if (dealId) {
    deal = await prisma.deal.findUnique({ where: { id: dealId } });
  } else if (partnerCode) {
    deal = await prisma.deal.findFirst({
      where: { partnerCode },
      orderBy: { createdAt: "desc" },
    });
  }

  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const results = await dryRunWorkflowTrigger(triggerKey, { deal });

  return NextResponse.json({
    trigger: triggerKey,
    dealId: deal.id,
    dealName: deal.dealName,
    partnerCode: deal.partnerCode,
    workflows: results,
  });
}
