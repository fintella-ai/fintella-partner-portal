import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Daily cron: converts widget-demo PartnerApplication rows into PartnerLead
 * rows so they auto-enter the broker outreach drip campaign.
 *
 * Schedule: 0 14 * * * (2 PM UTC = 9 AM ET)
 * Auth: Bearer CRON_SECRET
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find widget_demo applications that are still "new" status
  const demoApps = await prisma.partnerApplication.findMany({
    where: {
      utmSource: "widget_demo",
      status: "new",
    },
  });

  if (demoApps.length === 0) {
    return NextResponse.json({
      enqueued: 0,
      message: "No new widget demo applications to process",
      timestamp: new Date().toISOString(),
    });
  }

  // Get emails of existing PartnerLeads to avoid duplicates
  const demoEmails = demoApps.map((a) => a.email.toLowerCase());
  const existingLeads = await prisma.partnerLead.findMany({
    where: { email: { in: demoEmails } },
    select: { email: true },
  });
  const existingEmailSet = new Set(existingLeads.map((l) => l.email));

  let enqueued = 0;
  let skippedDuplicate = 0;

  for (const app of demoApps) {
    const normalizedEmail = app.email.toLowerCase();

    if (existingEmailSet.has(normalizedEmail)) {
      // Lead already exists — still mark application as contacted to prevent
      // re-processing, but don't create a duplicate lead
      skippedDuplicate++;
      await prisma.partnerApplication.update({
        where: { id: app.id },
        data: { status: "contacted" },
      });
      continue;
    }

    // Split name for PartnerLead creation
    const firstName = app.firstName?.trim() || "Unknown";
    const lastName = app.lastName?.trim() || "Prospect";

    await prisma.$transaction([
      prisma.partnerLead.create({
        data: {
          firstName,
          lastName,
          email: normalizedEmail,
          phone: app.phone || null,
          source: "widget_demo",
          status: "prospect",
          notes: `Auto-enqueued from widget demo application. Company: ${app.companyName || "N/A"}. Partner type: customs_broker.`,
          // Default commission settings for broker leads
          commissionRate: 0.20,
          tier: "l2",
          referredByCode: "PTNS4XDMN",
        },
      }),
      prisma.partnerApplication.update({
        where: { id: app.id },
        data: { status: "contacted" },
      }),
    ]);

    enqueued++;
    existingEmailSet.add(normalizedEmail); // prevent duplicates within same batch
  }

  console.log(
    `[demo-to-drip] Enqueued ${enqueued} new leads, skipped ${skippedDuplicate} duplicates`,
  );

  return NextResponse.json({
    enqueued,
    skippedDuplicate,
    total: demoApps.length,
    timestamp: new Date().toISOString(),
  });
}
