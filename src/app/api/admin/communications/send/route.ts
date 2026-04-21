import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/sendgrid";
import { ALLOWED_SENDER_EMAILS } from "@/lib/constants";

const ALLOWED_ROLES = ["super_admin", "admin", "partner_support"];

/**
 * POST /api/admin/communications/send
 * Body: {
 *   to?: string                 // recipient email (or omit + provide partnerCode)
 *   toName?: string             // display name
 *   partnerCode?: string        // resolves to the partner's email if `to` absent, and attributes the EmailLog row
 *   subject: string
 *   body: string                // plain text; a naive <p>...<br/>...</p> wrapper is used for HTML
 *   fromEmail?: string          // must be in ALLOWED_SENDER_EMAILS; defaults to env/noreply@
 *   cc?: string                 // comma-separated; not yet surfaced in EmailLog
 *   bcc?: string                // comma-separated; not yet surfaced in EmailLog
 *   templateKey?: string        // logged to EmailLog.template; defaults to "compose"
 * }
 *
 * Wires the Communications Hub Compose form + the per-partner Send Email
 * button to the real SendGrid pipeline. Goes through `sendEmail()` so the
 * demo-mode gate + EmailLog persistence pattern is shared with every other
 * transactional send.
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

  // Resolve recipient: prefer `to`, fall back to partner lookup
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

  // Sender must be one of the verified shared mailboxes. Anything else
  // would either render a broken From address or silently fall back to
  // the env default, which is misleading in the audit log.
  const fromEmail = typeof body.fromEmail === "string" ? body.fromEmail.trim().toLowerCase() : undefined;
  if (fromEmail && !ALLOWED_SENDER_EMAILS.includes(fromEmail)) {
    return NextResponse.json(
      { error: `fromEmail must be one of: ${ALLOWED_SENDER_EMAILS.join(", ")}` },
      { status: 400 }
    );
  }

  const html = `<p>${text
    .split(/\r?\n/)
    .map((line: string) => line
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;"))
    .join("<br/>")}</p>`;

  const template = typeof body.templateKey === "string" && body.templateKey.trim()
    ? body.templateKey.trim().slice(0, 64)
    : "compose";

  const result = await sendEmail({
    to,
    toName,
    subject,
    text,
    html,
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
