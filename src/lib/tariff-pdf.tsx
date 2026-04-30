import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PdfEntry {
  entryNumber?: string | null;
  countryOfOrigin: string;
  entryDate: string;
  enteredValue: number;
  ieepaRate: number;
  ieepaDuty: number;
  estimatedInterest: number;
  estimatedRefund: number;
  eligibility: string;
  routingBucket: string;
  deadlineDays?: number | null;
  isUrgent?: boolean;
  rateBreakdown?: { fentanyl?: number; reciprocal?: number; section122?: number };
}

export interface PdfAuditSummary {
  score: number;
  passed: boolean;
  total: number;
  passedCount: number;
  failed: number;
  warnings: number;
  topIssues: string[];
}

export interface PdfRoutingSummary {
  selfFile: { count: number; totalRefund: number };
  legalRequired: { count: number; totalRefund: number };
  notApplicable: { count: number; totalRefund: number };
}

export interface ClientSummaryData {
  clientCompany: string;
  clientContact?: string | null;
  clientEmail?: string | null;
  importerNumber?: string | null;
  partnerName: string;
  partnerCompany?: string | null;
  partnerEmail?: string | null;
  partnerPhone?: string | null;
  generatedAt: string;
  dossierId: string;
  entries: PdfEntry[];
  summary: {
    entryCount: number;
    eligibleCount: number;
    excludedCount: number;
    urgentCount: number;
    totalEnteredValue: number;
    totalEstRefund: number;
    totalEstInterest: number;
    nearestDeadline?: string | null;
    deadlineDays?: number | null;
  };
  audit: PdfAuditSummary;
  routing: PdfRoutingSummary;
}

// ── Fonts ──────────────────────────────────────────────────────────────────

Font.register({
  family: "Inter",
  fonts: [
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjQ.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hjQ.ttf", fontWeight: 600 },
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hjQ.ttf", fontWeight: 700 },
  ],
});

// ── Colors ─────────────────────────────────────────────────────────────────

const C = {
  gold: "#b08c30",
  goldLight: "#f5f0e0",
  dark: "#0f172a",
  muted: "#64748b",
  bg: "#f8f9fc",
  white: "#ffffff",
  green: "#16a34a",
  greenBg: "#f0fdf4",
  red: "#dc2626",
  redBg: "#fef2f2",
  gray: "#9ca3af",
  grayBg: "#f9fafb",
  purple: "#7c3aed",
  purpleBg: "#f5f3ff",
  blue: "#3b82f6",
  border: "#e2e8f0",
};

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 9,
    color: C.dark,
    backgroundColor: C.white,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
  },
  // Header
  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: C.gold,
    paddingBottom: 12,
    marginBottom: 20,
  },
  brandName: {
    fontSize: 22,
    fontWeight: 700,
    color: C.gold,
    letterSpacing: 1,
  },
  brandTagline: {
    fontSize: 8,
    color: C.muted,
    marginTop: 2,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: C.dark,
  },
  headerMeta: {
    fontSize: 8,
    color: C.muted,
    marginTop: 2,
  },
  confidential: {
    fontSize: 7,
    color: C.red,
    fontWeight: 600,
    marginTop: 4,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  // Section headings
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: C.dark,
    marginBottom: 8,
    marginTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingBottom: 4,
  },
  // Client info
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 0,
    marginBottom: 16,
  },
  infoCell: {
    width: "50%",
    paddingVertical: 4,
    paddingRight: 12,
  },
  infoLabel: {
    fontSize: 7,
    color: C.muted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.3,
  },
  infoValue: {
    fontSize: 9,
    fontWeight: 600,
    color: C.dark,
    marginTop: 1,
  },
  // Summary cards
  summaryRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    padding: 10,
    alignItems: "center",
  },
  summaryCardGold: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: C.gold,
    borderRadius: 6,
    padding: 10,
    alignItems: "center",
    backgroundColor: C.goldLight,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 700,
    color: C.dark,
  },
  summaryValueGold: {
    fontSize: 16,
    fontWeight: 700,
    color: C.gold,
  },
  summaryLabel: {
    fontSize: 7,
    color: C.muted,
    marginTop: 2,
    textTransform: "uppercase" as const,
  },
  // Table
  table: {
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: C.dark,
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderCell: {
    fontSize: 7,
    fontWeight: 600,
    color: C.white,
    textTransform: "uppercase" as const,
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
    backgroundColor: C.bg,
  },
  tableCell: {
    fontSize: 8,
    color: C.dark,
  },
  tableCellMuted: {
    fontSize: 8,
    color: C.muted,
  },
  // Routing summary
  routingRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  routingCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
  },
  routingCardTitle: {
    fontSize: 8,
    fontWeight: 600,
    marginBottom: 4,
  },
  routingCardValue: {
    fontSize: 14,
    fontWeight: 700,
  },
  routingCardCount: {
    fontSize: 7,
    marginTop: 2,
  },
  // Audit
  auditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  auditScoreCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  auditScoreText: {
    fontSize: 16,
    fontWeight: 700,
  },
  auditScoreLabel: {
    fontSize: 6,
    textTransform: "uppercase" as const,
    marginTop: 1,
  },
  auditStats: {
    flex: 1,
  },
  auditStatLine: {
    fontSize: 8,
    color: C.dark,
    marginBottom: 2,
  },
  // Disclaimers
  disclaimerBox: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  disclaimerTitle: {
    fontSize: 8,
    fontWeight: 600,
    color: C.dark,
    marginBottom: 4,
  },
  disclaimerText: {
    fontSize: 7,
    color: C.muted,
    lineHeight: 1.4,
  },
  // Next steps
  stepRow: {
    flexDirection: "row",
    marginBottom: 6,
    gap: 6,
  },
  stepNumber: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    fontSize: 8,
    fontWeight: 700,
    color: C.white,
  },
  stepText: {
    flex: 1,
    fontSize: 8,
    color: C.dark,
    paddingTop: 1,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: C.muted,
  },
  footerBrand: {
    fontSize: 7,
    color: C.gold,
    fontWeight: 600,
  },
});

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt$(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

function fmtDateShort(d: string): string {
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return d;
  }
}

