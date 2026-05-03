/**
 * Template Performance Decay Detection
 *
 * Computes baseline vs current open/click rates for each EmailTemplate using
 * real SendGrid event data (EmailEvent + EmailLog). Flags templates whose
 * current 7-day engagement has dropped >20% from their first-30-day baseline.
 *
 * If EmailEvent data is sparse (no events at all), returns gracefully with
 * empty results rather than throwing.
 */

import { prisma } from "@/lib/prisma";

export interface DecayResult {
  templatesAnalyzed: number;
  decaying: string[];
  healthy: string[];
}

/** Minimum sends in the baseline window to consider the baseline reliable. */
const MIN_BASELINE_SENDS = 50;

/** Decay threshold: current must be >20% worse than baseline to flag. */
const DECAY_THRESHOLD = -20;

/**
 * Compute open rate and click rate for a given template key within a date range.
 * Uses EmailLog (sends) + EmailEvent (opens/clicks) for real metrics.
 */
async function computeRates(
  templateKey: string,
  from: Date,
  to: Date
): Promise<{ openRate: number; clickRate: number; sampleSize: number }> {
  // Count total delivered sends in the window
  const totalSends = await prisma.emailLog.count({
    where: {
      template: templateKey,
      status: "sent",
      createdAt: { gte: from, lte: to },
    },
  });

  if (totalSends === 0) {
    return { openRate: 0, clickRate: 0, sampleSize: 0 };
  }

  // Get providerMessageIds for sends in this window so we can match events
  const sends = await prisma.emailLog.findMany({
    where: {
      template: templateKey,
      status: "sent",
      createdAt: { gte: from, lte: to },
      providerMessageId: { not: null },
    },
    select: { providerMessageId: true },
  });

  const messageIds = sends
    .map((s) => s.providerMessageId)
    .filter((id): id is string => id !== null);

  if (messageIds.length === 0) {
    // Sends exist but none have providerMessageId (demo sends) — no events possible
    return { openRate: 0, clickRate: 0, sampleSize: totalSends };
  }

  // Count unique opens — deduplicate by providerMessageId to get unique openers
  const uniqueOpens = await prisma.emailEvent.groupBy({
    by: ["providerMessageId"],
    where: {
      providerMessageId: { in: messageIds },
      event: "open",
    },
  });

  // Count unique clicks — deduplicate by providerMessageId
  const uniqueClicks = await prisma.emailEvent.groupBy({
    by: ["providerMessageId"],
    where: {
      providerMessageId: { in: messageIds },
      event: "click",
    },
  });

  const openRate = (uniqueOpens.length / totalSends) * 100;
  const clickRate = (uniqueClicks.length / totalSends) * 100;

  return { openRate, clickRate, sampleSize: totalSends };
}

/**
 * Detect performance decay across all email templates.
 *
 * For each EmailTemplate:
 *   1. Find its earliest send date from EmailLog
 *   2. Compute baseline rates from first 30 days of sends
 *   3. Compute current rates from the last 7 days
 *   4. If baseline has >= MIN_BASELINE_SENDS and current open rate is
 *      >20% worse than baseline, flag as decaying
 *   5. Upsert TemplatePerformanceBaseline record
 *   6. Create Notification for super_admin on first decay detection
 */
export async function detectTemplateDecay(): Promise<DecayResult> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get all email templates
  const templates = await prisma.emailTemplate.findMany({
    where: { enabled: true },
    select: { key: true, name: true },
  });

  if (templates.length === 0) {
    return { templatesAnalyzed: 0, decaying: [], healthy: [] };
  }

  const decaying: string[] = [];
  const healthy: string[] = [];

  for (const template of templates) {
    // Find earliest send for this template to define the baseline window
    const earliestSend = await prisma.emailLog.findFirst({
      where: { template: template.key, status: "sent" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });

    if (!earliestSend) {
      // No sends yet — skip
      continue;
    }

    // Baseline: first 30 days from earliest send
    const baselineEnd = new Date(
      earliestSend.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000
    );
    const baseline = await computeRates(
      template.key,
      earliestSend.createdAt,
      baselineEnd
    );

    // Current: last 7 days
    const current = await computeRates(template.key, sevenDaysAgo, now);

    // Determine decay
    let isDecaying = false;
    let decayPercent: number | null = null;

    if (
      baseline.sampleSize >= MIN_BASELINE_SENDS &&
      baseline.openRate > 0 &&
      current.sampleSize > 0
    ) {
      // Percentage change in open rate: ((current - baseline) / baseline) * 100
      decayPercent =
        ((current.openRate - baseline.openRate) / baseline.openRate) * 100;
      decayPercent = Math.round(decayPercent * 100) / 100; // round to 2 decimals

      if (decayPercent <= DECAY_THRESHOLD) {
        isDecaying = true;
      }
    }

    // Check if this is a NEW decay detection (wasn't decaying before)
    const existing = await prisma.templatePerformanceBaseline.findUnique({
      where: { templateKey: template.key },
    });
    const isNewDecay = isDecaying && (!existing || !existing.isDecaying);

    // Upsert the baseline record
    await prisma.templatePerformanceBaseline.upsert({
      where: { templateKey: template.key },
      create: {
        templateKey: template.key,
        templateType: "email",
        baselineOpenRate: baseline.openRate,
        baselineClickRate: baseline.clickRate,
        baselineSampleSize: baseline.sampleSize,
        currentOpenRate: current.openRate,
        currentClickRate: current.clickRate,
        currentSampleSize: current.sampleSize,
        isDecaying,
        decayPercent,
        decayDetectedAt: isDecaying ? now : null,
        lastComputedAt: now,
      },
      update: {
        baselineOpenRate: baseline.openRate,
        baselineClickRate: baseline.clickRate,
        baselineSampleSize: baseline.sampleSize,
        currentOpenRate: current.openRate,
        currentClickRate: current.clickRate,
        currentSampleSize: current.sampleSize,
        isDecaying,
        decayPercent,
        decayDetectedAt: isDecaying
          ? existing?.decayDetectedAt ?? now
          : null,
        lastComputedAt: now,
      },
    });

    if (isDecaying) {
      decaying.push(template.key);
    } else {
      healthy.push(template.key);
    }

    // Notify super_admin on first detection of decay
    if (isNewDecay) {
      await prisma.notification.create({
        data: {
          recipientType: "admin",
          recipientId: "super_admin",
          type: "template_decay",
          title: "Template Performance Decay Detected",
          message: `Template "${template.name}" (${template.key}) open rate has dropped ${Math.abs(decayPercent ?? 0)}% from baseline. Current: ${current.openRate.toFixed(1)}%, Baseline: ${baseline.openRate.toFixed(1)}%.`,
          link: "/admin/communications?tab=templates",
        },
      });
    }
  }

  console.log(
    `[template-decay] Analyzed ${templates.length} templates: ${decaying.length} decaying, ${healthy.length} healthy`
  );

  return {
    templatesAnalyzed: templates.length,
    decaying,
    healthy,
  };
}
