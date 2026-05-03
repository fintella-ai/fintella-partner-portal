import { prisma } from "@/lib/prisma";

// ─── Cross-Partner Communications Graph ─────────────────────────────────────
// Correlates email template sends with downstream partner actions (deals,
// referrals, recruitment) to identify revenue-driving communication patterns.
//
// Algorithm:
// 1. Pull all EmailLog records from the last 90 days with partnerCode + template
// 2. For each email, check if the receiving partner (or their downline) performed
//    a downstream action within 14 days of the send
// 3. Create/update CommsGraphEdge records for each correlation found
// 4. Compute CommsGraphSummary per template key with conversion rate and revenue
// ────────────────────────────────────────────────────────────────────────────────

const LOOKBACK_DAYS = 90;
const ACTION_WINDOW_DAYS = 14;

interface EdgeUpsertKey {
  sourcePartnerCode: string;
  targetPartnerCode: string;
  edgeType: string;
  templateKey: string | null;
}

interface EdgeAccumulator {
  key: EdgeUpsertKey;
  occurrences: number;
  daysToAction: number[];
  lastOccurredAt: Date;
}

interface SummaryAccumulator {
  templateKey: string;
  totalSends: number;
  sendsFollowedByAction: number;
  daysToAction: number[];
  actionCounts: Record<string, number>;
  revenueTotal: number;
}

interface CommsGraphResult {
  edgesCreated: number;
  edgesUpdated: number;
  summariesComputed: number;
  topTemplates: Array<{ key: string; conversionRate: number }>;
}

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Build the cross-partner communications graph by correlating email sends
 * with downstream partner activity (deals, referrals, recruitment).
 */
