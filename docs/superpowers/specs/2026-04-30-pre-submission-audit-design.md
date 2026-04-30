# Pre-Submission Audit & File-Ready Package — Design Spec

## Overview

A comprehensive pre-filing audit engine that validates broker entry data against every known CAPE rejection reason, generates a file-ready package with clean CSV + audit report + filing checklist + client summary PDF, and presents a three-option routing UI that positions legal review as the recommended path while keeping self-filing available.

## The Three-Option Routing UI

After calculation, brokers see three choices (replaces the current green/red split):

### Option 1: Full Legal Review (RECOMMENDED — starred, highlighted)
- Submit ALL entries to legal partner
- Pre-filing compliance review, offset defense, rejection handling, interest verification, protective CIT filing
- $0 upfront — contingency-based
- Fintella earns referral commission on full refund amount

### Option 2: Self-File Only
- Download CAPE CSV for eligible entries
- Broker files in ACE Portal themselves
- Risk warnings displayed: no offset protection, no rejection handling, no compliance review
- Available but not promoted

### Option 3: Split Approach
- Self-file eligible entries via CAPE CSV
- Submit complex/excluded entries to legal partner
- Middle ground

## Pre-Submission Audit Engine

### `src/lib/tariff-audit.ts` — Pure audit functions

**Format Checks (file-level):**
```typescript
interface AuditResult {
  passed: boolean;
  checks: AuditCheck[];
  errors: AuditCheck[];
  warnings: AuditCheck[];
  score: number; // 0-100
}

interface AuditCheck {
  id: string;
  category: "format" | "entry" | "eligibility" | "risk";
  severity: "error" | "warning" | "info";
  passed: boolean;
  message: string;
  detail?: string;
  entryNumber?: string;
  fix?: string;
}
```

**Checks to implement (Phase 1 — from CSV data alone):**

| Check ID | Category | What it checks | Severity |
|----------|----------|---------------|----------|
| `FMT_ENCODING` | format | UTF-8 without BOM | error |
| `FMT_LINE_ENDINGS` | format | LF not CRLF | error |
| `FMT_HEADER` | format | First row = "Entry Number" | error |
| `FMT_MAX_ENTRIES` | format | ≤ 9,999 per file | error |
| `FMT_EMPTY_ROWS` | format | No blank rows | warning |
| `FMT_TRAILING` | format | No trailing commas/whitespace | warning |
| `ENT_CHECK_DIGIT` | entry | Mod-10 check digit valid | error |
| `ENT_FORMAT` | entry | 11-char XXX-XXXXXXX-X format | error |
| `ENT_DUPLICATE` | entry | No duplicates within file | error |
| `ENT_FILER_CODE` | entry | Consistent filer code (first 3 chars) | warning |
| `ELIG_DATE_RANGE` | eligibility | Entry date within IEEPA period | error |
| `ELIG_ENTRY_TYPE` | eligibility | Not type 08/09/23/47 | error |
| `ELIG_IEEPA_RATE` | eligibility | Country+date has applicable IEEPA rate | error |
| `ELIG_LIQUIDATION` | eligibility | Not liquidated >80 days | error |
| `ELIG_ADCVD` | eligibility | Not unliquidated AD/CVD | error |
| `RISK_DEADLINE` | risk | Entry approaching 80-day cliff | warning |
| `RISK_OFFSET` | risk | Potential government offset exposure | info |
| `RISK_ACH` | risk | ACH enrollment reminder | info |
| `RISK_MULTI_BROKER` | risk | Multiple filer codes detected | warning |

**Audit score:** `(passed checks / total checks) × 100`. Display as a quality indicator.

### Audit Flow

```
Input (entries from calculator or CSV upload)
    ↓
Format validation (file-level checks)
    ↓
Entry validation (per-entry checks)
    ↓
Eligibility validation (CAPE Phase 1 rules)
    ↓
Risk assessment (warnings + info)
    ↓
AuditResult { score, checks[], errors[], warnings[] }
```

## File-Ready Package

### Contents

**1. Clean CAPE CSV** (`cape-declaration-{clientName}-{date}.csv`)
- Only entries that passed ALL error-level audit checks
- Only entries with eligibility = "eligible"
- Correct UTF-8 encoding, LF line endings, proper header
- Entry numbers formatted as XXX-XXXXXXX-X
- Auto-batched at 9,999 if needed (multiple files)

**2. Audit Report** (`audit-report-{clientName}-{date}.csv`)
- Per-entry results: entry number, passed/failed, check ID, message, fix suggestion
- Summary: total entries, passed, failed, warnings
- Grouped by severity

