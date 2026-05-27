import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") || "";
  const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCronAuth) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((session.user as any).role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const deals = await prisma.deal.findMany({
    where: { epLevel1: null },
    select: { id: true, dealName: true, rawPayload: true, partnerCode: true },
  });

  const results: Array<{ id: string; dealName: string; partnerCode: string; epLevel1: string }> = [];

  for (const deal of deals) {
    if (!deal.rawPayload) continue;

    let payloads: string[] = [];
    try {
      const parsed = JSON.parse(deal.rawPayload);
      if (Array.isArray(parsed)) {
        payloads = parsed.map((e: any) => typeof e === "string" ? e : e.body || "");
      } else {
        payloads = [deal.rawPayload];
      }
    } catch {
      payloads = [deal.rawPayload];
    }

    let epValue: string | null = null;
    for (const p of payloads) {
      try {
        const obj = JSON.parse(p);
        const val = obj.ep1_level || obj.ep1Level || null;
        if (val) { epValue = String(val); break; }
      } catch {
        const m = p.match(/"ep1_level"\s*:\s*"([^"]+)"/);
        if (m) { epValue = m[1]; break; }
      }
    }

    if (epValue) {
      await prisma.deal.update({
        where: { id: deal.id },
        data: { epLevel1: epValue },
      });
      results.push({ id: deal.id, dealName: deal.dealName, partnerCode: deal.partnerCode, epLevel1: epValue });
    }
  }

  return NextResponse.json({
    scanned: deals.length,
    fixed: results.length,
    results,
  });
}
