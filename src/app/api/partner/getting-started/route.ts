import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { computeGettingStarted, updateOnboardingState } from "@/lib/getting-started";

const ALLOWED_ACTIONS = new Set([
  "dismiss",
  "undismiss",
  "mark_video_watched",
  "mark_call_joined",
  "mark_training_completed",
  "mark_link_shared",
]);

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const partnerCode = (session.user as { partnerCode?: string }).partnerCode;
  if (!partnerCode) {
    return NextResponse.json({ error: "Not a partner" }, { status: 403 });
  }

  try {
    const result = await computeGettingStarted(partnerCode);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[getting-started GET] error:", err);
    return NextResponse.json({ error: "Failed to load checklist" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const partnerCode = (session.user as { partnerCode?: string }).partnerCode;
  if (!partnerCode) {
    return NextResponse.json({ error: "Not a partner" }, { status: 403 });
  }

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action;
  if (!action || !ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  try {
    const result = await updateOnboardingState(partnerCode, action as Parameters<typeof updateOnboardingState>[1]);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[getting-started PATCH] error:", err);
    return NextResponse.json({ error: "Failed to update checklist" }, { status: 500 });
  }
}
