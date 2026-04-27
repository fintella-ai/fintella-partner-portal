import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "super_admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!ANTHROPIC_API_KEY)
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 400 });

  const idea = await prisma.devIdea.findUnique({ where: { id: params.id } });
  if (!idea) return NextResponse.json({ error: "Idea not found" }, { status: 404 });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: `You are a senior software architect planning features for the Fintella Partner Portal — a Next.js 14 + Prisma + Neon PostgreSQL + Vercel app. The portal manages partner referral networks for IEEPA tariff refund services.

When given a feature idea, produce TWO sections:

## Clarifying Questions
Ask 3-5 specific questions that would help refine the implementation. Focus on edge cases, UX decisions, and integration points.

## Implementation Plan
A step-by-step plan that a developer can paste into Claude Code terminal to implement. Include:
1. Schema changes (Prisma models)
2. API routes needed
3. UI components to create/modify
4. Key files to touch
5. Testing checklist

Format the plan as a copy-paste-ready Claude Code prompt wrapped in a code block, starting with "cd /Users/johnorlandorobotax/tariff-partner-portal/tariff-partner-portal" and describing exactly what to build.

Keep it practical — this is a real production app with real users.`,
        messages: [{
          role: "user",
          content: `Feature idea: ${idea.title}\n\nDescription: ${idea.description}\n\nCategory: ${idea.category}\nPriority: ${idea.priority}${idea.adminNotes ? `\n\nAdmin notes: ${idea.adminNotes}` : ""}`,
        }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json({ error: `AI API error: ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    const content = data.content?.[0]?.text || "";

    const questionsMatch = content.match(/## Clarifying Questions\n([\s\S]*?)(?=## Implementation Plan|$)/);
    const planMatch = content.match(/## Implementation Plan\n([\s\S]*)/);

    await prisma.devIdea.update({
      where: { id: params.id },
      data: {
        aiQuestions: questionsMatch?.[1]?.trim() || null,
        aiPlan: planMatch?.[1]?.trim() || content,
        status: idea.status === "idea" ? "planning" : idea.status,
      },
    });

    return NextResponse.json({
      success: true,
      aiQuestions: questionsMatch?.[1]?.trim() || null,
      aiPlan: planMatch?.[1]?.trim() || content,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
