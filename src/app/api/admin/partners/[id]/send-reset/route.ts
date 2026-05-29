import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/sendgrid";
import { logAudit } from "@/lib/audit-log";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const PORTAL_URL =
  process.env.PORTAL_URL?.replace(/\/+$/, "") ||
  process.env.NEXT_PUBLIC_PORTAL_URL?.replace(/\/+$/, "") ||
  "https://fintella.partners";

/**
 * POST /api/admin/partners/[id]/send-reset
 *
 * Admin-authenticated password-reset trigger. Unlike the public anti-enumeration
 * /api/auth/forgot-password endpoint, this looks the partner up by ID (no email
 * casing/guessing), reports the REAL outcome (sent / no_email / blocked), and
 * logs the send — so the admin actually knows whether the link went out.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!["super_admin", "admin", "partner_support"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const partner = await prisma.partner.findUnique({
    where: { id: params.id },
    select: { email: true, firstName: true, lastName: true, status: true },
  });
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  if (!partner.email || partner.email.trim() === "") {
    return NextResponse.json({ status: "no_email", message: "Partner has no email on file." }, { status: 422 });
  }
  if (partner.status === "blocked") {
    return NextResponse.json({ status: "blocked", message: "Partner is blocked — reset not sent." }, { status: 409 });
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await prisma.passwordResetToken.create({
    data: { token, email: partner.email, role: "partner", expiresAt },
  });

  const resetUrl = `${PORTAL_URL}/reset-password?token=${token}`;
  const name = `${partner.firstName} ${partner.lastName}`.trim() || null;

  const result = await sendPasswordResetEmail({ email: partner.email, name, resetUrl, role: "partner" }).catch(
    (e) => { console.error("[admin send-reset] send failed:", e); return null; },
  );

  const sent = !!result && result.status !== "failed";

  logAudit({
    action: "partner.send_reset",
    actorEmail: session.user.email || "unknown",
    actorRole: role,
    actorId: session.user.id,
    targetType: "partner",
    targetId: params.id,
    details: { email: partner.email, sent },
  }).catch(() => {});

  if (!sent) {
    return NextResponse.json({ status: "failed", message: "Email provider error — check email logs." }, { status: 502 });
  }

  return NextResponse.json({
    status: "sent",
    message: `Reset link sent to ${partner.email} (expires in 24 hours).`,
    email: partner.email,
  });
}
