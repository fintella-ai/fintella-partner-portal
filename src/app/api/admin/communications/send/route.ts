import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail, emailShell } from "@/lib/sendgrid";
import { ALLOWED_SENDER_EMAILS } from "@/lib/constants";

const ALLOWED_ROLES = ["super_admin", "admin", "partner_support"];

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * POST /api/admin/communications/send
 *
 * Single-recipient or broadcast email. When `broadcast: true`, sends to
 * all active + pending partners. Goes through `sendEmail()` → Resend.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const text = typeof body.body === "string" ? body.body : "";
  if (!subject) return NextResponse.json({ error: "subject is required" }, { status: 400 });
  if (!text.trim()) return NextResponse.json({ error: "body is required" }, { status: 400 });

  const fromEmail = typeof body.fromEmail === "string" ? body.fromEmail.trim().toLowerCase() : undefined;
  if (fromEmail && !ALLOWED_SENDER_EMAILS.includes(fromEmail)) {
    return NextResponse.json(
      { error: `fromEmail must be one of: ${ALLOWED_SENDER_EMAILS.join(", ")}` },
      { status: 400 }
    );
  }

  const template = typeof body.templateKey === "string" && body.templateKey.trim()
    ? body.templateKey.trim().slice(0, 64)
    : "compose";

  const bodyHtml = text.split(/\r?\n/).map((line: string) => escapeHtml(line)).join("<br/>");

  const broadcast = body.broadcast === true;

  if (broadcast) {
    if (!["super_admin", "admin"].includes(role)) {
      return NextResponse.json({ error: "Only admins can broadcast" }, { status: 403 });
    }
    const partners = await prisma.partner.findMany({
      where: { status: { in: ["active", "pending"] } },
      select: { partnerCode: true, email: true, firstName: true, lastName: true },
    });
    let sent = 0;
    let failed = 0;
    for (const p of partners) {
      if (!p.email) { failed++; continue; }
      const name = `${p.firstName} ${p.lastName}`.trim();
      const wrapped = emailShell({
        heading: subject,
        bodyHtml: `<p>${bodyHtml}</p>`,
        bodyText: text,
      });
      const result = await sendEmail({
        to: p.email,
        toName: name,
        subject,
        text: wrapped.text,
        html: wrapped.html,
        template: template === "compose" ? "broadcast" : template,
        partnerCode: p.partnerCode,
        ...(fromEmail ? { fromEmail } : {}),
      });
      if (result.status === "failed") failed++;
      else sent++;
    }
    return NextResponse.json({ sent, failed, total: partners.length, broadcast: true });
  }

  // Single recipient
  let to: string = typeof body.to === "string" ? body.to.trim() : "";
  let toName: string | undefined = typeof body.toName === "string" ? body.toName : undefined;
  let partnerCode: string | null = typeof body.partnerCode === "string" ? body.partnerCode.trim().toUpperCase() : null;

  if (partnerCode && !to) {
    const partner = await prisma.partner.findUnique({ where: { partnerCode } });
    if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    to = partner.email;
    toName = `${partner.firstName} ${partner.lastName}`.trim();
  }

  if (!to) return NextResponse.json({ error: "to (or partnerCode) is required" }, { status: 400 });

  const wrapped = emailShell({
    heading: subject,
    bodyHtml: `<p>${bodyHtml}</p>`,
    bodyText: text,
  });

  const result = await sendEmail({
    to,
    toName,
    subject,
    text: wrapped.text,
    html: wrapped.html,
    template,
    partnerCode: partnerCode || null,
    ...(fromEmail ? { fromEmail } : {}),
  });

  return NextResponse.json({
    sent: result.status !== "failed",
    status: result.status,
    messageId: result.messageId,
    error: result.error,
  });
}
