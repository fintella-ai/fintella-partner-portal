import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.SERVICE_WEBHOOK_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") || req.headers.get("x-webhook-secret") || "";
    if (auth !== `Bearer ${secret}` && auth !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const dealId = body.dealId || body.deal_id;
  if (!dealId) {
    return NextResponse.json({ error: "dealId required" }, { status: 400 });
  }

  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const data: Record<string, any> = {};
  if (body.stage) data.stage = body.stage;
  if (body.externalStage) data.externalStage = body.externalStage;
  if (body.externalDealId) data.externalDealId = body.externalDealId;
  if (body.notes) data.notes = body.notes;
  if (body.estimatedRefundAmount !== undefined) data.estimatedRefundAmount = Number(body.estimatedRefundAmount);
  if (body.actualRefundAmount !== undefined) data.actualRefundAmount = Number(body.actualRefundAmount);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  const updated = await prisma.deal.update({ where: { id: dealId }, data });

  return NextResponse.json({ ok: true, dealId: updated.id, stage: updated.stage });
}
