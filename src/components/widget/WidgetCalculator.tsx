"use client";

import { useState, useRef, useCallback, useEffect, type FormEvent, type DragEvent } from "react";
import { W, RADII, glassCardStyle, goldButtonStyle, inputStyle } from "./widget-theme";

interface Props {
  token: string;
  commissionRate: number;
  onSubmitAsReferral: (data: { estimatedImportValue: string; importDateRange: string; documentUrls?: string[] }) => void;
  droppedFiles?: File[] | null;
  onDroppedFilesConsumed?: () => void;
}

// Top importing countries affected by IEEPA — compact list for widget
const COUNTRIES = [
  { code: "CN", name: "China", flag: "\u{1F1E8}\u{1F1F3}" },
  { code: "VN", name: "Vietnam", flag: "\u{1F1FB}\u{1F1F3}" },
  { code: "TW", name: "Taiwan", flag: "\u{1F1F9}\u{1F1FC}" },
  { code: "IN", name: "India", flag: "\u{1F1EE}\u{1F1F3}" },
  { code: "TH", name: "Thailand", flag: "\u{1F1F9}\u{1F1ED}" },
  { code: "ID", name: "Indonesia", flag: "\u{1F1EE}\u{1F1E9}" },
  { code: "MY", name: "Malaysia", flag: "\u{1F1F2}\u{1F1FE}" },
  { code: "KR", name: "South Korea", flag: "\u{1F1F0}\u{1F1F7}" },
  { code: "JP", name: "Japan", flag: "\u{1F1EF}\u{1F1F5}" },
  { code: "DE", name: "Germany", flag: "\u{1F1E9}\u{1F1EA}" },
  { code: "GB", name: "United Kingdom", flag: "\u{1F1EC}\u{1F1E7}" },
  { code: "FR", name: "France", flag: "\u{1F1EB}\u{1F1F7}" },
  { code: "IT", name: "Italy", flag: "\u{1F1EE}\u{1F1F9}" },
  { code: "BD", name: "Bangladesh", flag: "\u{1F1E7}\u{1F1E9}" },
  { code: "KH", name: "Cambodia", flag: "\u{1F1F0}\u{1F1ED}" },
  { code: "PH", name: "Philippines", flag: "\u{1F1F5}\u{1F1ED}" },
  { code: "PK", name: "Pakistan", flag: "\u{1F1F5}\u{1F1F0}" },
  { code: "BR", name: "Brazil", flag: "\u{1F1E7}\u{1F1F7}" },
  { code: "CA", name: "Canada", flag: "\u{1F1E8}\u{1F1E6}" },
  { code: "MX", name: "Mexico", flag: "\u{1F1F2}\u{1F1FD}" },
];

interface CalcResult {
  countryOfOrigin: string;
  entryDate: string;
  enteredValue: number;
  ieepaRate: number;
  rateName: string;
  rateBreakdown: { fentanyl?: number; reciprocal?: number; section122?: number };
  ieepaDuty: number;
  estimatedInterest: number;
  estimatedRefund: number;
  eligibility: string;
  eligibilityReason: string;
}

interface AuditSummary {
  score: number;
  failed: number;
}

// --- Document intake response types ---

interface DocEntry {
  index: number;
  entryNumber: string | null;
  countryOfOrigin: string;
  entryDate: string;
  enteredValue: number;
  combinedRate: number;
  estimatedRefund: number;
  routingBucket: "self_file" | "legal_required" | "not_applicable";
  confidence: number;
  needsReview: boolean;
  eligibility: {
    status: string;
    reason: string;
    deadlineDays?: number;
    isUrgent?: boolean;
  };
}

interface DocIntakeResult {
  success: boolean;
  importerName: string | null;
  summary: {
    totalEntries: number;
    totalEnteredValue: number;
    totalEstimatedRefund: number;
    selfFileCount: number;
    selfFileRefund: number;
    needsLegalCount: number;
    needsLegalRefund: number;
    notApplicableCount: number;
    lowConfidenceCount: number;
    auditScore: number;
    auditPassed: boolean;
    auditErrors: number;
    auditWarnings: number;
  };
  entries: DocEntry[];
  audit: {
    score: number;
    passed: boolean;
    errors: { message: string; fix: string }[];
    warnings: { message: string }[];
  };
  filingPackage: {
    capeCsv: string;
    auditReportCsv: string;
    eligibleForCape: number;
  };
  warnings: string[];
}

