import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail, emailShell } from "@/lib/sendgrid";
import { ALLOWED_SENDER_EMAILS } from "@/lib/constants";

const ALLOWED_ROLES = ["super_admin", "admin", "partner_support"];

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function resolveVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([^}]+)\}/g, (match, key) => vars[key.trim()] ?? match);
}

async function buildVars(partnerCode: string | null, to: string, toName: string | undefined): Promise<Record<string, string>> {
  const vars: Record<string, string> = {};

  if (partnerCode) {
    const partner = await prisma.partner.findUnique({
      where: { partnerCode },
      select: { firstName: true, lastName: true, email: true, partnerCode: true, commissionRate: true },
    });
    if (partner) {
      vars["partner.firstName"] = partner.firstName || "";
      vars["partner.lastName"] = partner.lastName || "";
      vars["partner.email"] = partner.email;
      vars["partner.partnerCode"] = partner.partnerCode;
      vars["firstName"] = partner.firstName || "";
      vars["lastName"] = partner.lastName || "";
      vars["partnerCode"] = partner.partnerCode;
    }
  } else if (toName) {
    vars["partner.firstName"] = toName.split(" ")[0] || "";
    vars["firstName"] = vars["partner.firstName"];
  }

  const conf = await prisma.conferenceSchedule.findFirst({
    where: { isActive: true },
    orderBy: { nextCall: "asc" },
    select: { title: true, nextCall: true, meetLink: true, joinUrl: true, hostName: true },
  });
  if (conf) {
    vars["conference.title"] = conf.title || "Live Weekly Partner Call";
    vars["conference.joinUrl"] = conf.meetLink || conf.joinUrl || "";
    vars["conference.hostName"] = conf.hostName || "";
    if (conf.nextCall) {
      try {
        vars["conference.nextCallLocal"] = conf.nextCall.toLocaleString("en-US", {
          timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric",
          hour: "numeric", minute: "2-digit", timeZoneName: "short",
        });
      } catch { vars["conference.nextCallLocal"] = conf.nextCall.toISOString(); }
    }
  }
  vars["hoursBeforeCall"] = "";
  vars["portalUrl"] = (process.env.NEXTAUTH_URL || "https://fintella.partners").replace(/\/$/, "");

  return vars;
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
      const vars = await buildVars(p.partnerCode, p.email, name);
      const resolvedSubject = resolveVars(subject, vars);
      const resolvedText = resolveVars(text, vars);
      const resolvedHtml = resolveVars(bodyHtml, vars);
      const wrapped = emailShell({
        heading: resolvedSubject,
        bodyHtml: `<p>${resolvedHtml}</p>`,
        bodyText: resolvedText,
      });
      const result = await sendEmail({
        to: p.email,
        toName: name,
        subject: resolvedSubject,
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

  const vars = await buildVars(partnerCode, to, toName);
  const resolvedSubject = resolveVars(subject, vars);
  const resolvedText = resolveVars(text, vars);
  const resolvedHtml = resolveVars(bodyHtml, vars);

  const wrapped = emailShell({
    heading: resolvedSubject,
    bodyHtml: `<p>${resolvedHtml}</p>`,
    bodyText: resolvedText,
  });

  const result = await sendEmail({
    to,
    toName,
    subject: resolvedSubject,
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
