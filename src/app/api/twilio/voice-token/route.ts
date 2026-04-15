import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * GET /api/twilio/voice-token
 *
 * Admin-only. Mints a short-lived Twilio Voice Access Token that the
 * in-browser softphone (src/components/ui/SoftPhone.tsx) uses to
 * authenticate a WebRTC Device with Twilio. The Device can then dial
 * partners via Device.connect({ To: "+1..." }).
 *
 * Env vars required for a real token (all four):
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_API_KEY_SID        (create under Twilio → Account → API keys)
 *   TWILIO_API_KEY_SECRET
 *   TWILIO_TWIML_APP_SID      (TwiML app pointing at /api/twilio/voice-webhook)
 *
 * Demo mode: if ANY of the above are unset, returns
 *   { demo: true, error: "twilio_not_configured" }
 * and the softphone UI shows the demo banner instead of attempting
 * a real Device.register().
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as any).role;
  if (!["super_admin", "admin", "accounting", "partner_support"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

  if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
    return NextResponse.json({
      demo: true,
      error: "twilio_not_configured",
      missing: [
        !accountSid && "TWILIO_ACCOUNT_SID",
        !apiKeySid && "TWILIO_API_KEY_SID",
        !apiKeySecret && "TWILIO_API_KEY_SECRET",
        !twimlAppSid && "TWILIO_TWIML_APP_SID",
      ].filter(Boolean),
    });
  }

  // Dynamic import so the dev bundle doesn't need twilio installed
  // when running in demo mode.
  const twilio = (await import("twilio")).default;
  const { AccessToken } = twilio.jwt;
  const { VoiceGrant } = AccessToken;

  const identity = (session.user as any).email || "admin";

  const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
    identity,
    ttl: 3600, // 1 hour
  });

  const grant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: false, // admins don't receive calls on the softphone yet
  });
  token.addGrant(grant);

  return NextResponse.json({
    token: token.toJwt(),
    identity,
    ttl: 3600,
  });
}