export async function buildCommsGraph(): Promise<CommsGraphResult> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);

  // 1. Fetch all email logs from the lookback window that have a partnerCode
  const emailLogs = await prisma.emailLog.findMany({
    where: {
      createdAt: { gte: cutoff },
      partnerCode: { not: null },
      status: { in: ["sent", "demo"] },
    },
    select: {
      id: true,
      partnerCode: true,
      template: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (emailLogs.length === 0) {
    return { edgesCreated: 0, edgesUpdated: 0, summariesComputed: 0, topTemplates: [] };
  }

  // Collect all unique partner codes that received emails
  const partnerCodes = Array.from(
    new Set(emailLogs.map((l) => l.partnerCode).filter(Boolean) as string[])
  );

  // 2. Fetch downstream actions for all relevant partners in bulk
  const actionWindow = new Date();
  actionWindow.setDate(actionWindow.getDate() - LOOKBACK_DAYS + ACTION_WINDOW_DAYS);

  // Deals created by these partners
  const deals = await prisma.deal.findMany({
    where: {
      partnerCode: { in: partnerCodes },
      createdAt: { gte: cutoff },
    },
    select: {
      partnerCode: true,
      createdAt: true,
      firmFeeAmount: true,
    },
  });

  // Partners recruited by these partners (downline recruitment)
  const recruits = await prisma.partner.findMany({
    where: {
      referredByPartnerCode: { in: partnerCodes },
      createdAt: { gte: cutoff },
    },
    select: {
      referredByPartnerCode: true,
      partnerCode: true,
      createdAt: true,
    },
  });

  // Widget referrals submitted by these partners (via partnerId -> partnerCode lookup)
  const partnersWithIds = await prisma.partner.findMany({
    where: { partnerCode: { in: partnerCodes } },
    select: { id: true, partnerCode: true },
  });
  const partnerIdToCode = new Map(partnersWithIds.map((p) => [p.id, p.partnerCode]));
  const partnerIds = partnersWithIds.map((p) => p.id);

  const widgetReferrals = await prisma.widgetReferral.findMany({
    where: {
      partnerId: { in: partnerIds },
      createdAt: { gte: cutoff },
    },
    select: {
      partnerId: true,
      createdAt: true,
    },
  });

  // Index downstream actions by partnerCode for fast lookup
  const dealsByPartner = new Map<string, Array<{ createdAt: Date; firmFeeAmount: number }>>();
  for (const d of deals) {
    const arr = dealsByPartner.get(d.partnerCode) || [];
    arr.push({ createdAt: d.createdAt, firmFeeAmount: d.firmFeeAmount });
    dealsByPartner.set(d.partnerCode, arr);
  }

  const recruitsByPartner = new Map<
    string,
    Array<{ partnerCode: string; createdAt: Date }>
  >();
  for (const r of recruits) {
    if (!r.referredByPartnerCode) continue;
    const arr = recruitsByPartner.get(r.referredByPartnerCode) || [];
    arr.push({ partnerCode: r.partnerCode, createdAt: r.createdAt });
    recruitsByPartner.set(r.referredByPartnerCode, arr);
  }

  const referralsByPartner = new Map<string, Array<{ createdAt: Date }>>();
  for (const wr of widgetReferrals) {
    const code = partnerIdToCode.get(wr.partnerId);
    if (!code) continue;
    const arr = referralsByPartner.get(code) || [];
    arr.push({ createdAt: wr.createdAt });
    referralsByPartner.set(code, arr);
  }

  // 3. Correlate: for each email send, check if the target partner acted within 14 days
  const edgeMap = new Map<string, EdgeAccumulator>();
  const summaryMap = new Map<string, SummaryAccumulator>();

  for (const log of emailLogs) {
    const pc = log.partnerCode!;
    const templateKey = log.template;
    const sendDate = log.createdAt;
    const windowEnd = new Date(sendDate.getTime() + ACTION_WINDOW_DAYS * 86400000);

    // Ensure summary accumulator exists
    if (!summaryMap.has(templateKey)) {
      summaryMap.set(templateKey, {
        templateKey,
        totalSends: 0,
        sendsFollowedByAction: 0,
        daysToAction: [],
        actionCounts: {},
        revenueTotal: 0,
      });
    }
    const summary = summaryMap.get(templateKey)!;
    summary.totalSends++;

    let foundAction = false;

    // Check deals created within the action window
    const partnerDeals = dealsByPartner.get(pc) || [];
    for (const deal of partnerDeals) {
      if (deal.createdAt >= sendDate && deal.createdAt <= windowEnd) {
        const days = daysBetween(sendDate, deal.createdAt);
        const edgeKey = `${pc}|${pc}|email_then_deal|${templateKey}`;

        if (!edgeMap.has(edgeKey)) {
          edgeMap.set(edgeKey, {
            key: {
              sourcePartnerCode: pc,
              targetPartnerCode: pc,
              edgeType: "email_then_deal",
              templateKey,
            },
            occurrences: 0,
            daysToAction: [],
            lastOccurredAt: deal.createdAt,
          });
        }
        const edge = edgeMap.get(edgeKey)!;
        edge.occurrences++;
        edge.daysToAction.push(days);
        if (deal.createdAt > edge.lastOccurredAt) {
          edge.lastOccurredAt = deal.createdAt;
        }

        summary.actionCounts["email_then_deal"] =
          (summary.actionCounts["email_then_deal"] || 0) + 1;
        summary.revenueTotal += deal.firmFeeAmount || 0;

        if (!foundAction) {
          summary.sendsFollowedByAction++;
          summary.daysToAction.push(days);
          foundAction = true;
        }
      }
    }

    // Check widget referrals within the action window
    const partnerReferrals = referralsByPartner.get(pc) || [];
    for (const ref of partnerReferrals) {
      if (ref.createdAt >= sendDate && ref.createdAt <= windowEnd) {
        const days = daysBetween(sendDate, ref.createdAt);
        const edgeKey = `${pc}|${pc}|email_then_referral|${templateKey}`;

        if (!edgeMap.has(edgeKey)) {
          edgeMap.set(edgeKey, {
            key: {
              sourcePartnerCode: pc,
              targetPartnerCode: pc,
              edgeType: "email_then_referral",
              templateKey,
            },
            occurrences: 0,
            daysToAction: [],
            lastOccurredAt: ref.createdAt,
          });
        }
        const edge = edgeMap.get(edgeKey)!;
        edge.occurrences++;
        edge.daysToAction.push(days);
        if (ref.createdAt > edge.lastOccurredAt) {
          edge.lastOccurredAt = ref.createdAt;
        }

        summary.actionCounts["email_then_referral"] =
          (summary.actionCounts["email_then_referral"] || 0) + 1;

        if (!foundAction) {
          summary.sendsFollowedByAction++;
          summary.daysToAction.push(days);
          foundAction = true;
        }
      }
    }

    // Check recruitment within the action window
    const partnerRecruits = recruitsByPartner.get(pc) || [];
    for (const rec of partnerRecruits) {
      if (rec.createdAt >= sendDate && rec.createdAt <= windowEnd) {
        const days = daysBetween(sendDate, rec.createdAt);
        const edgeKey = `${pc}|${rec.partnerCode}|recruitment|${templateKey}`;

        if (!edgeMap.has(edgeKey)) {
          edgeMap.set(edgeKey, {
            key: {
              sourcePartnerCode: pc,
              targetPartnerCode: rec.partnerCode,
              edgeType: "recruitment",
              templateKey,
            },
            occurrences: 0,
            daysToAction: [],
            lastOccurredAt: rec.createdAt,
          });
        }
        const edge = edgeMap.get(edgeKey)!;
        edge.occurrences++;
        edge.daysToAction.push(days);
        if (rec.createdAt > edge.lastOccurredAt) {
          edge.lastOccurredAt = rec.createdAt;
        }

        summary.actionCounts["recruitment"] =
          (summary.actionCounts["recruitment"] || 0) + 1;

        if (!foundAction) {
          summary.sendsFollowedByAction++;
          summary.daysToAction.push(days);
          foundAction = true;
        }
      }
    }
  }

  // 4. Upsert edges
  let edgesCreated = 0;
  let edgesUpdated = 0;

  for (const edge of Array.from(edgeMap.values())) {
    const avgDays =
      edge.daysToAction.length > 0
        ? Math.round(
            (edge.daysToAction.reduce((a, b) => a + b, 0) / edge.daysToAction.length) *
              100
          ) / 100
        : null;

    try {
      const result = await prisma.commsGraphEdge.upsert({
        where: {
          sourcePartnerCode_targetPartnerCode_edgeType_templateKey: {
            sourcePartnerCode: edge.key.sourcePartnerCode,
            targetPartnerCode: edge.key.targetPartnerCode,
            edgeType: edge.key.edgeType,
            templateKey: edge.key.templateKey ?? "",
          },
        },
        create: {
          sourcePartnerCode: edge.key.sourcePartnerCode,
          targetPartnerCode: edge.key.targetPartnerCode,
          edgeType: edge.key.edgeType,
          templateKey: edge.key.templateKey,
          weight: edge.occurrences,
          avgDaysToAction: avgDays,
          lastOccurredAt: edge.lastOccurredAt,
        },
        update: {
          weight: edge.occurrences,
          avgDaysToAction: avgDays,
          lastOccurredAt: edge.lastOccurredAt,
        },
      });
      // Check if it was a create or update by comparing createdAt/updatedAt
      if (
        result.createdAt.getTime() === result.updatedAt.getTime() ||
        result.updatedAt.getTime() - result.createdAt.getTime() < 1000
      ) {
        edgesCreated++;
      } else {
        edgesUpdated++;
      }
    } catch (e) {
      // Handle null templateKey in the unique constraint by using empty string
      console.error("[comms-graph] Edge upsert error:", e);
    }
  }

  // 5. Compute and upsert summaries
  let summariesComputed = 0;

  for (const summary of Array.from(summaryMap.values())) {
    const conversionRate =
      summary.totalSends > 0
        ? Math.round((summary.sendsFollowedByAction / summary.totalSends) * 10000) /
          10000
        : 0;

    const avgDays =
      summary.daysToAction.length > 0
        ? Math.round(
            (summary.daysToAction.reduce((a, b) => a + b, 0) /
              summary.daysToAction.length) *
              100
          ) / 100
        : null;

    // Determine top downstream action
    let topAction: string | null = null;
    let topCount = 0;
    for (const [action, count] of Object.entries(summary.actionCounts)) {
      if (count > topCount) {
        topAction = action;
        topCount = count;
      }
    }

    await prisma.commsGraphSummary.upsert({
      where: { templateKey: summary.templateKey },
      create: {
        templateKey: summary.templateKey,
        templateType: "email",
        totalSends: summary.totalSends,
        sendsFollowedByAction: summary.sendsFollowedByAction,
        conversionRate,
        avgDaysToAction: avgDays,
        topDownstreamAction: topAction,
        revenueCorrelation:
          summary.revenueTotal > 0 ? Math.round(summary.revenueTotal * 100) / 100 : null,
        computedAt: new Date(),
      },
      update: {
        totalSends: summary.totalSends,
        sendsFollowedByAction: summary.sendsFollowedByAction,
        conversionRate,
        avgDaysToAction: avgDays,
        topDownstreamAction: topAction,
        revenueCorrelation:
          summary.revenueTotal > 0 ? Math.round(summary.revenueTotal * 100) / 100 : null,
        computedAt: new Date(),
      },
    });
    summariesComputed++;
  }

  // 6. Compute top templates for the return value
  const allSummaries = Array.from(summaryMap.values())
    .filter((s) => s.totalSends >= 2) // need at least 2 sends for meaningful rate
    .sort((a, b) => {
      const rateA =
        a.totalSends > 0 ? a.sendsFollowedByAction / a.totalSends : 0;
      const rateB =
        b.totalSends > 0 ? b.sendsFollowedByAction / b.totalSends : 0;
      return rateB - rateA;
    })
    .slice(0, 10);

  const topTemplates = allSummaries.map((s) => ({
    key: s.templateKey,
    conversionRate:
      s.totalSends > 0
        ? Math.round((s.sendsFollowedByAction / s.totalSends) * 10000) / 10000
        : 0,
  }));

  console.log(
    `[comms-graph] Complete: ${edgesCreated} edges created, ${edgesUpdated} updated, ${summariesComputed} summaries`
  );

  return { edgesCreated, edgesUpdated, summariesComputed, topTemplates };
}

/**
 * Retrieve computed comms graph data for the admin dashboard.
 * Returns all summaries sorted by conversion rate + top 10 edges by weight.
 */
export async function getCommsGraphData() {
  const [summaries, topEdges] = await Promise.all([
    prisma.commsGraphSummary.findMany({
      orderBy: { conversionRate: "desc" },
    }),
    prisma.commsGraphEdge.findMany({
      orderBy: { weight: "desc" },
      take: 10,
    }),
  ]);

  return { summaries, topEdges };
}