**3. Filing Checklist** (rendered in UI, also in PDF)
Step-by-step instructions:
1. Log in to ACE Secure Data Portal (ace.cbp.dhs.gov)
2. Navigate to CAPE tab
3. Click "Upload" button
4. Select the CAPE CSV file
5. Wait for validation (file-level, then entry-level)
6. Review accepted vs rejected entries
7. Note your CAPE claim number
8. Check REV-615 report for status updates
9. Monitor ACH for refund deposit (60-90 days)

**4. Client Summary PDF** (Fintella-branded)
- Client company name, analysis date, broker name
- Total estimated refund + interest
- Entry breakdown: eligible count, excluded count, urgent count
- Routing recommendation (legal review vs self-file)
- Risk factors identified
- Fintella branding + contact info
- Legal disclaimers
- Generated server-side (React-to-PDF or html-to-pdf)

**5. Excluded Entries Report**
- Entries that failed audit with reasons
- Recommended action per entry (correct data and retry, or submit to legal)
- "Submit All Excluded to Legal Partner" button

## API Routes

### `POST /api/tariff/audit` (public, rate-limited)
Accept entries array (same format as /api/tariff/calculate), run all audit checks, return AuditResult.

### `POST /api/partner/dossiers/[id]/audit` (partner auth)
Run audit on a saved dossier's entries. Store results on dossier.

### `POST /api/partner/dossiers/[id]/package` (partner auth)
Generate the file-ready package. Returns a zip or individual download links:
- CAPE CSV (text/csv)
- Audit report (text/csv)
- Client summary (application/pdf)

### `POST /api/partner/dossiers/[id]/submit-legal` (partner auth)
Submit ALL entries (or filtered to legal-required only) to legal partner.
Creates a Deal referral with full dossier data attached.

## UI Changes

### Public Calculator — Three-Option Choice

Replace the current green/red routing cards with the three-option layout:

**Option 1 (recommended, full-width, highlighted border):**
- Star badge: "RECOMMENDED"
- Title: "Full Legal Review + Filing Support"
- Bullet list: compliance review, offset defense, rejection handling, interest verification, CIT filing
- "$0 upfront — contingency-based"
- Button: "Submit All Entries for Legal Review →"
- Legal referral disclaimer below

**Option 2 (half-width, muted):**
- Title: "Self-File"
- "Download CAPE CSV and file in ACE Portal"
- Warning list with ⚠ icons: no offset protection, no rejection handling, no compliance review
- Button: "Download CAPE CSV"
- CAPE disclaimer below

**Option 3 (half-width, muted):**
- Title: "Split Approach"
- "Self-file [N] eligible, submit [N] to legal"
- Buttons: "Download CSV" + "Submit Complex →"

### Partner Portal — Audit Dashboard

New section in `/dashboard/calculator` between results and actions:

**Audit Score Card:**
- Circular progress indicator: 87/100
- Color: green (≥80), yellow (60-79), red (<60)
- "Your entries passed 18 of 19 checks"

**Check Results (expandable):**
- Green checkmarks for passed checks
- Red X for errors with fix suggestions
- Yellow ! for warnings
- Grouped: Format → Entry → Eligibility → Risk

**File-Ready Package Download:**
- "Download Filing Package" button (generates zip with all files)
- Or individual downloads: CAPE CSV | Audit Report | Client PDF | Filing Checklist

### Widget

Add audit score to the result card:
- "Audit: ✓ Ready to file" (if score ≥ 80)
- "Audit: ⚠ Issues found" (if score < 80)

## Legal Disclaimers (carry forward from smart routing spec)

All 5 existing disclaimers remain. Add one new one:

**6. Audit Disclaimer:**
> "This audit checks for common CAPE filing errors based on publicly available CBP guidance. It does not guarantee acceptance by CBP. Fintella is not responsible for CAPE declaration rejections. Always verify entry data independently before submitting."

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/lib/tariff-audit.ts` | CREATE — audit engine with all checks |
| `src/lib/tariff-pdf.ts` | CREATE — client summary PDF generator |
| `src/app/api/tariff/audit/route.ts` | CREATE — public audit endpoint |
| `src/app/api/partner/dossiers/[id]/audit/route.ts` | CREATE — partner audit endpoint |
| `src/app/api/partner/dossiers/[id]/package/route.ts` | CREATE — file-ready package endpoint |
| `src/app/api/partner/dossiers/[id]/submit-legal/route.ts` | CREATE — legal submission endpoint |
| `src/app/calculator/page.tsx` | MODIFY — three-option routing UI |
| `src/app/(partner)/dashboard/calculator/page.tsx` | MODIFY — audit dashboard + package download |
| `src/components/widget/WidgetCalculator.tsx` | MODIFY — audit score note |

## Dependencies

- No new npm packages for audit engine (pure TypeScript)
- PDF generation: use existing html-to-string approach or add `@react-pdf/renderer` (lightweight, server-side)
- No new env vars
- No schema changes (audit results stored as JSON on TariffDossier or computed on-the-fly)
