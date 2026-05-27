import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendL1InviteEmail } from "@/lib/sendgrid";
import crypto from "crypto";

const PORTAL_URL =
  process.env.NEXTAUTH_URL?.replace(/\/$/, "") || "https://fintella.partners";

function generateToken(): string {
  return crypto.randomBytes(9).toString("base64url");
}

/**
 * POST /api/invites/[id]/resend
 *
 * Partner-facing resend — refreshes token + expiry and re-sends email.
 * Rate limited to 1 resend per invite per 24 hours.
 * Only the partner who created the invite can resend it.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const partnerCode = (session.user as any).partnerCode;
  if (!partnerCode)
    return NextResponse.json({ error: "Not a partner" }, { status: 403 });

  try {
    const invite = await prisma.recruitmentInvite.findUnique({
      where: { id: params.id },
    });

    if (!invite)
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    if (invite.inviterCode !== partnerCode)
      return NextResponse.json({ error: "Not your invite" }, { status: 403 });
    if (invite.status === "used")
      return NextResponse.json(
        { error: "This invite has already been used" },
        { status: 400 }
      );
    if (!invite.invitedEmail)
      return NextResponse.json(
        { error: "Invite has no email address" },
        { status: 400 }
      );

    // Rate limit: 1 resend per 24 hours
    if (invite.lastReminderSentAt) {
      const hoursSince = (Date.now() - new Date(invite.lastReminderSentAt).getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        const hoursLeft = Math.ceil(24 - hoursSince);
        return NextResponse.json(
          { error: `You can resend again in ${hoursLeft} hour${hoursLeft !== 1 ? "s" : ""}` },
          { status: 429 }
        );
      }
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    const updated = await prisma.recruitmentInvite.update({
      where: { id: params.id },
      data: { token, expiresAt, status: "active", lastReminderSentAt: new Date() },
    });

    const signupUrl = `${PORTAL_URL}/getstarted?token=${token}`;

    await sendL1InviteEmail({
      toEmail: invite.invitedEmail,
      toName: invite.invitedName,
      signupUrl,
      commissionRate: invite.commissionRate ?? undefined,
    }).catch(() => {});

    return NextResponse.json({ invite: updated, signupUrl });
  } catch {
    return NextResponse.json(
      { error: "Failed to resend invite" },
      { status: 500 }
    );
  }
}
