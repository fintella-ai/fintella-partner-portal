import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MAX_COMMISSION_RATE, getAllowedDownlineRates } from "@/lib/constants";
import crypto from "crypto";

function generateToken(): string {
  return crypto.randomBytes(9).toString("base64url"); // 12 chars, URL-safe
}

/**
 * GET /api/invites
 * Returns all recruitment invites for the current partner.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const partnerCode = (session.user as any).partnerCode;
  if (!partnerCode) return NextResponse.json({ error: "Not a partner" }, { status: 403 });

  try {
    const partner = await prisma.partner.findUnique({ where: { partnerCode } });
    if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

    const invites = await prisma.recruitmentInvite.findMany({
      where: { inviterCode: partnerCode },
      orderBy: { createdAt: "desc" },
    });

    // Check global L3 setting
    const settings = await prisma.portalSettings.findUnique({ where: { id: "global" } });

    return NextResponse.json({
      invites,
      partner: {
        tier: partner.tier,
        commissionRate: partner.commissionRate,
        allowedDownlineRates: getAllowedDownlineRates(partner.commissionRate),
      },
      l3Enabled: settings?.l3Enabled || false,
      maxRate: MAX_COMMISSION_RATE,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch invites" }, { status: 500 });
  }
}

/**
 * POST /api/invites
 * Create a new recruitment invite with a pre-set commission rate.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const partnerCode = (session.user as any).partnerCode;
  if (!partnerCode) return NextResponse.json({ error: "Not a partner" }, { status: 403 });

  try {
    const body = await req.json();
    const rate = parseFloat(body.rate);

    const partner = await prisma.partner.findUnique({ where: { partnerCode } });
    if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

    // Determine target tier and validate rate
    // Rate must be in [0.05 … partner.commissionRate - 0.05] in 5% steps
    let targetTier: string;
    const allowedRates = getAllowedDownlineRates(partner.commissionRate);

    if (partner.tier === "l1") {
      targetTier = "l2";
      if (allowedRates.length === 0) {
        return NextResponse.json({ error: "Your commission rate is too low to recruit partners" }, { status: 403 });
      }
      if (!allowedRates.some((r) => Math.abs(r - rate) < 0.001)) {
        return NextResponse.json({ error: `Invalid L2 rate. Allowed: ${allowedRates.map((r) => `${Math.round(r * 100)}%`).join(", ")}` }, { status: 400 });
      }
    } else if (partner.tier === "l2") {
      // Check if L3 is enabled globally
      const settings = await prisma.portalSettings.findUnique({ where: { id: "global" } });
      if (!settings?.l3Enabled) {
        return NextResponse.json({ error: "L3 recruitment is not enabled" }, { status: 403 });
      }
      if (allowedRates.length === 0) {
        return NextResponse.json({ error: "Your commission rate is too low to recruit L3 partners (minimum 10% required)" }, { status: 403 });
      }
      targetTier = "l3";
      if (!allowedRates.some((r) => Math.abs(r - rate) < 0.001)) {
        return NextResponse.json({ error: `Invalid L3 rate. Allowed: ${allowedRates.map((r) => `${Math.round(r * 100)}%`).join(", ")}` }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "L3 partners cannot recruit" }, { status: 403 });
    }

    const token = generateToken();

    const invite = await prisma.recruitmentInvite.create({
      data: {
        token,
        inviterCode: partnerCode,
        targetTier,
        commissionRate: rate,
        status: "active",
      },
    });

    return NextResponse.json({
      invite,
      signupUrl: `${process.env.NEXTAUTH_URL || "https://fintella.partners"}/signup?token=${token}`,
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }
}
