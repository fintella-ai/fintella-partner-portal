import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAllowedDownlineRates } from "@/lib/constants";
import { sendDownlineInviteEmail } from "@/lib/sendgrid";
import { logAudit } from "@/lib/audit-log";
import crypto from "crypto";

function generateToken(): string {
  return crypto.randomBytes(9).toString("base64url");
}

const PORTAL_URL =
  process.env.NEXTAUTH_URL?.replace(/\/$/, "") || "https://fintella.partners";

/**
 * GET /api/admin/invites/on-behalf?partnerCode=XXX
 * Returns the partner's info and allowed downline rates so the admin
 * can pick a rate before sending an invite on their behalf.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!["super_admin", "admin"].includes(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const code = req.nextUrl.searchParams.get("partnerCode");
  if (!code)
    return NextResponse.json(
      { error: "partnerCode query param required" },
      { status: 400 },
    );

  const partner = await prisma.partner.findUnique({
    where: { partnerCode: code },
    select: {
      partnerCode: true,
      firstName: true,
      lastName: true,
      email: true,
      tier: true,
      commissionRate: true,
      status: true,
    },
  });

  if (!partner)
    return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  if (partner.tier === "l3") {
    return NextResponse.json(
      { error: "L3 partners cannot recruit" },
      { status: 400 },
    );
  }

  const targetTier = partner.tier === "l1" ? "L2" : "L3";
  const allowedRates = getAllowedDownlineRates(partner.commissionRate);

  return NextResponse.json({
    partner: {
      partnerCode: partner.partnerCode,
      name: `${partner.firstName} ${partner.lastName}`,
      email: partner.email,
      tier: partner.tier,
      commissionRate: partner.commissionRate,
      status: partner.status,
    },
    targetTier,
    allowedRates,
  });
}

/**
 * POST /api/admin/invites/on-behalf
 * Admin sends a downline invite on behalf of a partner.
 * Body: { inviterCode, firstName, lastName, email, rate }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!["super_admin", "admin"].includes(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const { inviterCode, firstName, lastName, email, rate } = body as {
      inviterCode?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      rate?: number;
    };

    if (
      !inviterCode?.trim() ||
      !firstName?.trim() ||
      !lastName?.trim() ||
      !email?.trim() ||
      !rate
    ) {
      return NextResponse.json(
        {
          error:
            "inviterCode, firstName, lastName, email, and rate are required",
        },
        { status: 400 },
      );
    }

    const partner = await prisma.partner.findUnique({
      where: { partnerCode: inviterCode },
    });
    if (!partner)
      return NextResponse.json(
        { error: "Referring partner not found" },
        { status: 404 },
      );

    const parsedRate = parseFloat(String(rate));
    if (!isFinite(parsedRate) || parsedRate <= 0) {
      return NextResponse.json(
        { error: "Rate must be a positive number" },
        { status: 400 },
      );
    }
    if (parsedRate >= partner.commissionRate) {
      return NextResponse.json(
        {
          error: `Rate must be less than the partner's rate (${Math.round(partner.commissionRate * 100)}%)`,
        },
        { status: 400 },
      );
    }

    const existing = await prisma.partner.findFirst({
      where: { email: email.trim() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "This email already has a partner account" },
        { status: 400 },
      );
    }

    let targetTier: string;
    if (partner.tier === "l1") targetTier = "l2";
    else if (partner.tier === "l2") targetTier = "l3";
    else {
      return NextResponse.json(
        { error: "L3 partners cannot recruit" },
        { status: 403 },
      );
    }

    const token = generateToken();
    const invitedName = `${firstName.trim()} ${lastName.trim()}`;

    const invite = await prisma.recruitmentInvite.create({
      data: {
        token,
        inviterCode,
        targetTier,
        commissionRate: parsedRate,
        invitedEmail: email.trim(),
        invitedName,
        status: "active",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const signupUrl = `${PORTAL_URL}/signup?token=${token}`;
    const senderName = `${partner.firstName} ${partner.lastName}`;

    await sendDownlineInviteEmail({
      toEmail: email.trim(),
      toName: invitedName,
      signupUrl,
      senderName,
      senderPartnerCode: inviterCode,
      commissionRate: parsedRate,
      targetTier,
    }).catch(() => {});

    logAudit({
      action: "invite.create_on_behalf",
      actorEmail: session.user.email || "unknown",
      actorRole: role,
      actorId: session.user.id,
      targetType: "recruitment_invite",
      targetId: invite.id,
      details: {
        inviterCode,
        invitedEmail: email.trim(),
        commissionRate: parsedRate,
        targetTier,
      },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    }).catch(() => {});

    return NextResponse.json({ invite, signupUrl }, { status: 201 });
  } catch (err) {
    console.error("[admin/invites/on-behalf] error:", err);
    return NextResponse.json(
      { error: "Failed to create invite" },
      { status: 500 },
    );
  }
}
