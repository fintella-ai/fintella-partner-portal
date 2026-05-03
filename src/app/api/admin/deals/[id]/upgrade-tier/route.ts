import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeDealCommissions, roundCents } from "@/lib/commission";
import { logAudit } from "@/lib/audit-log";

/**
 * POST /api/admin/deals/[id]/upgrade-tier
 *
 * Upgrades a Tier 2 deal (client is NOT the Importer of Record) to Tier 1
 * (client IS the IOR). This happens when the client becomes the IOR mid-case.
 *
 * Retroactively recalculates commissions at full rates (no 50% cut) and
 * updates existing CommissionLedger entries. Only super_admin may invoke.
 *
 * Body: { reason: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden — only super_admin can upgrade deal tiers" }, { status: 403 });
  }

  const adminEmail = (session.user as any).email || "unknown";
  const adminName = (session.user as any).name || adminEmail;

  try {
    const body = await req.json();
    const reason = (body.reason || "").trim();
    if (!reason) {
      return NextResponse.json({ error: "A reason for the upgrade is required" }, { status: 400 });
    }

    const deal = await prisma.deal.findUnique({ where: { id: params.id } });
    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    if (deal.isImporterOfRecord) {
      return NextResponse.json(
        { error: "Deal is already Tier 1 (Importer of Record)" },
        { status: 400 }
      );
    }

    // Capture previous commission amounts for the response
    const previousAmounts = {
      l1: roundCents(deal.l1CommissionAmount),
      l2: roundCents(deal.l2CommissionAmount),
      l3: roundCents(deal.l3CommissionAmount),
      total: roundCents(deal.l1CommissionAmount + deal.l2CommissionAmount + deal.l3CommissionAmount),
    };

    // Check for existing ledger entries to recalculate
    const existingLedger = await prisma.commissionLedger.findMany({
      where: { dealId: deal.id },
    });

    // Recompute commissions at full Tier 1 rates (isImporterOfRecord: true)
    const computed = deal.firmFeeAmount > 0
      ? await computeDealCommissions(prisma, {
          partnerCode: deal.partnerCode,
          firmFeeAmount: deal.firmFeeAmount,
          isImporterOfRecord: true,
        })
      : null;

    const result = await prisma.$transaction(async (tx) => {
      // Build the deal update payload
      const dealUpdate: Record<string, any> = {
        isImporterOfRecord: true,
        serviceOfInterest: "Tariff Refund Support (Tier 1)",
      };

      // If we have recomputed commissions, update deal-level snapshots
      if (computed && computed.entries.length > 0) {
        const l1Entry = computed.entries.find((e) => e.tier === "l1");
        const l2Entry = computed.entries.find((e) => e.tier === "l2");
        const l3Entry = computed.entries.find((e) => e.tier === "l3");
        dealUpdate.l1CommissionAmount = l1Entry ? roundCents(l1Entry.amount) : 0;
        dealUpdate.l2CommissionAmount = l2Entry ? roundCents(l2Entry.amount) : 0;
        dealUpdate.l3CommissionAmount = l3Entry ? roundCents(l3Entry.amount) : 0;
      }

      const updatedDeal = await tx.deal.update({
        where: { id: deal.id },
        data: dealUpdate,
      });

      // Update existing ledger entries with recalculated amounts
      let ledgerUpdated = 0;
      if (existingLedger.length > 0 && computed && computed.entries.length > 0) {
        for (const entry of computed.entries) {
          const existing = existingLedger.find(
            (l) => l.partnerCode === entry.partnerCode && l.tier === entry.tier
          );
          if (existing) {
            await tx.commissionLedger.update({
              where: { id: existing.id },
              data: { amount: roundCents(entry.amount) },
            });
            ledgerUpdated++;
          }
        }
      }

      // Create a DealNote documenting the upgrade
      const noteContent =
        `Deal upgraded from Tier 2 to Tier 1 by ${adminName}: ${reason}. ` +
        (computed && computed.entries.length > 0
          ? `Commission amounts recalculated at full rates. ` +
            `Previous total: $${previousAmounts.total.toFixed(2)} → New total: $${computed.totalAmount.toFixed(2)}. ` +
            computed.entries
              .map((e) => `${e.tier.toUpperCase()} ${e.partnerCode} $${roundCents(e.amount).toFixed(2)}`)
              .join(", ") +
            "."
          : "No commission recalculation needed (no firm fee or ledger entries).");

      await tx.dealNote.create({
        data: {
          dealId: deal.id,
          content: noteContent,
          authorName: adminName,
          authorEmail: adminEmail,
        },
      });

      // Notify the submitting partner about the upgrade
      await tx.notification.create({
        data: {
          recipientType: "partner",
          recipientId: deal.partnerCode,
          type: "deal_update",
          title: "Deal Upgraded to Tier 1",
          message: `Your deal "${deal.dealName}" has been upgraded from Tier 2 to Tier 1 (Importer of Record). Commission rates have been adjusted to full rates.`,
          link: `/dashboard/deals`,
        },
      });

      return { updatedDeal, ledgerUpdated };
    });

    const newAmounts = {
      l1: roundCents(result.updatedDeal.l1CommissionAmount),
      l2: roundCents(result.updatedDeal.l2CommissionAmount),
      l3: roundCents(result.updatedDeal.l3CommissionAmount),
      total: roundCents(
        result.updatedDeal.l1CommissionAmount +
        result.updatedDeal.l2CommissionAmount +
        result.updatedDeal.l3CommissionAmount
      ),
    };

    logAudit({
      action: "deal.upgrade_tier",
      actorEmail: session.user.email || "unknown",
      actorRole: role,
      actorId: session.user.id,
      targetType: "deal",
      targetId: deal.id,
      details: {
        reason,
        previousAmounts,
        newAmounts,
        ledgerEntriesUpdated: result.ledgerUpdated,
      },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      previousAmounts,
      newAmounts,
      ledgerEntriesUpdated: result.ledgerUpdated,
    });
  } catch (e) {
    console.error("upgrade-tier error:", e);
    return NextResponse.json({ error: "Failed to upgrade deal tier" }, { status: 500 });
  }
}
