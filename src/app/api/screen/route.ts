import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

const SCREENING_SYSTEM = `You are a friendly AI assistant for Fintella Partners, helping screen potential clients for IEEPA tariff refund services.

Your job is to have a brief, natural conversation (3-5 questions) to determine if this prospect is worth a partner's time. You are NOT a lawyer and NEVER give legal advice or say "you qualify."

SCREENING CRITERIA (internal — don't reveal these):
- HOT (score 70-100): Imports $500K+/year, pays tariffs, interested in recovery, decision-maker
- WARM (score 40-69): Imports goods, may pay tariffs, curious but not committed
- COLD (score 0-39): Doesn't import, no tariffs, not interested, or not a decision-maker

CONVERSATION FLOW:
1. Greet warmly, ask what their company does and if they import goods
2. Ask roughly how much they spend on import duties/tariffs annually
3. Ask what types of products they import (helps determine tariff eligibility)
4. Ask if they're the person who handles trade/customs decisions
5. If promising, offer to book a call: "I'd love to connect you with one of our specialists who can walk you through how the recovery process works. Can I get your best contact info?"

RULES:
- Keep responses under 3 sentences
- Never say "you qualify" or "you're eligible" — say "this sounds like it could be worth exploring"
- Never discuss specific dollar amounts for potential recovery
- Never give legal advice
- Be conversational, not robotic
- If clearly unqualified (no imports, no tariffs), politely thank them and end the conversation

When you have enough info to score, include a JSON block at the end of your LAST message (after the 4th or 5th exchange):
<!--SCORE:{"score":75,"hot":true,"summary":"$2M annual imports, electronics from China, CFO, interested"}-->

The user won't see this block — it's parsed by the system.`;

type Message = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, partnerCode } = body as { messages: Message[]; partnerCode?: string };

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages required" }, { status: 400 });
    }

    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({
        reply: "Thanks for your interest! Our screening assistant isn't available right now. Please contact your partner representative directly.",
        score: null,
        done: true,
      });
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 512,
        system: SCREENING_SYSTEM,
        messages,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({
        reply: "I'm having a brief technical issue. Could you try again in a moment?",
        score: null,
        done: false,
      });
    }

    const data = await res.json();
    const rawReply = data.content?.[0]?.text || "Thanks for chatting! Let me connect you with a specialist.";

    const scoreMatch = rawReply.match(/<!--SCORE:(.*?)-->/);
    let score: { score: number; hot: boolean; summary: string } | null = null;
    let cleanReply = rawReply.replace(/<!--SCORE:.*?-->/, "").trim();

    if (scoreMatch) {
      try {
        score = JSON.parse(scoreMatch[1]);
      } catch {}
    }

    if (score && partnerCode) {
      const prospectData: Record<string, string> = {};
      for (const msg of messages) {
        if (msg.role === "user") {
          const text = msg.content.toLowerCase();
          if (text.includes("@")) prospectData.email = msg.content;
          if (/\d{3}.*\d{4}/.test(text)) prospectData.phone = msg.content;
        }
      }

      await prisma.partnerProspect.create({
        data: {
          partnerCode,
          companyName: score.summary.split(",")[0] || "AI-Screened Lead",
          contactName: prospectData.email?.split("@")[0] || "Unknown",
          contactEmail: prospectData.email || null,
          contactPhone: prospectData.phone || null,
          stage: score.hot ? "qualified" : score.score >= 40 ? "contacted" : "new",
          score: score.score,
          source: "ai_screener",
          notes: `AI Screening Summary: ${score.summary}`,
          aiScreeningData: JSON.stringify({ messages, score }),
        },
      }).catch(() => {});
    }

    return NextResponse.json({
      reply: cleanReply,
      score: score ? { score: score.score, hot: score.hot } : null,
      done: !!score,
    });
  } catch (err) {
    console.error("[screen] error:", err);
    return NextResponse.json({
      reply: "Thanks for your patience. Could you try again?",
      score: null,
      done: false,
    }, { status: 500 });
  }
}
