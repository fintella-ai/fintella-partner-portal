import { prisma } from "@/lib/prisma";

/**
 * Predictive Send-Time Optimization
 *
 * Analyzes EmailEvent open/click data to determine the optimal hour (UTC)
 * and day of week for sending emails to each partner. Falls back to the
 * default Tue/Thu 9AM EST schedule when no engagement data exists.
 */

// Default fallback: Tuesday 9AM EST = 14:00 UTC (EST = UTC-5)
const DEFAULT_BEST_HOUR_UTC = 14;
const DEFAULT_BEST_DAY_OF_WEEK = 2; // Tuesday
const DEFAULT_TIMEZONE = "America/New_York";

interface EngagementBucket {
  partnerCode: string;
  hourUtc: number;
  dayOfWeek: number;
  count: number;
}

interface ComputeResult {
  partnersAnalyzed: number;
  updated: number;
  avgOpenRate: number;
}

/**
 * Compute optimal send times for all partners based on the last 90 days
 * of EmailEvent open/click data. Upserts PartnerEngagementWindow records.
 */
export async function computeOptimalSendTimes(): Promise<ComputeResult> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // ── 1. Fetch engagement events (opens + clicks) from last 90 days ────────
  let events: Array<{
    partnerCode: string | null;
    timestamp: Date;
  }>;

  try {
    events = await prisma.emailEvent.findMany({
      where: {
        event: { in: ["open", "click"] },
        partnerCode: { not: null },
        timestamp: { gte: ninetyDaysAgo },
      },
      select: {
        partnerCode: true,
        timestamp: true,
      },
    });
  } catch {
    // EmailEvent table might not exist or be empty — graceful fallback
    console.log("[send-time-optimizer] EmailEvent query failed, returning empty results");
    return { partnersAnalyzed: 0, updated: 0, avgOpenRate: 0 };
  }

  if (events.length === 0) {
    return { partnersAnalyzed: 0, updated: 0, avgOpenRate: 0 };
  }

  // ── 2. Group by partnerCode + hour + dayOfWeek ───────────────────────────
  const buckets = new Map<string, EngagementBucket[]>();

  for (const event of events) {
    if (!event.partnerCode) continue;

    const hourUtc = event.timestamp.getUTCHours();
    const dayOfWeek = event.timestamp.getUTCDay(); // 0=Sun

    if (!buckets.has(event.partnerCode)) {
      buckets.set(event.partnerCode, []);
    }

    const partnerBuckets = buckets.get(event.partnerCode)!;
    const existing = partnerBuckets.find(
      (b) => b.hourUtc === hourUtc && b.dayOfWeek === dayOfWeek
    );

    if (existing) {
      existing.count++;
    } else {
      partnerBuckets.push({
        partnerCode: event.partnerCode,
        hourUtc,
        dayOfWeek,
        count: 1,
      });
    }
  }

  // ── 3. Compute total emails sent per partner for open rate ────────────────
  const emailsSent = new Map<string, number>();
  try {
    const logs = await prisma.emailLog.groupBy({
      by: ["partnerCode"],
      where: {
        partnerCode: { not: null },
        status: "sent",
        createdAt: { gte: ninetyDaysAgo },
      },
      _count: { id: true },
    });
    for (const log of logs) {
      if (log.partnerCode) {
        emailsSent.set(log.partnerCode, log._count.id);
      }
    }
  } catch {
    // EmailLog groupBy failed — continue without open rate
    console.log("[send-time-optimizer] EmailLog groupBy failed, open rates will be null");
  }

  // ── 4. Find best hour + day per partner and upsert ────────────────────────
  let updated = 0;
  let totalOpenRate = 0;
  let partnersWithRate = 0;

  for (const [partnerCode, partnerBuckets] of Array.from(buckets.entries())) {
    // Find the bucket with the highest engagement count
    const best = partnerBuckets.reduce((a, b) => (a.count > b.count ? a : b));
    const sampleSize = partnerBuckets.reduce((sum, b) => sum + b.count, 0);

    // Compute open rate: total opens / total emails sent
    const sent = emailsSent.get(partnerCode) || 0;
    const openRate = sent > 0 ? sampleSize / sent : null;

    if (openRate !== null) {
      totalOpenRate += openRate;
      partnersWithRate++;
    }

    await prisma.partnerEngagementWindow.upsert({
      where: { partnerCode },
      create: {
        partnerCode,
        bestHourUtc: best.hourUtc,
        bestDayOfWeek: best.dayOfWeek,
        openRate,
        sampleSize,
        computedAt: new Date(),
      },
      update: {
        bestHourUtc: best.hourUtc,
        bestDayOfWeek: best.dayOfWeek,
        openRate,
        sampleSize,
        computedAt: new Date(),
      },
    });

    updated++;
  }

  const avgOpenRate =
    partnersWithRate > 0
      ? Math.round((totalOpenRate / partnersWithRate) * 10000) / 10000
      : 0;

  return {
    partnersAnalyzed: buckets.size,
    updated,
    avgOpenRate,
  };
}

/**
 * Get the optimal send time for a specific partner.
 * Returns computed data if available, otherwise falls back to
 * Tue/Thu 9AM EST default.
 */
export async function getOptimalSendTime(partnerCode: string): Promise<{
  bestHourUtc: number;
  bestDayOfWeek: number;
  timezone: string;
  isDefault: boolean;
  openRate: number | null;
  sampleSize: number;
}> {
  try {
    const window = await prisma.partnerEngagementWindow.findUnique({
      where: { partnerCode },
    });

    if (window && window.bestHourUtc !== null && window.bestDayOfWeek !== null && window.sampleSize > 0) {
      return {
        bestHourUtc: window.bestHourUtc,
        bestDayOfWeek: window.bestDayOfWeek,
        timezone: window.timezone,
        isDefault: false,
        openRate: window.openRate,
        sampleSize: window.sampleSize,
      };
    }
  } catch {
    // Table might not exist yet — fall through to default
  }

  // Fallback: Tue/Thu 9AM EST
  return {
    bestHourUtc: DEFAULT_BEST_HOUR_UTC,
    bestDayOfWeek: DEFAULT_BEST_DAY_OF_WEEK,
    timezone: DEFAULT_TIMEZONE,
    isDefault: true,
    openRate: null,
    sampleSize: 0,
  };
}
