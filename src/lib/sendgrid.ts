/**
 * SendGrid Email Client (Phase 15a)
 *
 * Sends transactional partner emails via the SendGrid v3 REST API. Mirrors
 * the demo-mode pattern used by `signwell.ts` and `hubspot.ts`: when
 * `SENDGRID_API_KEY` is not set, all sends short-circuit to a "demo" status
 * and still write to the `EmailLog` table so the admin Communication Log
 * fills out during local development.
 *
 * Uses raw `fetch()` against `https://api.sendgrid.com/v3/mail/send` rather
 * than the `@sendgrid/mail` package to avoid pulling in a new dependency —
 * matches the existing house pattern.
 *
 * Every send (success, failure, demo) is persisted to `EmailLog` so failures
 * are debuggable and the partner communication log is the single source of
 * truth for outbound mail.
 */

import { prisma } from "@/lib/prisma";
import { FIRM_NAME, FIRM_SHORT } from "@/lib/constants";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";
const SENDGRID_FROM_EMAIL =
  process.env.SENDGRID_FROM_EMAIL || "noreply@fintella.partners";
const SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME || FIRM_SHORT;

const PORTAL_URL =
  process.env.NEXTAUTH_URL?.replace(/\/$/, "") || "https://fintella.partners";
const BRAND_GOLD = "#c4a050";

export function isSendGridConfigured(): boolean {
  return !!SENDGRID_API_KEY;
}

export interface SendEmailInput {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
  /** Logged to EmailLog.template — short identifier for the email kind. */
  template: string;
  /** Optional partner attribution for the EmailLog row. */
  partnerCode?: string | null;
  /** Override the default reply-to. */
  replyTo?: string;
}

export interface SendEmailResult {
  status: "sent" | "demo" | "failed";
  messageId: string | null;
  error?: string;
}

