import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateEmail } from "@/lib/email-validation";

const ADMIN_ROLES = ["super_admin", "admin"];

/**
 * POST /api/admin/leads/validate-emails
 * Batch email validation. Processes leads that:
 * 1. Don't have any Email Verdict yet, OR
 * 2. Have "Email Verdict: unknown" (needs re-validation)
 * Up to 50 per call.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.includes((session.user as any).role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

  const leads = [...unchecked, ...unknown];

  if (leads.length === 0) {
    return NextResponse.json({ validated: 0, message: "All leads with real emails already validated" });
  }

  let validated = 0;
  let errors = 0;

  for (const lead of leads) {
    try {
      const result = await validateEmail(lead.email);
      const tag = `Email Verdict: ${result.verdict} (${result.method}, score: ${result.score.toFixed(2)}${result.isDisposable ? ", disposable" : ""})`;

      const existingNotes = (lead.notes || "")
        .split("\n")
        .filter((line) => !line.startsWith("Email Verdict:"))
        .join("\n");

      await prisma.partnerLead.update({
        where: { id: lead.id },
        data: {
          notes: [existingNotes, tag].filter(Boolean).join("\n"),
        },
      });
      validated++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({ validated, errors, total: leads.length });
}
