import { NextRequest, NextResponse } from "next/server";
import { verifyWidgetJwt, getCorsHeaders } from "@/lib/widget-auth";
import Anthropic from "@anthropic-ai/sdk";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

let _client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!ANTHROPIC_API_KEY) return null;
  if (!_client) _client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  return _client;
}

const rateLimits = new Map<string, number[]>();

function checkChatRateLimit(sessionId: string): boolean {
  const now = Date.now();
  const window = 5 * 60 * 1000;
  const max = 10;
  const timestamps = (rateLimits.get(sessionId) || []).filter((t) => now - t < window);
  if (timestamps.length >= max) return false;
  timestamps.push(now);
  rateLimits.set(sessionId, timestamps);
  return true;
}

const SYSTEM_PROMPT = `You are the Fintella Widget Help Assistant — a friendly, concise expert on the Fintella TMS Widget.

You help customs brokers and freight forwarders set up and use the Fintella tariff recovery widget inside their Transportation Management System (CargoWise, Magaya, or any browser-based TMS).

Your knowledge covers:

**Setup & Installation:**
- Generating an API key from the TMS Widget page in the Fintella partner portal
- Installing in CargoWise: System → Custom Panels → Create new Web Panel → paste widget URL
- Installing in Magaya: similar custom panel/iframe approach
- Generic: any browser TMS can embed via iframe (420×600px recommended)
- Widget URL format: https://fintella.partners/widget?apiKey=YOUR_KEY
- Allowed Origin field: optional CORS restriction

**Widget Features:**
- Dashboard tab: shows referral count, commissions earned/pending, recent referrals
- Calculator tab: manual entry (country, date, value) or document upload (CF 7501 PDF/images)
- Refer tab: submit client referrals with company name, contact info, import value, HTS codes
- Info tab: 3-step process overview, $47K average refund, qualification criteria
- Help tab: this chat assistant

**Troubleshooting:**
- "Widget Not Authorized": API key missing or invalid — regenerate from TMS Widget page
- CORS errors: check Allowed Origin matches your TMS domain exactly
- "Rate limited": max 20 requests/hour per key — wait and retry
- Widget not loading: check iframe dimensions (420×600), ensure HTTPS
- Auth token expired: widget auto-refreshes every 4 hours

**Commission Structure:**
- Partners earn their assigned rate (10-25%) on recovered tariff refunds
- Commissions are tracked automatically when referrals convert
- Paid when the client receives their refund — no risk, no upfront cost

Keep responses SHORT (2-4 sentences max). Be helpful and specific. If you don't know something, say so and suggest contacting support at support@fintella.partners.`;

function extractToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(req.headers.get("origin"), null),
  });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin, null);

  const token = extractToken(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: cors });
  }

  const payload = verifyWidgetJwt(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401, headers: cors });
  }

  if (!checkChatRateLimit(payload.sid)) {
    return NextResponse.json(
      { error: "Rate limited — max 10 messages per 5 minutes" },
      { status: 429, headers: cors }
    );
  }

  const client = getClient();
  if (!client) {
    return NextResponse.json(
      { reply: "AI assistant is not configured. Please contact support@fintella.partners for help." },
      { headers: cors }
    );
  }

  try {
    const body = await req.json();
    const messages: { role: "user" | "assistant"; content: string }[] = body.messages || [];
    const last10 = messages.slice(-10);

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: last10.map((m) => ({ role: m.role, content: m.content })),
    });

    const reply = response.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return NextResponse.json({ reply }, { headers: cors });
  } catch (err) {
    console.error("[widget/chat] error:", err);
    return NextResponse.json(
      { reply: "Sorry, I encountered an error. Please try again or contact support@fintella.partners." },
      { headers: cors }
    );
  }
}