type WidgetMode = "manual" | "upload";

// Style constants now imported from ./widget-theme (W, RADII, SHADOWS, helpers)

export default function WidgetCalculator({ token, commissionRate, onSubmitAsReferral, droppedFiles, onDroppedFilesConsumed }: Props) {
  // --- Manual mode state ---
  const [countryOfOrigin, setCountryOfOrigin] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [enteredValue, setEnteredValue] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null);

  // --- Upload mode state ---
  const [mode, setMode] = useState<WidgetMode>("manual");
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [docResult, setDocResult] = useState<DocIntakeResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Manual mode handlers (unchanged) ---
  const handleCalculate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setAuditSummary(null);
    setCalculating(true);

    try {
      const res = await fetch("/api/widget/calculate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          countryOfOrigin,
          entryDate,
          enteredValue: parseFloat(enteredValue),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Calculation failed");
      } else {
        setResult(data);
        // Fire audit check
        fetch("/api/tariff/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entries: [{
              entryDate: data.entryDate,
              countryOfOrigin: data.countryOfOrigin,
              enteredValue: data.enteredValue,
              ieepaRate: data.ieepaRate,
              eligibility: data.eligibility,
            }],
          }),
        })
          .then((ar) => (ar.ok ? ar.json() : null))
          .then((ad) => {
            if (ad) setAuditSummary({ score: ad.score, failed: ad.summary?.failed ?? 0 });
          })
          .catch(() => {});
      }
    } catch {
      setError("Network error");
    } finally {
      setCalculating(false);
    }
  };

  const handleReferral = () => {
    if (!result) return;

    // Map value to the range bucket used by referral form
    let valueBucket = "<$50K";
    if (result.enteredValue >= 2_000_000) valueBucket = "$2M+";
    else if (result.enteredValue >= 500_000) valueBucket = "$500K-$2M";
    else if (result.enteredValue >= 50_000) valueBucket = "$50K-$500K";

    onSubmitAsReferral({
      estimatedImportValue: valueBucket,
      importDateRange: result.entryDate,
    });
  };

  const fmtUsd = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

  const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

  // --- Upload mode handlers ---
  const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];

  const validateFiles = (fileList: FileList | File[]): File[] => {
    const valid: File[] = [];
    for (const f of Array.from(fileList)) {
      if (ACCEPTED_TYPES.includes(f.type)) {
        valid.push(f);
      }
    }
    return valid;
  };

  const handleUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) {
      setUploadError("Please select a PDF, PNG, or JPG file");
      return;
    }

    setUploadError(null);
    setDocResult(null);
    setUploading(true);

    try {
      const formData = new FormData();
      for (const f of files) {
        formData.append("files", f);
      }

      const res = await fetch("/api/tariff/document-intake", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Upload failed");
      } else if (!data.success) {
        setUploadError(data.warnings?.join("; ") || "Could not extract entries from document");
      } else {
        setDocResult(data as DocIntakeResult);
      }
    } catch {
      setUploadError("Network error — please try again");
    } finally {
      setUploading(false);
    }
  }, [token]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = validateFiles(e.dataTransfer.files);
    handleUpload(files);
  }, [handleUpload]);

  const handleFileSelect = useCallback(() => {
    const files = fileInputRef.current?.files;
    if (files) {
      handleUpload(validateFiles(files));
    }
  }, [handleUpload]);

  useEffect(() => {
    if (droppedFiles && droppedFiles.length > 0) {
      setMode("upload");
      handleUpload(droppedFiles);
      onDroppedFilesConsumed?.();
    }
  }, [droppedFiles, onDroppedFilesConsumed, handleUpload]);

  const downloadCsv = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const switchMode = (newMode: WidgetMode) => {
    setMode(newMode);
    // Clear upload state when switching away
    if (newMode === "manual") {
      setUploadError(null);
      setDocResult(null);
    }
    // Clear manual state when switching away
    if (newMode === "upload") {
      setError(null);
      setResult(null);
      setAuditSummary(null);
    }
  };

  // --- Mode toggle tabs ---
  const renderModeTabs = () => (
    <div
      style={{
        display: "flex",
        borderRadius: RADII.md,
        overflow: "hidden",
        border: `1px solid ${W.border}`,
        marginBottom: 12,
      }}
    >
      {(["manual", "upload"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => switchMode(m)}
          style={{
            flex: 1,
            padding: "8px 0",
            fontSize: 12,
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            transition: "all 0.15s",
            background: mode === m ? W.gold : W.bgCard,
            color: mode === m ? "#000" : W.textSecondary,
          }}
        >
          {m === "manual" ? "Manual Entry" : "Upload Document"}
        </button>
      ))}
    </div>
  );

  // --- Upload drop zone ---
  const renderDropZone = () => (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      style={{
        border: `2px dashed ${dragActive ? W.gold : W.border}`,
        borderRadius: RADII.lg,
        padding: "24px 16px",
        textAlign: "center",
        cursor: "pointer",
        transition: "all 0.2s",
        background: dragActive ? "rgba(196, 160, 80, 0.05)" : W.bgCard,
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        multiple
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />
      <div style={{ fontSize: 28, marginBottom: 8 }}>
        {dragActive ? "\u{1F4E5}" : "\u{1F4C4}"}
      </div>
      <p style={{ fontSize: 13, fontWeight: 600, color: W.text, margin: "0 0 4px" }}>
        Drop CF 7501 here
      </p>
      <p style={{ fontSize: 11, color: W.textSecondary, margin: 0 }}>
        PDF, PNG, or JPG — up to 10 files
      </p>
    </div>
  );

  // --- Loading spinner ---
  const renderUploadingState = () => (
    <div
      style={{
        textAlign: "center",
        padding: "32px 16px",
        ...glassCardStyle(),
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: `3px solid ${W.border}`,
          borderTopColor: W.gold,
          borderRadius: "50%",
          margin: "0 auto 12px",
          animation: "widget-spin 0.8s linear infinite",
        }}
      />
      <p style={{ fontSize: 13, fontWeight: 600, color: W.gold, margin: "0 0 4px" }}>
        AI is reading your document...
      </p>
      <p style={{ fontSize: 11, color: W.textSecondary, margin: 0 }}>
        Extracting entries, rates, and eligibility
      </p>
      <style>{`@keyframes widget-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // --- Document results ---
  const renderDocResults = () => {
    if (!docResult) return null;
    const { summary, entries, audit, filingPackage, warnings } = docResult;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          {/* Total refund */}
          <div
            style={{
              background: W.greenBg,
              border: `1px solid ${"rgba(34,197,94,0.2)"}`,
              borderRadius: RADII.lg,
              padding: "10px 8px",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 10, color: W.green, fontWeight: 600, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Total Refund
            </p>
            <p style={{ fontSize: 16, fontWeight: 700, color: W.green, margin: 0 }}>
              {fmtUsd(summary.totalEstimatedRefund)}
            </p>
          </div>
          {/* Self-file */}
          <div
            style={{
              background: W.bgCard,
              border: `1px solid ${W.border}`,
              borderRadius: RADII.lg,
              padding: "10px 8px",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 10, color: W.textSecondary, fontWeight: 600, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Eligible
            </p>
            <p style={{ fontSize: 16, fontWeight: 700, color: W.text, margin: 0 }}>
              {summary.selfFileCount}
            </p>
          </div>
          {/* Needs legal */}
          <div
            style={{
              background: summary.needsLegalCount > 0 ? W.redBg : W.bgCard,
              border: `1px solid ${summary.needsLegalCount > 0 ? "rgba(239,68,68,0.2)" : W.border}`,
              borderRadius: RADII.lg,
              padding: "10px 8px",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 10, color: summary.needsLegalCount > 0 ? W.red : W.textSecondary, fontWeight: 600, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Needs Legal
            </p>
            <p style={{ fontSize: 16, fontWeight: 700, color: summary.needsLegalCount > 0 ? W.red : W.text, margin: 0 }}>
              {summary.needsLegalCount}
            </p>
          </div>
        </div>

        {/* Audit score bar */}
        <div
          style={{
            background: W.bgCard,
            border: `1px solid ${W.border}`,
            borderRadius: RADII.lg,
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 11, color: W.textSecondary, flexShrink: 0 }}>Audit</span>
          <div style={{ flex: 1, height: 6, background: W.border, borderRadius: 3, overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.min(audit.score, 100)}%`,
                height: "100%",
                borderRadius: 3,
                background: audit.score >= 80 ? W.green : audit.score >= 50 ? W.amber : W.red,
                transition: "width 0.5s",
              }}
            />
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: audit.score >= 80 ? W.green : audit.score >= 50 ? W.amber : W.red,
              flexShrink: 0,
              minWidth: 32,
              textAlign: "right",
            }}
          >
            {audit.score}
          </span>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div
            style={{
              background: W.amberBg,
              border: `1px solid ${"rgba(245,158,11,0.2)"}`,
              borderRadius: RADII.sm,
              padding: "6px 10px",
            }}
          >
            {warnings.map((w, i) => (
              <p key={i} style={{ fontSize: 11, color: W.amber, margin: i > 0 ? "2px 0 0" : 0 }}>
                {w}
              </p>
            ))}
          </div>
        )}

        {/* Entries table */}
        <div
          style={{
            border: `1px solid ${W.border}`,
            borderRadius: RADII.lg,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 11,
                minWidth: 480,
              }}
            >
              <thead>
                <tr style={{ background: W.bgCard }}>
                  {["Entry #", "Country", "Date", "Value", "Rate", "Refund", "Route", "Conf."].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "6px 6px",
                        textAlign: "left",
                        fontWeight: 600,
                        color: W.textSecondary,
                        borderBottom: `1px solid ${W.border}`,
                        whiteSpace: "nowrap",
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.3px",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.index}
                    style={{
                      borderBottom: `1px solid ${W.border}`,
                      background: entry.needsReview ? W.amberBg : "transparent",
                    }}
                  >
                    <td style={{ padding: "6px", color: W.text, whiteSpace: "nowrap" }}>
                      {entry.entryNumber || `#${entry.index + 1}`}
                    </td>
                    <td style={{ padding: "6px", color: W.text }}>
                      {entry.countryOfOrigin}
                    </td>
                    <td style={{ padding: "6px", color: W.text, whiteSpace: "nowrap" }}>
                      {entry.entryDate}
                    </td>
                    <td style={{ padding: "6px", color: W.text, whiteSpace: "nowrap" }}>
                      {fmtUsd(entry.enteredValue)}
                    </td>
                    <td style={{ padding: "6px", color: W.text }}>
                      {fmtPct(entry.combinedRate)}
                    </td>
                    <td style={{ padding: "6px", color: W.green, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {fmtUsd(entry.estimatedRefund)}
                    </td>
                    <td style={{ padding: "6px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 600,
                          background: entry.routingBucket === "self_file"
                            ? W.greenBg
                            : entry.routingBucket === "legal_required"
                            ? W.redBg
                            : W.bgCard,
                          color: entry.routingBucket === "self_file"
                            ? W.green
                            : entry.routingBucket === "legal_required"
                            ? W.red
                            : W.textSecondary,
                          border: `1px solid ${
                            entry.routingBucket === "self_file"
                              ? "rgba(34,197,94,0.2)"
                              : entry.routingBucket === "legal_required"
                              ? "rgba(239,68,68,0.2)"
                              : W.border
                          }`,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {entry.routingBucket === "self_file"
                          ? "CAPE"
                          : entry.routingBucket === "legal_required"
                          ? "Legal"
                          : "N/A"}
                      </span>
                    </td>
                    <td style={{ padding: "6px" }}>
                      {entry.needsReview ? (
                        <span
                          style={{
                            color: W.amber,
                            fontSize: 10,
                            fontWeight: 600,
                          }}
                          title={`Confidence: ${Math.round(entry.confidence * 100)}% — review recommended`}
                        >
                          {Math.round(entry.confidence * 100)}%
                        </span>
                      ) : (
                        <span style={{ color: W.textDim, fontSize: 10 }}>
                          {Math.round(entry.confidence * 100)}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low confidence warning */}
        {summary.lowConfidenceCount > 0 && (
          <div
            style={{
              background: W.amberBg,
              border: `1px solid ${"rgba(245,158,11,0.2)"}`,
              borderRadius: RADII.sm,
              padding: "6px 10px",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 14 }}>{"⚠️"}</span>
            <span style={{ fontSize: 11, color: W.amber }}>
              {summary.lowConfidenceCount} {summary.lowConfidenceCount === 1 ? "entry has" : "entries have"} low confidence — review highlighted rows
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 6 }}>
          {filingPackage.capeCsv && (
            <button
              type="button"
              onClick={() => downloadCsv(filingPackage.capeCsv, "cape-entries.csv")}
              style={{
                flex: 1,
                padding: "8px 0",
                fontSize: 12,
                fontWeight: 600,
                border: `1px solid ${"rgba(34,197,94,0.2)"}`,
                borderRadius: RADII.sm,
                cursor: "pointer",
                background: W.greenBg,
                color: W.green,
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.opacity = "0.85"; }}
              onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.opacity = "1"; }}
            >
              Download CAPE CSV
            </button>
          )}
          {filingPackage.auditReportCsv && (
            <button
              type="button"
              onClick={() => downloadCsv(filingPackage.auditReportCsv, "audit-report.csv")}
              style={{
                flex: 1,
                padding: "8px 0",
                fontSize: 12,
                fontWeight: 600,
                border: `1px solid ${W.border}`,
                borderRadius: RADII.sm,
                cursor: "pointer",
                background: W.bgCard,
                color: W.text,
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.opacity = "0.85"; }}
              onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.opacity = "1"; }}
            >
              Download Audit Report
            </button>
          )}
        </div>

        {/* Upload another */}
        <button
          type="button"
          onClick={() => {
            setDocResult(null);
            setUploadError(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
          style={{
            width: "100%",
            padding: "8px 0",
            fontSize: 12,
            fontWeight: 600,
            border: `1px solid ${W.border}`,
            borderRadius: RADII.sm,
            cursor: "pointer",
            background: "transparent",
            color: W.textSecondary,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.color = W.text; }}
          onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.color = W.textSecondary; }}
        >
          Upload Another Document
        </button>
      </div>
    );
  };

  return (
    <div style={{ padding: 16, background: W.bg, minHeight: "100%" }}>
      {renderModeTabs()}

      {/* === MANUAL ENTRY MODE (existing, unchanged layout) === */}
      {mode === "manual" && (
        <>
          <form onSubmit={handleCalculate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {error && (
              <div
                style={{
                  background: W.redBg,
                  border: `1px solid ${"rgba(239,68,68,0.2)"}`,
                  borderRadius: RADII.sm,
                  padding: "8px 12px",
                  fontSize: 12,
                  color: W.red,
                }}
              >
                {error}
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: W.textSecondary, marginBottom: 4 }}>
                Country of Origin <span style={{ color: W.red }}>*</span>
              </label>
              <select
                required
                value={countryOfOrigin}
                onChange={(e) => setCountryOfOrigin(e.target.value)}
                style={{ ...inputStyle() }}
              >
                <option value="">Select country...</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: W.textSecondary, marginBottom: 4 }}>
                  Entry Date <span style={{ color: W.red }}>*</span>
                </label>
                <input
                  type="date"
                  required
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  min="2025-02-01"
                  max="2026-02-23"
                  style={{ ...inputStyle() }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: W.textSecondary, marginBottom: 4 }}>
                  Entered Value (USD) <span style={{ color: W.red }}>*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={enteredValue}
                  onChange={(e) => setEnteredValue(e.target.value)}
                  placeholder="100,000"
                  style={{ ...inputStyle() }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={calculating}
              style={{ ...goldButtonStyle(calculating) }}
            >
              {calculating ? "Calculating..." : "Calculate Refund"}
            </button>
          </form>

          {result && (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Main refund card */}
              <div
                style={{
                  background: W.greenBg,
                  border: `1px solid ${"rgba(34,197,94,0.2)"}`,
                  borderRadius: RADII.lg,
                  padding: 16,
                  textAlign: "center",
                }}
              >
                <p style={{ fontSize: 12, fontWeight: 600, color: W.green, textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 4px" }}>
                  Estimated Refund
                </p>
                <p style={{ fontSize: 28, fontWeight: 700, color: W.green, margin: 0 }}>
                  {fmtUsd(result.estimatedRefund)}
                </p>
                <p style={{ fontSize: 12, color: W.green, opacity: 0.8, marginTop: 4, marginBottom: 0 }}>
                  {fmtUsd(result.ieepaDuty)} duty + {fmtUsd(result.estimatedInterest)} interest
                </p>
              </div>

              {/* Rate breakdown */}
              <div
                style={{
                  ...glassCardStyle(),
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: W.textSecondary }}>Combined IEEPA Rate</span>
                  <span style={{ fontWeight: 600, color: W.text }}>{fmtPct(result.ieepaRate)}</span>
                </div>
                {result.rateBreakdown.fentanyl != null && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: W.textDim, paddingLeft: 8 }}>Fentanyl</span>
                    <span style={{ color: W.textSecondary }}>{fmtPct(result.rateBreakdown.fentanyl)}</span>
                  </div>
                )}
                {result.rateBreakdown.reciprocal != null && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: W.textDim, paddingLeft: 8 }}>Reciprocal</span>
                    <span style={{ color: W.textSecondary }}>{fmtPct(result.rateBreakdown.reciprocal)}</span>
                  </div>
                )}
                {result.rateBreakdown.section122 != null && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: W.textDim, paddingLeft: 8 }}>Section 122</span>
                    <span style={{ color: W.textSecondary }}>{fmtPct(result.rateBreakdown.section122)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, paddingTop: 4, borderTop: `1px solid ${W.border}` }}>
                  <span style={{ color: W.textSecondary }}>Eligibility</span>
                  <span style={{ fontWeight: 500, color: result.eligibility === "eligible" ? W.green : W.amber }}>
                    {result.eligibility === "eligible" ? "Eligible" : "Review Needed"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: W.textSecondary }}>Your Commission</span>
                  <span style={{ fontWeight: 600, color: W.gold }}>
                    {fmtUsd(result.estimatedRefund * commissionRate / 100)}
                  </span>
                </div>
              </div>

              {/* Routing note */}
              <p style={{
                fontSize: 12,
                fontWeight: 500,
                margin: 0,
                color: result.eligibility === "eligible" ? W.green : W.red,
              }}>
                {result.eligibility === "eligible"
                  ? auditSummary
                    ? `✓ Ready to file — audit score: ${auditSummary.score}`
                    : "✓ Eligible for self-filing via CAPE"
                  : auditSummary && auditSummary.failed > 0
                  ? `⚠ ${auditSummary.failed} issue${auditSummary.failed !== 1 ? "s" : ""} found — submit for review`
                  : "⚠ This entry requires legal review"}
              </p>

              {/* CTA button */}
              <button
                onClick={handleReferral}
                style={{ ...goldButtonStyle() }}
              >
                Submit as Referral
                <svg style={{ width: 16, height: 16, display: "inline", marginLeft: 6, verticalAlign: "middle" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}

      {/* === UPLOAD DOCUMENT MODE === */}
      {mode === "upload" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {uploadError && (
            <div
              style={{
                background: W.redBg,
                border: `1px solid ${"rgba(239,68,68,0.2)"}`,
                borderRadius: RADII.sm,
                padding: "8px 10px",
                fontSize: 12,
                color: W.red,
              }}
            >
              {uploadError}
            </div>
          )}

          {uploading
            ? renderUploadingState()
            : docResult
            ? renderDocResults()
            : renderDropZone()}
        </div>
      )}
    </div>
  );
}
