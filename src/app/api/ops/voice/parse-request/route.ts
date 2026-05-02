import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

/* ─── Anthropic client (lazy, cached) ───────────────────────────────── */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

let _client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!ANTHROPIC_API_KEY) return null;
  if (!_client) _client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  return _client;
}

/* ─── System prompt ─────────────────────────────────────────────────── */

const SYSTEM_PROMPT = `You are a request parser for the Fintella Ops Center. Your job is to extract structured data from a voice-dictated natural language request.

Parse the input into the following JSON structure:
{
  "type": "time_bound" | "due_by" | "open_ended",
  "recipientName": "name of the person the request is for (if mentioned)",
  "title": "short summary (max 80 chars)",
  "body": "longer description if the input has more detail",
  "proposedTime": "ISO 8601 datetime if a specific meeting/call time is mentioned",
  "dueBy": "ISO 8601 datetime if a deadline is mentioned"
}

Rules:
- "time_bound": the request is for a specific time (meeting, call, review at X)
- "due_by": the request has a deadline but not a specific meeting time
- "open_ended": no specific time or deadline, just a general ask
- For relative dates like "tomorrow", "next Friday", "by end of week", calculate from the current date/time provided
- If no recipient is mentioned, set recipientName to null
- Title should be action-oriented ("Review payout report", "Schedule sync call")
- Body should capture extra context the title doesn't cover, null if none
- Always return valid JSON, nothing else

Current date/time: {{CURRENT_DATETIME}}
Available team members: {{TEAM_MEMBERS}}`;

/* ─── POST handler ──────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { text?: string; entityId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { text, entityId } = body;
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  /* ── Fetch team members for name matching ────────────────────────── */
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true },
  });
  const teamList = users
    .map((u) => `${u.name || u.email} (id: ${u.id})`)
    .join(", ");

  /* ── Demo gate: if no API key, return a mock parse ───────────────── */
  const client = getClient();
  if (!client) {
    const mockParsed = buildMockParse(text.trim(), users);
    return NextResponse.json({
      parsed: mockParsed,
      confidence: 0.6,
      demo: true,
    });
  }

  /* ── Call Claude ─────────────────────────────────────────────────── */
  try {
    const now = new Date().toISOString();
    const systemPrompt = SYSTEM_PROMPT
      .replace("{{CURRENT_DATETIME}}", now)
      .replace("{{TEAM_MEMBERS}}", teamList || "none loaded");

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: text.trim() }],
    });

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    /* Parse JSON from Claude's response — handle markdown code fences */
    const jsonStr = raw.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI response", raw },
        { status: 502 }
      );
    }

    /* Match recipientName to a real user ID */
    let recipientId: string | undefined;
    const recipientName = (parsed.recipientName as string) || undefined;
    if (recipientName) {
      const match = users.find(
        (u) =>
          u.name?.toLowerCase().includes(recipientName.toLowerCase()) ||
          u.email.toLowerCase().includes(recipientName.toLowerCase())
      );
      if (match) recipientId = match.id;
    }

    /* Compute confidence based on how many fields were filled */
    let confidence = 0.5;
    if (parsed.title) confidence += 0.15;
    if (parsed.type) confidence += 0.1;
    if (recipientId) confidence += 0.15;
    if (parsed.proposedTime || parsed.dueBy) confidence += 0.1;
    confidence = Math.min(confidence, 1);

    return NextResponse.json({
      parsed: {
        type: parsed.type || "open_ended",
        recipientId,
        recipientName,
        title: parsed.title || text.trim().slice(0, 80),
        body: parsed.body || null,
        proposedTime: parsed.proposedTime || null,
        dueBy: parsed.dueBy || null,
      },
      confidence,
    });
  } catch (e: unknown) {
    console.error("[voice/parse-request] Claude error:", e);
    /* Fallback to mock on API errors so the UI stays functional */
    const mockParsed = buildMockParse(text.trim(), users);
    return NextResponse.json({
      parsed: mockParsed,
      confidence: 0.3,
      fallback: true,
    });
  }
}

/* ─── Mock parser (used when ANTHROPIC_API_KEY is unset) ────────────── */

function buildMockParse(
  text: string,
  users: Array<{ id: string; name: string | null; email: string }>
) {
  const lower = text.toLowerCase();

  /* Guess type from keywords */
  let type: "time_bound" | "due_by" | "open_ended" = "open_ended";
  if (/\b(meet|call|sync|at \d|schedule)\b/.test(lower)) type = "time_bound";
  else if (/\b(by|deadline|before|due|until|end of)\b/.test(lower)) type = "due_by";

  /* Try to find a name match */
  let recipientId: string | undefined;
  let recipientName: string | undefined;
  for (const u of users) {
    const name = u.name?.toLowerCase() || "";
    const firstName = name.split(" ")[0];
    if (firstName && lower.includes(firstName)) {
      recipientId = u.id;
      recipientName = u.name || u.email;
      break;
    }
  }

  /* Build a rough title */
  const title = text.slice(0, 80);

  /* Rough date extraction */
  let proposedTime: string | null = null;
  let dueBy: string | null = null;
  const now = new Date();
  if (/tomorrow/i.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    if (type === "time_bound") proposedTime = d.toISOString();
    else dueBy = d.toISOString();
  }
  if (/friday/i.test(text)) {
    const d = new Date(now);
    const day = d.getDay();
    const diff = ((5 - day + 7) % 7) || 7;
    d.setDate(d.getDate() + diff);
    d.setHours(17, 0, 0, 0);
    if (type === "time_bound") proposedTime = d.toISOString();
    else dueBy = d.toISOString();
  }

  return {
    type,
    recipientId,
    recipientName,
    title,
    body: text.length > 80 ? text : null,
    proposedTime,
    dueBy,
  };
}
