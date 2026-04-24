import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * One-time backfill for the commission-status lifecycle refactor.
 * Renames any legacy CommissionLedger row whose status is still
 * "pending" (from before the 2026-04-23 lifecycle change) to the
 * new canonical "pending_payment" value.
 *
 * Safe to run multiple times — idempotent (only touches rows whose
 * status still equals "pending"). Rows that were already migrated
 * (or created under the new flow) aren't affected.
 *
 * Super-admin only.
 */

export async function GET(req: NextRequest) {
  return handle(req, /* dryRun */ true);
}

export async function POST(req: NextRequest) {
  return handle(req, /* dryRun */ false);
}

async function handle(req: NextRequest, dryRun: boolean) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden — super admin only" }, { status: 403 });
  }

  try {
    const candidates = await prisma.commissionLedger.count({
      where: { status: "pending" },
    });

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        candidates,
        message:
          candidates === 0
            ? "No legacy rows to migrate."
            : `Would rename ${candidates} CommissionLedger row(s) from status="pending" → status="pending_payment". POST to this endpoint to commit.`,
      });
    }

    const result = await prisma.commissionLedger.updateMany({
      where: { status: "pending" },
      data: { status: "pending_payment" },
    });

    // Also flip Deal.l{1,2,3}CommissionStatus mirror fields that still
    // carry the legacy "pending" value so the deal detail + reporting
    // views match the ledger.
    const l1 = await prisma.deal.updateMany({
      where: { l1CommissionStatus: "pending" },
      data: { l1CommissionStatus: "pending_payment" },
    });
    const l2 = await prisma.deal.updateMany({
      where: { l2CommissionStatus: "pending" },
      data: { l2CommissionStatus: "pending_payment" },
    });
    const l3 = await prisma.deal.updateMany({
      where: { l3CommissionStatus: "pending" },
      data: { l3CommissionStatus: "pending_payment" },
    });

    return NextResponse.json({
      ok: true,
      ledgerRowsUpdated: result.count,
      dealMirrorsUpdated: { l1: l1.count, l2: l2.count, l3: l3.count },
    });
  } catch (err: any) {
    console.error("[migrate-commission-statuses]", err);
    return NextResponse.json({ error: err?.message || "Migration failed" }, { status: 500 });
  }
}
