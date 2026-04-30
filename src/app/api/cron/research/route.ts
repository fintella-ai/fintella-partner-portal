import { NextRequest, NextResponse } from "next/server";
import { runResearchCycle } from "@/lib/ai-research";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runResearchCycle();
  return NextResponse.json(result);
}
