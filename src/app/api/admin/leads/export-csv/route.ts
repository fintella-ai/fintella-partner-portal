import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!["super_admin", "admin"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const filter = req.nextUrl.searchParams.get("filter") || "all";

  const leads = await prisma.partnerLead.findMany({
    where: { source: "cbp_listing" },
    orderBy: { createdAt: "asc" },
  });

  const processed = leads.map((l) => {
    const notes = l.notes || "";
    const filerCode = l.filerCode || (notes.match(/Filer Code: (\w+)/)?.[1] || "");
    const location = notes.match(/Location: (.+)/)?.[1] || l.state || "";
    const brokerName = `${l.firstName} ${l.lastName}`.trim();
    const rawPhone = (l.phone || "").trim();
    const phone = rawPhone.replace(/ x.*/, "").trim();
    const ext = rawPhone.match(/x(\d+)/)?.[1] || "";
    const email = l.email.includes("@import.placeholder") ? "" : l.email;
    const hasValidPhone = !!phone && phone.length >= 10 && !phone.includes("placeholder");
    const hasValidEmail = !!email && email.includes("@");

    let validation = "No Contact";
    if (hasValidPhone && hasValidEmail) validation = "SMS + Email Ready";
    else if (hasValidPhone) validation = "SMS Ready";
    else if (hasValidEmail) validation = "Email Only";

    return { filerCode, brokerName, location, phone, ext, email, validation, hasValidPhone, hasValidEmail, status: l.status, emailsSent: l.emailsSent };
  });

  const filtered = filter === "sms_ready" ? processed.filter((r) => r.hasValidPhone)
    : filter === "email_ready" ? processed.filter((r) => r.hasValidEmail)
    : filter === "call_only" ? processed.filter((r) => r.hasValidPhone && !r.hasValidEmail)
    : processed;

  const headers = ["FILER CODE", "BROKER NAME", "TITLE", "LOCATION", "PHONE", "EXT", "TYPE", "EMAIL", "VALIDATION", "LEAD STATUS", "EMAILS SENT"];
  const rows = filtered.map((r) => [
    esc(r.filerCode),
    esc(r.brokerName),
    "",
    esc(r.location),
    esc(r.phone),
    esc(r.ext),
    "customs_broker",
    esc(r.email),
    r.validation,
    r.status,
    String(r.emailsSent),
  ].join(","));

  const csv = [headers.join(","), ...rows].join("\n");
  const label = filter === "all" ? "all" : filter;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fintella-brokers-${label}-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}

function esc(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
