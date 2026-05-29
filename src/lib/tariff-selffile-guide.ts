// ---------------------------------------------------------------------------
// IEEPA Tariff Refund — CAPE Self-File Guide
//
// Plain-English, step-by-step instructions delivered to the client as part of
// the DIY self-file kit (after the upfront fee is paid). Informational only —
// Fintella is not a law firm and does not provide legal advice.
// ---------------------------------------------------------------------------

export interface GuideStep {
  n: number;
  title: string;
  detail: string;
}

export interface RejectionReason {
  code: string;
  meaning: string;
  fix: string;
}

export interface SelfFileGuide {
  title: string;
  intro: string;
  prerequisites: string[];
  steps: GuideStep[];
  rejectionReasons: RejectionReason[];
  timeline: string;
  disclaimers: string[];
}

export const TARIFF_SELFFILE_GUIDE: SelfFileGuide = {
  title: "How to File Your IEEPA Tariff Refund (CAPE Self-File Guide)",
  intro:
    "Following the Supreme Court's February 2026 ruling striking down IEEPA tariffs, CBP opened the CAPE system in ACE on April 20, 2026 to process roughly $165 billion in duty refunds. This guide walks you through every step to self-file a CAPE Declaration and receive your refund by ACH deposit.",
  prerequisites: [
    "You are the Importer of Record (IOR) on the entries, OR you are the licensed customs broker who filed the original entry summaries on the importer's behalf.",
    "You have (or can create) an ACE Secure Data Portal account at ace.cbp.dhs.gov with an active 'Importer' sub-account tied to your EIN or SSN.",
    "Your ACE account has a verified ACH bank account on file — paper-check refunds ended February 6, 2026, and CBP issues refunds electronically only.",
    "You have access to your entry documentation (entry numbers, HTS codes, import dates) or can pull them from ACE reports.",
    "You understand that Section 232 (steel/aluminum) and Section 301 (China) duties are NOT eligible — only duties assessed under IEEPA Chapter 99 HTS codes qualify.",
    "You file before entries age out: unliquidated entries and entries liquidated within the past 80 days qualify for CAPE Phase 1; entries liquidated 80–180 days ago require a formal protest under 19 U.S.C. §1514; entries liquidated more than 180 days ago require CIT litigation and are outside CAPE.",
  ],
  steps: [
    { n: 1, title: "Confirm Your Eligibility Window", detail: "For each entry, determine whether it is unliquidated or when it was liquidated. Unliquidated entries and entries liquidated within the past 80 days are eligible for CAPE Phase 1 — your primary path. Entries liquidated 80–180 days ago require a formal protest instead. Entries liquidated more than 180 days ago require CIT litigation. Prioritize entries approaching the 80-day liquidation cutoff — those deadlines are hard." },
    { n: 2, title: "Set Up or Verify Your ACE Importer Account", detail: "Log in at ace.cbp.dhs.gov. If you have no account, register and complete identity verification (EIN or SSN + business info). Confirm you have an active 'Importer' sub-account; if you only have a Broker/Carrier sub-account, add an Importer sub-account. Your ACE tax ID must match the Importer of Record tax ID on the entry summaries — a mismatch is a known CAPE rejection reason." },
    { n: 3, title: "Add Your ACH Refund Bank Account in ACE", detail: "In ACE account settings, locate the Revenue / Bank Account section and enter your business checking or savings routing and account numbers. CBP requires this before any refund can be disbursed — there is no paper-check option. Double-check the numbers; an error delays your refund even after CAPE acceptance." },
    { n: 4, title: "Pull the ES-003 Import History Report", detail: "In ACE Reports, run the ES-003 (Entry Summary) report filtered by your importer tax ID across the IEEPA period. Export to Excel/CSV. Review HTS codes for the IEEPA Chapter 99 series (e.g. 9903.01.xx); those are the entries potentially eligible for refund." },
    { n: 5, title: "Verify Liquidation Status and Flag Eligible Entries", detail: "For each entry, check liquidation status in ACE or on the CBP bulletin. Bucket them: (A) unliquidated — file now; (B) liquidated within 80 days — file now, quickly; (C) liquidated 80–180 days — formal protest, not CAPE. Remove entries already on a drawback claim, under open protest, under entry-summary review, or in statement processing — they will be rejected. Remove entries with no IEEPA Chapter 99 codes." },
    { n: 6, title: "Build Your CAPE CSV File", detail: "Create a plain CSV with exactly one column. Row 1 header must read exactly: Entry Number. Each following row is one entry number in standard CBP format (e.g. ABC-1234567-8). Max 9,999 entries per declaration; split into multiple files if you have more. Save as .csv (not .xlsx). Open in a text editor to confirm there are no extra columns, blank rows, or stray characters. (Your kit includes a ready-to-upload CAPE CSV of your eligible entries.)" },
    { n: 7, title: "Log Into ACE and Open the CAPE Tab", detail: "Log in at ace.cbp.dhs.gov, select your Importer sub-account, and open the CAPE module (left nav or under Revenue/Trade). If you don't see it, confirm your Importer sub-account is active and your ACE trade role permits CAPE; your ACE account coordinator or CBP client rep can enable it. Do not file via ABI/EDI or any third-party API — CAPE is web-portal only." },
    { n: 8, title: "Upload Your CAPE CSV and Review", detail: "In the CAPE module, choose New Declaration / Upload Entries and attach your CSV. ACE parses it and lists the recognized entry numbers. Confirm the count matches and no entries were dropped. Fix any flagged errors in your CSV, re-upload, and verify the parsed list before continuing." },
    { n: 9, title: "Submit the CAPE Declaration", detail: "When the parsed list is correct, click Submit Declaration and certify under penalty of law that you are the IOR or authorized broker and the information is accurate. Save the Declaration ID immediately. CRITICAL: declarations cannot be amended after acceptance, and an entry on an accepted declaration cannot be resubmitted — file accurately." },
    { n: 10, title: "Monitor Declaration Status", detail: "Run REV-603 (CAPE Declaration Status) for acceptance/rejection and per-entry disposition codes, REV-613 for refund calculation detail, and REV-615 for ACH payment status. CBP does not email every status change — check periodically. Rejected entries do not invalidate accepted ones." },
    { n: 11, title: "Receive Your ACH Refund", detail: "For accepted entries, CBP calculates the refund (IEEPA duties + interest) and sends an ACH credit to your ACE bank account, typically 60–90 days after acceptance. CBP may offset the refund against outstanding CBP debts under 19 CFR §24.72 — check REV-615 for the net figure. If nothing arrives after 90 days, contact your CBP client rep with your Declaration ID and REV-603 confirmation." },
    { n: 12, title: "Handle Rejected Entries", detail: "Review REV-603 rejection codes. Fixable issues (e.g. STATEMENT PROCESSING NOT COMPLETE) can be resubmitted once resolved. ON DRAWBACK or PROTEST ON ENTRY require resolving those instruments first. NO IEEPA HTS means the entry wasn't subject to IEEPA duties. Keep a log of all codes and resolutions." },
  ],
  rejectionReasons: [
    { code: "ENTRY ON DRAWBACK", meaning: "A drawback claim already exists against this entry, conflicting with the CAPE claim.", fix: "Decide whether drawback or CAPE is more valuable. To pursue CAPE, withdraw the drawback claim first, then resubmit — if still in the eligibility window." },
    { code: "PROTEST ON ENTRY", meaning: "An open §1514 protest already exists for this entry, blocking a parallel CAPE claim.", fix: "Withdraw the protest or let it be decided before including the entry. Consult a licensed customs attorney before withdrawing — it may affect other claims." },
    { code: "ENTRY SUMMARY UNDER REVIEW", meaning: "CBP has the entry open for review/audit; it can't be refunded while under review.", fix: "Wait for CBP to close the review, then resubmit in a new declaration if still within the window." },
    { code: "NO IEEPA HTS ON ENTRY", meaning: "The entry has no IEEPA Chapter 99 HTS codes — no IEEPA duties were assessed.", fix: "No CAPE action available. Verify HTS codes on the original entry summary with a licensed broker if you believe IEEPA duties applied." },
    { code: "STATEMENT PROCESSING NOT COMPLETE", meaning: "The entry's periodic statement hasn't finished processing, so duty amounts aren't final.", fix: "Wait for statement processing to complete, then resubmit — confirm the entry is still in the window." },
    { code: "DUPLICATE TAX ID", meaning: "The entry's importer tax ID doesn't match the ACE Importer sub-account, or the entry was submitted by two filers.", fix: "Confirm your ACE Importer sub-account EIN/SSN exactly matches the IOR tax ID on the entry summary. Brokers must file under the importer's account or with a valid power of attorney." },
  ],
  timeline:
    "After submission, CBP typically accepts or rejects within a few business days to a few weeks. After acceptance, ACH refunds arrive in roughly 60–90 days. First CAPE Phase 1 refunds began reaching importers around May 12, 2026. If any entries are near the 80-day post-liquidation cutoff, file immediately.",
  disclaimers: [
    "Fintella is not a law firm and does not provide legal advice. This guide is informational only and is not legal, tax, or customs-compliance advice.",
    "This reflects publicly available CBP guidance as of May 2026. Procedures and deadlines may change — confirm current requirements at cbp.gov or with a licensed customs broker/attorney before filing.",
    "Withdrawing protests or drawback claims before filing CAPE can have significant legal and financial consequences. Consult a licensed customs attorney first.",
    "Section 232 and Section 301 duties are not eligible for IEEPA refunds and must not be included in a CAPE declaration.",
    "CBP may offset your refund against outstanding CBP debts under 19 CFR §24.72. Fintella has no visibility into CBP offset determinations.",
    "Entries outside the CAPE window require formal legal proceedings Fintella cannot facilitate — seek qualified legal counsel.",
  ],
};

/** Render the guide to a Markdown string for download / email. */
export function renderGuideMarkdown(g: SelfFileGuide = TARIFF_SELFFILE_GUIDE): string {
  const L: string[] = [];
  L.push(`# ${g.title}`, "", g.intro, "");
  L.push("## Before you start", "");
  for (const p of g.prerequisites) L.push(`- ${p}`);
  L.push("", "## Steps", "");
  for (const s of g.steps) L.push(`### ${s.n}. ${s.title}`, "", s.detail, "");
  L.push("## If an entry is rejected", "");
  for (const r of g.rejectionReasons) L.push(`- **${r.code}** — ${r.meaning}`, `  - Fix: ${r.fix}`);
  L.push("", "## Timeline", "", g.timeline, "");
  L.push("## Important disclaimers", "");
  for (const d of g.disclaimers) L.push(`- ${d}`);
  L.push("");
  return L.join("\n");
}
