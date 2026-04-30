import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runDeepResearch } from "@/lib/ai-research";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!role || !["super_admin", "admin"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const topic = body.topic as string;

  if (!topic?.trim()) {
    return NextResponse.json({ error: "Topic required" }, { status: 400 });
  }

  const result = await runDeepResearch(topic.trim());
  return NextResponse.json(result);
}
