import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateEmail } from "@/lib/email-validation";

const ADMIN_ROLES = ["super_admin", "admin"];

/**
 * POST /api/admin/leads/validate-emails
 * Validates emails for specific leads (by ID) or auto-picks unvalidated ones.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.includes((session.user as any).role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any = {};
  try { body = await req.json(); } catch {}
  const requestedIds: string[] | undefined = body?.leadIds;

  let leads;
  if (Array.isArray(requestedIds) && requestedIds.length > 0) {
    leads = await prisma.partnerLead.findMany({
      where: {
        id: { in: requestedIds },
        NOT: { email: { contains: "@import.placeholder" } },
      },
      select: { id: true, email: true, notes: true },
    });
  } else {
    const unchecked = await prisma.partnerLead.findMany({
      where: {
        NOT: [
          { email: { contains: "@import.placeholder" } },
          { notes: { contains: "Email Verdict:" } },
        ],
      },
      select: { id: true, email: true, notes: true },
      take: 50,
    });
    const unknown = unchecked.length < 50
      ? await prisma.partnerLead.findMany({
          where: {
            notes: { contains: "Email Verdict: unknown" },
            NOT: { email: { contains: "@import.placeholder" } },
          },
          select: { id: true, email: true, notes: true },
          take: 50 - unchecked.length,
        })
      : [];
    leads = [...unchecked, ...unknown];
  }

  if (leads.length === 0) {
    return NextResponse.json({ validated: 0, message: "No leads to validate" });
  }

  let validated = 0;
  let errors = 0;

  for (const lead of leads) {
    try {
      const result = await validateEmail(lead.email);
      const tag = `Email Verdict: ${result.verdict} (${result.method}, score: ${result.score.toFixed(2)}${result.isDisposable ? ", disposable" : ""})`;
      const existingNotes = (lead.notes || "").split("\n").filter((line) => !line.startsWith("Email Verdict:")).join("\n");
      await prisma.partnerLead.update({
        where: { id: lead.id },
        data: { notes: [existingNotes, tag].filter(Boolean).join("\n") },
      });
      validated++;
    } catch { errors++; }
  }

  return NextResponse.json({ validated, errors, total: leads.length });
}
