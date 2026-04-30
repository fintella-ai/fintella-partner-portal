/**
 * AI Knowledge Base — Initial seed entries
 *
 * Seeds 8 foundational knowledge entries covering CAPE system, broker
 * guidance, strategy tips, and legal guidance. All entries are
 * pre-approved and marked as SYSTEM_SEED. Idempotent — skips if any
 * SYSTEM_SEED entries already exist.
 *
 * Called from scripts/seed-all.js during Vercel build.
 */

import { PrismaClient } from "@prisma/client";

const SEED_ENTRIES = [
  {
    title: "CAPE System Overview",
    content: `The CAPE (Customs Automated Protest and Entry) system is CBP's electronic platform for processing duty refund requests related to IEEPA tariffs. CAPE allows importers and their authorized representatives (customs brokers or attorneys) to file refund claims for overpaid duties resulting from reciprocal tariffs imposed under the International Emergency Economic Powers Act.

Key facts:
- CAPE is accessed through the ACE (Automated Commercial Environment) portal
- Filing requires an ACE account with proper power of attorney on file
- CAPE accepts both individual entry-level claims and batch CSV uploads
- Processing times vary from 60-180 days depending on complexity
- Refunds are issued via ACH to the importer's bank account on file with CBP
- There is no filing fee charged by CBP for CAPE submissions
- Each entry can only have one active CAPE claim at a time

Phase 2 of CAPE expanded the system to handle additional tariff types including Section 232 and Section 301 duties alongside IEEPA reciprocal tariffs.`,
    category: "CAPE_UPDATE",
    source: "System Knowledge Base",
  },
  {
    title: "CAPE Error Codes & Rejection Reasons",
    content: `Common CAPE rejection codes and how to resolve them:

- ERR-001: Invalid entry number format — Entry numbers must be 11 digits. Check for leading zeros.
- ERR-002: Entry not found in ACE — The entry may not have been liquidated yet, or the number is incorrect.
- ERR-003: Duplicate CAPE claim — An active claim already exists for this entry. Check claim status first.
- ERR-004: Insufficient documentation — Additional supporting documents required (e.g., CF7501, commercial invoice).
- ERR-005: Power of Attorney not on file — The filer must have a valid, current POA for the importer.
- ERR-006: Entry date outside eligible window — CAPE claims must be filed within 180 days of liquidation.
- ERR-007: HTS classification mismatch — The tariff code on the claim doesn't match the original entry.
- ERR-008: Refund amount exceeds duties paid — The requested refund cannot exceed the total duties assessed.
- ERR-009: ACH enrollment required — The importer's ACH bank information must be on file with CBP.
- ERR-010: Entry previously protested — Entries with pending or decided protests cannot have simultaneous CAPE claims.

Resolution tip: Most rejections (60%+) are ERR-005 (missing POA) or ERR-002 (unliquidated entries). Always verify POA status and entry liquidation before filing.`,
    category: "CAPE_UPDATE",
    source: "System Knowledge Base",
  },
  {
    title: "CAPE ACE Reports Guide",
    content: `Essential ACE reports for CAPE claim management:

REV-603 (Entry Summary Query): Primary lookup tool. Search by entry number, importer ID, or date range. Shows entry-level details including duties paid, HTS codes, and liquidation status.

REV-613 (CAPE Status Report): Shows the current status of all CAPE claims filed under your account. Statuses include: Received, Under Review, Approved, Paid, Rejected, and Withdrawn.

REV-615 (CAPE Payment Report): Lists all approved CAPE refund payments including payment dates, amounts, and ACH transaction IDs. Use this to reconcile refund receipts with your records.

Tips for using ACE reports effectively:
- Run REV-603 before filing to confirm entry eligibility and liquidation status
- Export REV-613 weekly to track claim progress and identify stalled claims
- Cross-reference REV-615 with bank statements to confirm receipt of refunds
- Save report exports as documentation for your records and client reporting`,
    category: "CAPE_UPDATE",
    source: "System Knowledge Base",
  },
  {
    title: "Broker vs Law Firm: CAPE Filing Comparison",
    content: `Understanding the difference between customs broker CAPE filings and law firm CAPE filings:

Customs Brokers:
- File CAPE claims directly through their own ACE account
- Already have existing importer POAs on file
- Typically charge per-entry filing fees ($50-200/entry)
- Familiar with ACE system and entry-level data
- Limited to administrative filing — cannot represent clients in disputes
- Revenue model: flat fee per filing or percentage of refund

Law Firms:
- File through attorney-in-fact powers or broker partners
- Must obtain specific CAPE filing authorization from importers
- Typically work on contingency (20-35% of recovered refunds)
- Can represent clients in CIT (Court of International Trade) appeals
- Handle complex cases involving protests, classification disputes
- Revenue model: contingency fee on successful recovery

Fintella's model: We partner with qualified law firms who handle the legal filing and representation. Partners refer importers, earning commissions on successful recoveries. The law firm handles all CAPE filings, legal analysis, and dispute resolution. This gives importers the benefit of legal expertise while partners earn without needing customs brokerage licenses.`,
    category: "BROKER_GUIDANCE",
    source: "System Knowledge Base",
  },
  {
    title: "Identifying Qualifying Importers",
    content: `How to identify importers who may qualify for IEEPA tariff refunds:

Qualifying criteria:
1. The importer paid duties on goods subject to IEEPA reciprocal tariffs (HTS Chapter 99, Subchapter III)
2. The entries were imported during the eligible period (varies by executive order)
3. The entries have been liquidated by CBP (check via REV-603)
4. No existing CAPE claim or protest is pending on the entries
5. The importer has ACH enrollment with CBP (or is willing to enroll)

Best prospect industries (highest IEEPA tariff exposure):
- Electronics and technology hardware importers
- Automotive parts and accessories
- Industrial machinery and equipment
- Consumer goods (apparel, furniture, household items)
- Chemical and pharmaceutical raw materials
- Agricultural products from tariff-affected countries

Red flags (likely disqualified):
- Importers who have already filed CAPE claims through a broker
- Entries subject to anti-dumping or countervailing duties (AD/CVD)
- Entries that were entered under a temporary importation bond (TIB)
- Foreign trade zone (FTZ) entries with duty deferral

Conversation starters for partners:
- "Have you reviewed your import duties from the past 2 years?"
- "Are you aware of the IEEPA tariff refund program?"
- "Would you like a free analysis of your potential refund amount?"`,
    category: "STRATEGY_TIP",
    source: "System Knowledge Base",
  },
  {
    title: "Partner Referral Pitch Template",
    content: `Proven pitch framework for partner referrals:

Opening (choose one):
- "I work with a firm that helps importers recover overpaid tariffs. Are your clients paying duties on products from [China/EU/other tariff-affected countries]?"
- "Did you know that many importers are sitting on unclaimed refunds from IEEPA tariff overpayments? I can connect your clients with experts who handle the recovery process."

Value proposition:
- No upfront cost to the importer — recovery is on contingency
- Average refund per qualifying importer: $50,000-$500,000+
- Process is handled entirely by experienced trade law professionals
- No disruption to the importer's ongoing business operations
- Free initial analysis to determine eligibility and estimated refund

Objection handlers:
- "We already have a broker" → "Great — this is complementary. Your broker handles entries, we handle the refund recovery that brokers typically don't pursue."
- "We don't import much" → "Even moderate importers often qualify. A free 5-minute analysis of your entry data can tell us quickly."
- "We've already looked into this" → "The rules change frequently. New executive orders have expanded eligibility. Let us do a fresh review at no cost."

Close:
- "I can set up a 15-minute call with our trade law team. They'll review your entry data confidentially and give you a refund estimate within 48 hours."`,
    category: "STRATEGY_TIP",
    source: "System Knowledge Base",
  },
  {
    title: "IEEPA Executive Order Timeline",
    content: `Timeline of key IEEPA tariff executive orders affecting refund eligibility:

Executive Order 14257 (Feb 2025): Imposed initial IEEPA fentanyl-related tariffs on Chinese imports. 10% additional duty on all goods from China.

Executive Order 14262 (Mar 2025): Increased China tariff rate from 10% to 20%. Also imposed 25% tariff on Canadian and Mexican imports.

Executive Order 14270 (Apr 2025): Reciprocal tariffs — baseline 10% tariff on imports from all countries, with higher "reciprocal" rates for countries identified as having unfair trade barriers (e.g., 34% for China, 20% for EU, 24% for Japan, 32% for Taiwan).

Executive Order 14277 (Apr 2025): 90-day pause on reciprocal tariff rates above 10% for most countries. China tariffs increased to 145%. EU, Japan, Taiwan, and others reduced to baseline 10% during pause period.

Key dates for refund eligibility:
- Entries during the "90-day pause" period may qualify for refund of amounts above 10%
- Entries from China at 145% may qualify for partial refunds if rates are subsequently reduced
- The specific eligible date ranges depend on which executive order applies and any subsequent modifications

Note: This timeline is subject to change. Executive orders can be modified or revoked at any time. Always verify current rates at CBP.gov or via the Fintella tariff calculator.`,
    category: "LEGAL_GUIDANCE",
    source: "System Knowledge Base",
  },
  {
    title: "Commission Structure Explained",
    content: `How Fintella partner commissions work:

The Waterfall Model:
Total partner commission on every deal is capped at 25% of the firm fee. This 25% is split across up to three partner tiers in a "waterfall" structure.

Tier Rates:
- L1 Partners: Earn 25% on direct deals they personally refer. When their downline generates deals, the L1 earns an override (the difference between 25% and the L2's rate).
- L2 Partners (recruited by L1): Earn 10%, 15%, or 20% (set by their L1 when recruiting). The L1's override is 25% minus the L2's rate.
- L3 Partners (recruited by L2, if enabled): Earn 10% or 15%. L2 gets override of L2 rate minus L3 rate. L1 still gets 25% minus L2 rate.

Example (L2 at 15%):
- Firm fee: $100,000
- 25% total commission pool: $25,000
- L2 referrer earns: $15,000 (15%)
- L1 override earns: $10,000 (10%, which is 25% - 15%)
- Total paid out: $25,000 (always equals 25%)

Payment timing:
- Commissions accrue when a deal reaches "Closed Won" status
- Status moves to "due" when the firm confirms payment to Fintella
- Admin creates payout batches to process "due" commissions
- Partners receive payment via their configured payout method (ACH, wire, or check)

Important notes:
- Commission rates are locked at the time of deal creation
- Changing a partner's rate does not retroactively affect existing deals
- The 25% cap is absolute — the total across all tiers never exceeds it`,
    category: "GENERAL",
    source: "System Knowledge Base",
  },
];

export async function seedKnowledgeBase(prisma: PrismaClient) {
  // Idempotent check — skip if we already have system seed entries
  const existingCount = await prisma.knowledgeEntry.count({
    where: { sourceType: "SYSTEM_SEED" },
  });

  if (existingCount > 0) {
    console.log(`✓ Knowledge base: ${existingCount} system entries already exist, skipping seed`);
    return;
  }

  let created = 0;
  for (const entry of SEED_ENTRIES) {
    try {
      await prisma.knowledgeEntry.create({
        data: {
          title: entry.title,
          content: entry.content,
          summary: entry.content.slice(0, 200) + "...",
          category: entry.category as any,
          source: entry.source,
          sourceType: "SYSTEM_SEED",
          tags: [],
          isApproved: true,
          isActive: true,
        },
      });
      created++;
    } catch (err) {
      console.error(`  Failed to seed "${entry.title}":`, err);
    }
  }

  console.log(`✓ Knowledge base: seeded ${created} entries`);
}
