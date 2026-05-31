import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fireWorkflowTrigger, deriveDealWorkflowFields } from "@/lib/workflow-engine";

export async function POST(req: NextRequest) {
  // Accept either super_admin session OR CRON_SECRET bearer token
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") || "";
  const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCronAuth) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((session.user as any).role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  // Enrich the payload the same way the live deal.created call sites do
  // (/api/webhook/referral + /api/kwong-intake) so tokens like
  // {deal.referralPartnerName}, {deal.dealUrl}, {deal.entityType} and
  // {deal.businessAddress} resolve in workflow actions on a manual refire.
  let referralPartnerName = "";
  if (deal.partnerCode && deal.partnerCode !== "UNATTRIBUTED" && deal.partnerCode !== "DIRECT") {
    const p = await prisma.partner
      .findUnique({
        where: { partnerCode: deal.partnerCode },
        select: { firstName: true, lastName: true },
      })
      .catch(() => null);
    if (p) referralPartnerName = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
  }
  const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fintella.partners";
  const enrichedDeal = {
    ...deal,
    ...deriveDealWorkflowFields(deal),
    referralPartnerName,
    dealUrl: `${PORTAL_URL}/admin/deals#${deal.id}`,
  };

  await fireWorkflowTrigger(triggerKey, { deal: enrichedDeal });

  return NextResponse.json({
    fired: true,
    trigger: triggerKey,
    dealId: deal.id,
    dealName: deal.dealName,
    partnerCode: deal.partnerCode,
    stage: deal.stage,
  });
}
