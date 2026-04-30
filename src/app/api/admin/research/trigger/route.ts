import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runResearchCycle } from "@/lib/ai-research";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role as string | undefined;
  if (!role || !["super_admin", "admin"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await runResearchCycle();
  return NextResponse.json(result);
}
