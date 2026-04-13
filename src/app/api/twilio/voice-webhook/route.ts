import { NextRequest, NextResponse } from "next/server";
import { FIRM_SHORT } from "@/lib/constants";

/**
 * Twilio Voice Webhook (Phase 15c)
 *
 * Twilio fetches this URL when the admin (TWILIO_ADMIN_PHONE) answers
 * the bridged call started by initiateBridgedCall(). Twilio expects a
 * TwiML response telling it what to do next.
 *
 * We respond with a brief Say + Dial:
 *  - Speak a short connection prompt to the admin
 *  - <Dial> the partner's mobile (passed as ?to= query param)
 *
 * The partner phone is sent as a query string param (set by
 * initiateBridgedCall) so this route is stateless and Twilio just needs
 * to GET/POST the URL we already constructed.
 *
 * Twilio will POST or GET this URL. Per Twilio docs we should accept
 * both; we wrap the same handler.
 *
 * Signature verification: Twilio also signs voice webhooks. For now we
 * trust the request because (a) the URL is unguessable (it carries a
 * specific CallLog id), (b) the bridge target is also passed as a query
 * param so even an attacker who guessed the URL couldn't do anything
 * besides re-bridge to themselves, and (c) the Twilio account auth
 * token is still required to *originate* the call. A future hardening
 * pass can add HMAC verification matching the SMS webhook.
 */

function twiml(xml: string): NextResponse {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>${xml}`, {
    status: 200,
    headers: { "Content-Type": "application/xml" },
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildBridgeTwiml(toPhone: string): string {
  // Brief Say + Dial. The Say uses Twilio's polly voice for clearer
  // English than the legacy "alice" voice. callerId defaults to whatever
  // From was set on the original call (TWILIO_FROM_NUMBER) — we don't
  // override it here so caller ID stays consistent.
  const safeNumber = escapeXml(toPhone);
  return `<Response>
  <Say voice="Polly.Joanna">Connecting you to your ${escapeXml(FIRM_SHORT)} partner now.</Say>
  <Dial timeout="25" answerOnBridge="true">${safeNumber}</Dial>
</Response>`;
}

function handle(req: NextRequest): NextResponse {
  const to = req.nextUrl.searchParams.get("to") || "";
  if (!to || !/^\+[1-9]\d{6,14}$/.test(to)) {
    return twiml(
      `<Response><Say voice="Polly.Joanna">Invalid destination number. Goodbye.</Say><Hangup/></Response>`
    );
  }
  return twiml(buildBridgeTwiml(to));
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
