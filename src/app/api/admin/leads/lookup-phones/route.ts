import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["super_admin", "admin"];

/**
 * POST /api/admin/leads/lookup-phones
 * Looks up phone types for specific leads (by ID) or auto-picks unchecked ones.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.includes((session.user as any).role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const SID = process.env.TWILIO_ACCOUNT_SID;
  const TOKEN = process.env.TWILIO_AUTH_TOKEN;

  let body: any = {};
  try { body = await req.json(); } catch {}
  const requestedIds: string[] | undefined = body?.leadIds;

  let leads;
  if (Array.isArray(requestedIds) && requestedIds.length > 0) {
    leads = await prisma.partnerLead.findMany({
      where: { id: { in: requestedIds }, phone: { not: null } },
      select: { id: true, phone: true, notes: true },
    });
  } else {
    const unchecked = await prisma.partnerLead.findMany({
      where: { phone: { not: null }, NOT: { notes: { contains: "Phone Type:" } } },
      select: { id: true, phone: true, notes: true },
      take: 100,
    });
    const unknown = unchecked.length < 100
      ? await prisma.partnerLead.findMany({
          where: { phone: { not: null }, notes: { contains: "Phone Type: unknown" } },
          select: { id: true, phone: true, notes: true },
          take: 100 - unchecked.length,
        })
      : [];
    leads = [...unchecked, ...unknown];
  }

  if (leads.length === 0) {
    return NextResponse.json({ looked_up: 0, message: "No leads to look up" });
  }

  function stripOldPhoneType(notes: string): string {
    return notes.split("\n").filter((l) => !l.startsWith("Phone Type:")).join("\n");
  }

  if (!SID || !TOKEN) {
    let updated = 0;
    for (const lead of leads) {
      const clean = stripOldPhoneType(lead.notes || "");
      await prisma.partnerLead.update({
        where: { id: lead.id },
        data: { notes: [clean, "Phone Type: unknown (Twilio not configured)"].filter(Boolean).join("\n") },
      });
      updated++;
    }
    return NextResponse.json({ looked_up: updated, demo: true, message: "Twilio not configured" });
  }

  let looked_up = 0;
  let errors = 0;
  const auth64 = Buffer.from(`${SID}:${TOKEN}`).toString("base64");

  for (const lead of leads) {
    const phone = (lead.phone || "").replace(/[^+\d]/g, "");
    if (!phone || phone.length < 10) continue;
    const formatted = phone.startsWith("+") ? phone : `+1${phone.replace(/^1/, "")}`;

    try {
      const res = await fetch(
        `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(formatted)}?Fields=line_type_intelligence`,
        { headers: { Authorization: `Basic ${auth64}` } }
      );
      if (!res.ok) { errors++; continue; }
      const data = await res.json();
      const lineType = data.line_type_intelligence?.type || "unknown";
      const clean = stripOldPhoneType(lead.notes || "");
      await prisma.partnerLead.update({
        where: { id: lead.id },
        data: { notes: [clean, `Phone Type: ${lineType}`].filter(Boolean).join("\n") },
      });
      looked_up++;
    } catch { errors++; }
  }

  return NextResponse.json({ looked_up, errors, remaining: leads.length - looked_up - errors });
}