function eligLabel(status: string): string {
  switch (status) {
    case "eligible": return "Eligible";
    case "excluded_date": return "Date Excluded";
    case "excluded_type": return "Type Excluded";
    case "excluded_expired": return "Expired";
    case "excluded_adcvd": return "AD/CVD Hold";
    default: return status;
  }
}

function routingLabel(bucket: string): string {
  switch (bucket) {
    case "self_file": return "Self-File";
    case "legal_required": return "Legal Required";
    case "not_applicable": return "N/A";
    default: return bucket;
  }
}

// ── Table column widths (percentages) ──────────────────────────────────────

const COL = {
  num:     "15%",
  country: "10%",
  date:    "12%",
  value:   "13%",
  rate:    "10%",
  refund:  "13%",
  status:  "14%",
  routing: "13%",
};

// ── Document ──────────────────────────────────────────────────────────────

export function ClientSummaryDocument({ data }: { data: ClientSummaryData }) {
  const maxTableEntries = 50;
  const displayEntries = data.entries.slice(0, maxTableEntries);
  const truncated = data.entries.length > maxTableEntries;

  const auditColor = data.audit.score >= 90 ? C.green
    : data.audit.score >= 70 ? C.gold
    : C.red;

  const hasUrgent = data.summary.urgentCount > 0;
  const hasSelfFile = data.routing.selfFile.count > 0;
  const hasLegal = data.routing.legalRequired.count > 0;

  const nextSteps: string[] = [];
  if (hasLegal) {
    nextSteps.push("Submit entries flagged 'Legal Required' for professional review — covers CIT litigation, rejection handling, and compliance oversight.");
  }
  if (hasSelfFile) {
    nextSteps.push(`Download your CAPE CSV (${data.routing.selfFile.count} eligible entries) and upload to the CBP ACE Portal to initiate automated refunds.`);
  }
  if (hasUrgent) {
    nextSteps.push(`ACTION REQUIRED: ${data.summary.urgentCount} entries have deadlines within 14 days. File immediately to preserve refund rights.`);
  }
  nextSteps.push("Verify ACH enrollment for refund deposits — refund ACH is separate from payment ACH and must be enrolled in the ACE Portal.");
  if (data.audit.failed > 0) {
    nextSteps.push(`Resolve ${data.audit.failed} audit errors before filing to avoid CAPE rejection.`);
  }

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* ── Header ─────────────────────────────────── */}
        <View style={s.headerBar}>
          <View>
            <Text style={s.brandName}>FINTELLA</Text>
            <Text style={s.brandTagline}>Financial Intelligence Network</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerTitle}>IEEPA Tariff Recovery Analysis</Text>
            <Text style={s.headerMeta}>Prepared {fmtDateShort(data.generatedAt)}</Text>
            <Text style={s.confidential}>Confidential — Prepared for Client Use Only</Text>
          </View>
        </View>

        {/* ── Client Information ─────────────────────── */}
        <Text style={s.sectionTitle}>Client Information</Text>
        <View style={s.infoGrid}>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Company</Text>
            <Text style={s.infoValue}>{data.clientCompany}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Prepared By</Text>
            <Text style={s.infoValue}>{data.partnerName}{data.partnerCompany ? ` — ${data.partnerCompany}` : ""}</Text>
          </View>
          {data.clientContact && (
            <View style={s.infoCell}>
              <Text style={s.infoLabel}>Contact</Text>
              <Text style={s.infoValue}>{data.clientContact}</Text>
            </View>
          )}
          {data.importerNumber && (
            <View style={s.infoCell}>
              <Text style={s.infoLabel}>Importer of Record</Text>
              <Text style={s.infoValue}>{data.importerNumber}</Text>
            </View>
          )}
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Dossier Reference</Text>
            <Text style={s.infoValue}>{data.dossierId.slice(0, 8).toUpperCase()}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Analysis Date</Text>
            <Text style={s.infoValue}>{fmtDateShort(data.generatedAt)}</Text>
          </View>
        </View>

        {/* ── Executive Summary ──────────────────────── */}
        <Text style={s.sectionTitle}>Executive Summary</Text>
        <View style={s.summaryRow}>
          <View style={s.summaryCardGold}>
            <Text style={s.summaryValueGold}>{fmt$(data.summary.totalEstRefund + data.summary.totalEstInterest)}</Text>
            <Text style={s.summaryLabel}>Total Estimated Recovery</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryValue}>{fmt$(data.summary.totalEstRefund)}</Text>
            <Text style={s.summaryLabel}>Duty Refund</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryValue}>{fmt$(data.summary.totalEstInterest)}</Text>
            <Text style={s.summaryLabel}>Interest (19 USC §1505)</Text>
          </View>
        </View>
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={s.summaryValue}>{data.summary.entryCount}</Text>
            <Text style={s.summaryLabel}>Total Entries</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={{ ...s.summaryValue, color: C.green }}>{data.summary.eligibleCount}</Text>
            <Text style={s.summaryLabel}>CAPE Eligible</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={{ ...s.summaryValue, color: data.summary.excludedCount > 0 ? C.red : C.green }}>{data.summary.excludedCount}</Text>
            <Text style={s.summaryLabel}>Excluded</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryValue}>{fmt$(data.summary.totalEnteredValue)}</Text>
            <Text style={s.summaryLabel}>Total Entered Value</Text>
          </View>
        </View>

        {/* ── Routing Summary ────────────────────────── */}
        <Text style={s.sectionTitle}>Filing Strategy</Text>
        <View style={s.routingRow}>
          <View style={{ ...s.routingCard, borderColor: C.green, backgroundColor: C.greenBg }}>
            <Text style={{ ...s.routingCardTitle, color: C.green }}>Self-File Ready</Text>
            <Text style={{ ...s.routingCardValue, color: C.green }}>{fmt$(data.routing.selfFile.totalRefund)}</Text>
            <Text style={{ ...s.routingCardCount, color: C.green }}>{data.routing.selfFile.count} entries via CAPE</Text>
          </View>
          <View style={{ ...s.routingCard, borderColor: C.red, backgroundColor: C.redBg }}>
            <Text style={{ ...s.routingCardTitle, color: C.red }}>Legal Review Required</Text>
            <Text style={{ ...s.routingCardValue, color: C.red }}>{fmt$(data.routing.legalRequired.totalRefund)}</Text>
            <Text style={{ ...s.routingCardCount, color: C.red }}>{data.routing.legalRequired.count} entries need counsel</Text>
          </View>
          <View style={{ ...s.routingCard, borderColor: C.gray, backgroundColor: C.grayBg }}>
            <Text style={{ ...s.routingCardTitle, color: C.gray }}>Not Applicable</Text>
            <Text style={{ ...s.routingCardValue, color: C.gray }}>{fmt$(data.routing.notApplicable.totalRefund)}</Text>
            <Text style={{ ...s.routingCardCount, color: C.gray }}>{data.routing.notApplicable.count} entries</Text>
          </View>
        </View>

        {/* ── Audit Score ────────────────────────────── */}
        <Text style={s.sectionTitle}>Pre-Submission Audit</Text>
        <View style={s.auditRow}>
          <View style={{ ...s.auditScoreCircle, borderColor: auditColor }}>
            <Text style={{ ...s.auditScoreText, color: auditColor }}>{data.audit.score}</Text>
            <Text style={{ ...s.auditScoreLabel, color: auditColor }}>Score</Text>
          </View>
          <View style={s.auditStats}>
            <Text style={s.auditStatLine}>
              {data.audit.passedCount}/{data.audit.total} checks passed
              {data.audit.passed ? " — Ready to file" : " — Issues found"}
            </Text>
            {data.audit.failed > 0 && (
              <Text style={{ ...s.auditStatLine, color: C.red }}>
                {data.audit.failed} error{data.audit.failed !== 1 ? "s" : ""} must be resolved before filing
              </Text>
            )}
            {data.audit.warnings > 0 && (
              <Text style={{ ...s.auditStatLine, color: C.gold }}>
                {data.audit.warnings} warning{data.audit.warnings !== 1 ? "s" : ""} to review
              </Text>
            )}
            {data.audit.topIssues.length > 0 && (
              <View style={{ marginTop: 4 }}>
                {data.audit.topIssues.map((issue, i) => (
                  <Text key={i} style={{ fontSize: 7, color: C.muted, marginBottom: 1 }}>
                    • {issue}
                  </Text>
                ))}
              </View>
            )}
          </View>
        </View>
      </Page>

      {/* ── Page 2: Entry Detail Table ────────────── */}
      <Page size="LETTER" style={s.page}>
        <Text style={{ ...s.sectionTitle, marginTop: 0 }}>Entry Detail</Text>
        <View style={s.table}>
          <View style={s.tableHeader}>
            <Text style={{ ...s.tableHeaderCell, width: COL.num }}>Entry #</Text>
            <Text style={{ ...s.tableHeaderCell, width: COL.country }}>Origin</Text>
            <Text style={{ ...s.tableHeaderCell, width: COL.date }}>Entry Date</Text>
            <Text style={{ ...s.tableHeaderCell, width: COL.value, textAlign: "right" }}>Value</Text>
            <Text style={{ ...s.tableHeaderCell, width: COL.rate, textAlign: "right" }}>Rate</Text>
            <Text style={{ ...s.tableHeaderCell, width: COL.refund, textAlign: "right" }}>Est. Refund</Text>
            <Text style={{ ...s.tableHeaderCell, width: COL.status }}>Status</Text>
            <Text style={{ ...s.tableHeaderCell, width: COL.routing }}>Filing</Text>
          </View>
          {displayEntries.map((entry, i) => (
            <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={{ ...s.tableCell, width: COL.num, fontSize: 7 }}>
                {entry.entryNumber || `Row ${i + 1}`}
              </Text>
              <Text style={{ ...s.tableCell, width: COL.country }}>{entry.countryOfOrigin}</Text>
              <Text style={{ ...s.tableCell, width: COL.date }}>{fmtDateShort(entry.entryDate)}</Text>
              <Text style={{ ...s.tableCell, width: COL.value, textAlign: "right" }}>{fmt$(entry.enteredValue)}</Text>
              <Text style={{ ...s.tableCell, width: COL.rate, textAlign: "right" }}>{fmtPct(entry.ieepaRate)}</Text>
              <Text style={{ ...s.tableCell, width: COL.refund, textAlign: "right" }}>{fmt$(entry.estimatedRefund)}</Text>
              <Text style={{
                ...s.tableCell,
                width: COL.status,
                color: entry.eligibility === "eligible" ? C.green : C.red,
                fontSize: 7,
              }}>
                {eligLabel(entry.eligibility)}
                {entry.isUrgent ? " !" : ""}
              </Text>
              <Text style={{
                ...s.tableCell,
                width: COL.routing,
                color: entry.routingBucket === "self_file" ? C.green
                  : entry.routingBucket === "legal_required" ? C.red : C.gray,
                fontSize: 7,
              }}>
                {routingLabel(entry.routingBucket)}
              </Text>
            </View>
          ))}
        </View>
        {truncated && (
          <Text style={{ fontSize: 8, color: C.muted, fontStyle: "italic", marginBottom: 8 }}>
            Showing {maxTableEntries} of {data.entries.length} entries. Full entry list available in your Fintella portal.
          </Text>
        )}

        {/* ── Recommended Next Steps ─────────────────── */}
        <Text style={s.sectionTitle}>Recommended Next Steps</Text>
        {nextSteps.map((step, i) => (
          <View key={i} style={s.stepRow}>
            <View style={s.stepNumber}>
              <Text style={s.stepNumberText}>{i + 1}</Text>
            </View>
            <Text style={s.stepText}>{step}</Text>
          </View>
        ))}

        {/* ── Deadline Warning ───────────────────────── */}
        {data.summary.deadlineDays != null && data.summary.deadlineDays <= 30 && (
          <View style={{ backgroundColor: "#fef3c7", borderWidth: 1, borderColor: "#f59e0b", borderRadius: 6, padding: 10, marginTop: 12 }}>
            <Text style={{ fontSize: 9, fontWeight: 600, color: "#92400e" }}>
              Deadline Alert: Nearest filing deadline is in {data.summary.deadlineDays} day{data.summary.deadlineDays !== 1 ? "s" : ""}
              {data.summary.nearestDeadline ? ` (${fmtDateShort(data.summary.nearestDeadline)})` : ""}.
            </Text>
            <Text style={{ fontSize: 7, color: "#92400e", marginTop: 3 }}>
              Once the 80-day protest window from liquidation expires, CAPE refund rights are permanently lost.
            </Text>
          </View>
        )}

        {/* ── Legal Disclaimers ──────────────────────── */}
        <Text style={s.sectionTitle}>Important Disclaimers</Text>
        <View style={s.disclaimerBox}>
          <Text style={s.disclaimerTitle}>Estimation Disclaimer</Text>
          <Text style={s.disclaimerText}>
            All refund amounts shown are estimates based on current IEEPA tariff rates and publicly available IRS underpayment interest rates.
            Actual refund amounts may differ based on CBP processing, entry-specific adjustments, and applicable offsets per 19 CFR §24.72.
            This analysis does not constitute legal, tax, or customs advice.
          </Text>
        </View>
        <View style={s.disclaimerBox}>
          <Text style={s.disclaimerTitle}>CAPE Filing Disclaimer</Text>
          <Text style={s.disclaimerText}>
            CAPE (Centralized Automated Processing of Entry-type refunds) is a CBP-administered automated refund program.
            Only the Importer of Record or the licensed customs broker who originally filed the entries may submit a CAPE Declaration.
            Attorneys and third parties cannot be the filer of record. Fintella does not file CAPE Declarations on behalf of any party.
          </Text>
        </View>
        <View style={s.disclaimerBox}>
          <Text style={s.disclaimerTitle}>Commission & Referral Disclosure</Text>
          <Text style={s.disclaimerText}>
            If entries are referred for legal review, Fintella may receive a referral fee from the legal service provider in accordance with
            applicable law, including Arizona Ethics Rule 5.4. This does not affect the quality of service or the importer&#39;s recovery amount.
            Full disclosure is provided upon engagement.
          </Text>
        </View>

        {/* ── Footer ─────────────────────────────────── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            Prepared by {data.partnerName} via Fintella | fintella.partners | {fmtDateShort(data.generatedAt)}
          </Text>
          <Text style={s.footerBrand}>FINTELLA</Text>
        </View>
      </Page>
    </Document>
  );
}