/**
 * Send a single transactional email and persist the result to EmailLog.
 *
 * Always resolves — never throws. Callers should treat email as fire-and-forget;
 * a failure should never block the user-facing flow that triggered it.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const text = input.text || htmlToPlainText(input.html);
  const bodyPreview = text.slice(0, 300);

  // ── Demo mode: log it and short-circuit ───────────────────────────────────
  if (!SENDGRID_API_KEY) {
    await logEmail({
      partnerCode: input.partnerCode ?? null,
      toEmail: input.to,
      fromEmail: SENDGRID_FROM_EMAIL,
      subject: input.subject,
      bodyPreview,
      template: input.template,
      status: "demo",
      providerMessageId: null,
      errorMessage: null,
    });
    return { status: "demo", messageId: null };
  }

  // ── Real send via SendGrid v3 API ─────────────────────────────────────────
  try {
    const payload = {
      personalizations: [
        {
          to: [{ email: input.to, name: input.toName || undefined }],
          subject: input.subject,
        },
      ],
      from: { email: SENDGRID_FROM_EMAIL, name: SENDGRID_FROM_NAME },
      reply_to: input.replyTo
        ? { email: input.replyTo }
        : { email: SENDGRID_FROM_EMAIL, name: SENDGRID_FROM_NAME },
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: input.html },
      ],
      mail_settings: {
        sandbox_mode: { enable: false },
      },
    };

    const res = await fetch(SENDGRID_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => `HTTP ${res.status}`);
      const err = `SendGrid API error (${res.status}): ${errText.slice(0, 500)}`;
      await logEmail({
        partnerCode: input.partnerCode ?? null,
        toEmail: input.to,
        fromEmail: SENDGRID_FROM_EMAIL,
        subject: input.subject,
        bodyPreview,
        template: input.template,
        status: "failed",
        providerMessageId: null,
        errorMessage: err,
      });
      console.error("[SendGrid]", err);
      return { status: "failed", messageId: null, error: err };
    }

    // SendGrid returns 202 with an empty body and a message id in headers.
    const messageId = res.headers.get("x-message-id");
    await logEmail({
      partnerCode: input.partnerCode ?? null,
      toEmail: input.to,
      fromEmail: SENDGRID_FROM_EMAIL,
      subject: input.subject,
      bodyPreview,
      template: input.template,
      status: "sent",
      providerMessageId: messageId,
      errorMessage: null,
    });
    return { status: "sent", messageId };
  } catch (err: any) {
    const message = err?.message || String(err);
    await logEmail({
      partnerCode: input.partnerCode ?? null,
      toEmail: input.to,
      fromEmail: SENDGRID_FROM_EMAIL,
      subject: input.subject,
      bodyPreview,
      template: input.template,
      status: "failed",
      providerMessageId: null,
      errorMessage: message,
    });
    console.error("[SendGrid] send threw:", message);
    return { status: "failed", messageId: null, error: message };
  }
}

// ─── EmailLog persistence (best-effort, never throws) ────────────────────────

interface LogEmailRow {
  partnerCode: string | null;
  toEmail: string;
  fromEmail: string;
  subject: string;
  bodyPreview: string;
  template: string;
  status: "sent" | "demo" | "failed";
  providerMessageId: string | null;
  errorMessage: string | null;
}

async function logEmail(row: LogEmailRow): Promise<void> {
  try {
    await prisma.emailLog.create({ data: row });
  } catch (err) {
    // Logging failure must never break the caller. Surface to console only.
    console.error("[SendGrid] failed to write EmailLog row:", err);
  }
}

// ─── Plain-text fallback for HTML bodies ─────────────────────────────────────

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Shared HTML shell ───────────────────────────────────────────────────────

function emailShell(opts: {
  preheader?: string;
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const cta =
    opts.ctaLabel && opts.ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
           <tr><td style="background:${BRAND_GOLD};border-radius:6px;">
             <a href="${escapeAttr(opts.ctaUrl)}" style="display:inline-block;padding:12px 24px;color:#0a0a0a;font-family:Helvetica,Arial,sans-serif;font-weight:600;font-size:14px;text-decoration:none;">${escapeHtml(opts.ctaLabel)}</a>
           </td></tr>
         </table>`
      : "";

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;">
${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5;">
      <tr><td style="background:#0a0a0a;padding:20px 32px;">
        <div style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:${BRAND_GOLD};letter-spacing:0.5px;">${FIRM_SHORT}</div>
        <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#888;letter-spacing:1px;text-transform:uppercase;margin-top:2px;">${FIRM_NAME}</div>
      </td></tr>
      <tr><td style="padding:32px;">
        <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#0a0a0a;margin:0 0 16px;">${escapeHtml(opts.heading)}</h1>
        <div style="font-size:14px;line-height:1.6;color:#333;">${opts.bodyHtml}</div>
        ${cta}
      </td></tr>
      <tr><td style="background:#fafafa;padding:20px 32px;border-top:1px solid #e5e5e5;font-size:11px;color:#888;font-family:Helvetica,Arial,sans-serif;line-height:1.5;">
        You're receiving this because you have a partner account at ${escapeHtml(FIRM_SHORT)}.<br>
        ${escapeHtml(FIRM_NAME)} &middot; <a href="${PORTAL_URL}" style="color:${BRAND_GOLD};text-decoration:none;">${PORTAL_URL.replace(/^https?:\/\//, "")}</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

// ─── Template helpers ────────────────────────────────────────────────────────

export interface PartnerEmailContext {
  partnerCode: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

function partnerDisplayName(p: PartnerEmailContext): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || "Partner";
}

/**
 * Welcome email — fired on partner signup, before the agreement is signed.
 * Always sent (transactional / onboarding).
 */
export async function sendWelcomeEmail(
  partner: PartnerEmailContext
): Promise<SendEmailResult> {
  const name = partnerDisplayName(partner);
  const heading = `Welcome to ${FIRM_SHORT}, ${escapeHtml(name)}`;
  const bodyHtml = `
    <p>Your partner account is now created. Your partner code is
       <strong style="font-family:'Courier New',monospace;background:#f5f5f5;padding:2px 6px;border-radius:3px;color:${BRAND_GOLD};">${escapeHtml(partner.partnerCode)}</strong>.</p>
    <p>Next step: your partnership agreement is on its way. Once it's signed
       you'll be able to start submitting clients and tracking commissions
       from your dashboard.</p>
    <p>If you have any questions, just reply to this email.</p>`;
  const html = emailShell({
    preheader: `Welcome to ${FIRM_SHORT}. Your partner code is ${partner.partnerCode}.`,
    heading,
    bodyHtml,
    ctaLabel: "Open your dashboard",
    ctaUrl: `${PORTAL_URL}/login`,
  });
  return sendEmail({
    to: partner.email,
    toName: name,
    subject: `Welcome to ${FIRM_SHORT}`,
    html,
    template: "welcome",
    partnerCode: partner.partnerCode,
  });
}

