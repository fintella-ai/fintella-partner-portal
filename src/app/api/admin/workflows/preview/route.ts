import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  deriveDealWorkflowFields,
  previewInterpolate,
  TRIGGER_VARIABLES,
  type TriggerKey,
} from "@/lib/workflow-engine";

async function guardSuperAdmin() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || role !== "super_admin") return null;
  return session;
}

/**
 * Build a synthetic payload from the TRIGGER_VARIABLES `example` strings — used
 * when no real Deal exists yet so the admin still sees a rendered preview.
 * Tokens are flat `{deal.x}` / `{previousStage}` paths, so we nest anything
 * prefixed `deal.` under a `deal` object and leave the rest top-level.
 */
function buildSyntheticPayload(trigger: TriggerKey): Record<string, unknown> {
  const vars = TRIGGER_VARIABLES[trigger] ?? [];
  const deal: Record<string, unknown> = {};
  const top: Record<string, unknown> = {};
  for (const v of vars) {
    const path = v.token.replace(/^\{|\}$/g, "").trim();
    const example = v.example ?? "";
    if (path.startsWith("deal.")) {
      deal[path.slice("deal.".length)] = example;
    } else if (!path.includes(".")) {
      top[path] = example;
    }
  }
  return Object.keys(deal).length > 0 ? { ...top, deal } : top;
}

export async function POST(req: NextRequest) {
  if (!(await guardSuperAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { trigger?: unknown; template?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const trigger = typeof body.trigger === "string" ? body.trigger : "";
  const template = typeof body.template === "string" ? body.template : "";
  if (!trigger) {
    return NextResponse.json({ error: "trigger is required" }, { status: 400 });
  }

  const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fintella.partners";

  let payload: Record<string, unknown>;
  let usedDealId: string | null = null;

  // For deal.* triggers, resolve against the most recent real Deal so the
  // admin sees actual values (catching empty/typo'd tokens). Other triggers
  // (partner.*, sms.*, etc.) fall back to the synthetic example payload.
  if (trigger.startsWith("deal.")) {
    const deal = await prisma.deal.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (deal) {
      usedDealId = deal.id;
      let referralPartnerName = "";
      if (deal.partnerCode && deal.partnerCode !== "UNATTRIBUTED") {
        const p = await prisma.partner
          .findUnique({
            where: { partnerCode: deal.partnerCode },
            select: { firstName: true, lastName: true },
          })
          .catch(() => null);
        if (p) referralPartnerName = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
      }
      const enrichedDeal = {
        ...deal,
        ...deriveDealWorkflowFields(deal),
        referralPartnerName,
        dealUrl: `${PORTAL_URL}/admin/deals#${deal.id}`,
      };
      payload = { deal: enrichedDeal };
      // stage_changed exposes previousStage / newStage at the top level.
      if (trigger === "deal.stage_changed") {
        payload.previousStage = "lead_submitted";
        payload.newStage = deal.stage ?? "meeting_booked";
      }
    } else {
      payload = buildSyntheticPayload(trigger as TriggerKey);
    }
  } else {
    payload = buildSyntheticPayload(trigger as TriggerKey);
  }

  const { rendered, unresolvedTokens } = previewInterpolate(template, payload);

  return NextResponse.json({ rendered, usedDealId, unresolvedTokens });
}