/**
 * Agreement-ready email — fired immediately after a SignWell document is sent
 * to the partner. Includes the embedded signing link when available, otherwise
 * directs them to log in.
 */
export async function sendAgreementReadyEmail(
  partner: PartnerEmailContext,
  signingUrl: string | null
): Promise<SendEmailResult> {
  const name = partnerDisplayName(partner);
  const heading = "Your partnership agreement is ready to sign";
  const bodyHtml = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>Your ${escapeHtml(FIRM_SHORT)} partnership agreement is ready for your
       signature. Click the button below to review and sign — it should take
       under two minutes.</p>
    <p>Once it's signed, your account activates immediately and you can start
       submitting clients.</p>`;
  const html = emailShell({
    preheader: "Your Fintella partnership agreement is ready for signature.",
    heading,
    bodyHtml,
    ctaLabel: "Review &amp; sign agreement",
    ctaUrl: signingUrl || `${PORTAL_URL}/dashboard`,
  });
  return sendEmail({
    to: partner.email,
    toName: name,
    subject: `${FIRM_SHORT} partnership agreement — ready to sign`,
    html,
    template: "agreement_ready",
    partnerCode: partner.partnerCode,
  });
}

/**
 * Agreement-signed email — fired from the SignWell webhook on
 * `document_completed`. Confirms activation and points them at the dashboard.
 */
export async function sendAgreementSignedEmail(
  partner: PartnerEmailContext
): Promise<SendEmailResult> {
  const name = partnerDisplayName(partner);
  const heading = "Your partner account is now active";
  const bodyHtml = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>Your ${escapeHtml(FIRM_SHORT)} partnership agreement has been signed
       and your account is now <strong>active</strong>. You can submit
       clients, generate referral links, and track commissions from your
       dashboard.</p>
    <p>Welcome aboard.</p>`;
  const html = emailShell({
    preheader: "Your partnership agreement has been signed. Welcome aboard.",
    heading,
    bodyHtml,
    ctaLabel: "Go to dashboard",
    ctaUrl: `${PORTAL_URL}/dashboard`,
  });
  return sendEmail({
    to: partner.email,
    toName: name,
    subject: `${FIRM_SHORT}: your partner account is active`,
    html,
    template: "agreement_signed",
    partnerCode: partner.partnerCode,
  });
}

/**
 * L1 inviter notification — fired when a recruit completes signup via an
 * invite link. Tells the L1 a new downline partner just joined and reminds
 * them to upload the signed agreement.
 */
export async function sendInviterSignupNotificationEmail(opts: {
  inviterEmail: string;
  inviterName: string;
  inviterCode: string;
  recruitName: string;
  recruitTier: string; // "l2" | "l3"
  commissionRate: number; // 0.10..0.25
}): Promise<SendEmailResult> {
  const ratePct = Math.round(opts.commissionRate * 100);
  const heading = "A new partner just joined your downline";
  const bodyHtml = `
    <p>Hi ${escapeHtml(opts.inviterName)},</p>
    <p><strong>${escapeHtml(opts.recruitName)}</strong> has signed up as your
       ${escapeHtml(opts.recruitTier.toUpperCase())} partner at
       ${ratePct}% commission.</p>
    <p>Next step: upload their countersigned partnership agreement from your
       Downline page so we can activate their account.</p>`;
  const html = emailShell({
    preheader: `${opts.recruitName} joined your downline at ${ratePct}%.`,
    heading,
    bodyHtml,
    ctaLabel: "Open downline",
    ctaUrl: `${PORTAL_URL}/dashboard/downline`,
  });
  return sendEmail({
    to: opts.inviterEmail,
    toName: opts.inviterName,
    subject: `New downline partner: ${opts.recruitName}`,
    html,
    template: "signup_notification",
    partnerCode: opts.inviterCode,
  });
}
