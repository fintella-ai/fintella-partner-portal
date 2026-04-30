import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import {
  lookupCombinedRate,
  calculateIeepaDuty,
  calculateInterest,
  checkEligibility,
  aggregateDossier,
  type RateRecord,
  type QuarterlyRate,
  type EntryForDossier,
} from "@/lib/tariff-calculator";

export const dynamic = "force-dynamic";

/* ── POST — bulk upload entries from CSV ──────────────────────────────────── */

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const partnerCode = (session.user as { partnerCode?: string }).partnerCode;
  if (!partnerCode) return NextResponse.json({ error: "Not a partner" }, { status: 403 });

  const partner = await prisma.partner.findUnique({ where: { partnerCode } });
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  // Parse multipart form data
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const clientCompany = (formData.get("clientCompany") as string)?.trim();

  if (!file) {
    return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
  }
  if (!clientCompany) {
    return NextResponse.json({ error: "clientCompany is required" }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCsv(text);

  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV contains no data rows" }, { status: 400 });
  }

  // Load rate data
  const [ieepaRates, interestRates] = await Promise.all([
    prisma.ieepaRate.findMany({ orderBy: { effectiveDate: "asc" } }),
    prisma.interestRate.findMany({ orderBy: { startDate: "asc" } }),
  ]);

  const quarterlyRates: QuarterlyRate[] = interestRates.map((ir) => ({
    startDate: ir.startDate,
    endDate: ir.endDate,
    rate: Number(ir.nonCorporateRate),
  }));

  const now = new Date();

  // Create dossier + entries in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const dossier = await tx.tariffDossier.create({
      data: {
        partnerId: partner.id,
        clientCompany,
        source: "csv_upload",
        status: "draft",
      },
    });

    const createdEntries = [];

    for (const row of rows) {
      const countryCode = (row.countryOfOrigin || "").toUpperCase();
      const enteredValue = parseFloat(row.enteredValue || "0");
      const entryDateStr = row.entryDate;

      if (!countryCode || !entryDateStr || isNaN(enteredValue) || enteredValue <= 0) {
        continue; // skip invalid rows
      }

      const entryDate = new Date(entryDateStr);
      if (isNaN(entryDate.getTime())) continue;

      const entryType = "01";
      const liquidationDate = row.liquidationDate ? new Date(row.liquidationDate) : null;
      if (liquidationDate && isNaN(liquidationDate.getTime())) continue;

      // Rate lookup
      const matchingRates: RateRecord[] = ieepaRates.filter((r) => {
        return (
          r.countryCode === countryCode &&
          r.effectiveDate <= entryDate &&
          (r.endDate == null || r.endDate >= entryDate)
        );
      });

      const rateLookup = lookupCombinedRate(matchingRates);
      const ieepaDuty = calculateIeepaDuty(enteredValue, rateLookup.combinedRate);
      const estimatedInterest = calculateInterest(ieepaDuty, entryDate, now, quarterlyRates);
      const estimatedRefund = ieepaDuty + estimatedInterest;

      const eligibility = checkEligibility({
        entryDate,
        entryType,
        liquidationDate,
        isAdCvd: false,
      });

      const eligibilityEnum = mapEligibilityStatus(eligibility.status);
      const liqStatus = mapLiquidationStatus(row.liquidationStatus);
      const primaryRate = matchingRates.length > 0 ? matchingRates[0] : null;

      const entry = await tx.tariffEntry.create({
        data: {
          dossierId: dossier.id,
          entryNumber: row.entryNumber || null,
          entryDate,
          entryType,
          countryOfOrigin: countryCode,
          enteredValue: new Decimal(enteredValue),
          ieepaRateId: primaryRate?.id || null,
          ieepaRate: new Decimal(rateLookup.combinedRate),
          ieepaDuty: new Decimal(ieepaDuty),
          estimatedInterest: new Decimal(estimatedInterest),
          estimatedRefund: new Decimal(estimatedRefund),
          liquidationDate,
          liquidationStatus: liqStatus,
          eligibility: eligibilityEnum,
          eligibilityReason: eligibility.reason,
          deadlineDate: eligibility.deadlineDate || null,
          deadlineDays: eligibility.deadlineDays ?? null,
          isUrgent: eligibility.isUrgent || false,
          htsCodes: [],
          chapter99Codes: [],
          extractedFrom: "csv",
        },
      });

      createdEntries.push(entry);
    }

    // Aggregate
    const dossierEntries: EntryForDossier[] = createdEntries.map((e) => ({
      enteredValue: Number(e.enteredValue),
      estimatedRefund: Number(e.estimatedRefund),
      estimatedInterest: Number(e.estimatedInterest),
      eligibility: {
        status: e.eligibility,
        reason: e.eligibilityReason || "",
        deadlineDays: e.deadlineDays ?? undefined,
        isUrgent: e.isUrgent,
        deadlineDate: e.deadlineDate ?? undefined,
      },
    }));

    const summary = aggregateDossier(dossierEntries);

    const updatedDossier = await tx.tariffDossier.update({
      where: { id: dossier.id },
      data: {
        entryCount: summary.entryCount,
        eligibleCount: summary.eligibleCount,
        excludedCount: summary.excludedCount,
        urgentCount: summary.urgentCount,
        totalEnteredValue: new Decimal(summary.totalEnteredValue),
        totalEstRefund: new Decimal(summary.totalEstRefund),
        totalEstInterest: new Decimal(summary.totalEstInterest),
        nearestDeadline: summary.nearestDeadline,
        deadlineDays: summary.deadlineDays,
        status: summary.entryCount > 0 ? "ready" : "draft",
      },
      include: { entries: { orderBy: { createdAt: "asc" } } },
    });

    return { dossier: updatedDossier, created: createdEntries.length, summary };
  });

  return NextResponse.json(result, { status: 201 });
}

/* ── CSV Parsing ──────────────────────────────────────────────────────────── */

/** Smart column name mapping — recognizes common header variations */
const COLUMN_MAP: Record<string, string> = {
  // entryNumber
  "entry summary number": "entryNumber",
  "entry_number": "entryNumber",
  "entrynumber": "entryNumber",
  "entry number": "entryNumber",
  "entry no": "entryNumber",
  "entry_no": "entryNumber",
  // countryOfOrigin
  "country of origin": "countryOfOrigin",
  "country": "countryOfOrigin",
  "country_of_origin": "countryOfOrigin",
  "countryoforigin": "countryOfOrigin",
  "origin": "countryOfOrigin",
  "origin country": "countryOfOrigin",
  // entryDate
  "entry date": "entryDate",
  "entry_date": "entryDate",
  "entrydate": "entryDate",
  "date": "entryDate",
  "import date": "entryDate",
  "import_date": "entryDate",
  // enteredValue
  "goods value": "enteredValue",
  "entered_value": "enteredValue",
  "entered value": "enteredValue",
  "enteredvalue": "enteredValue",
  "value": "enteredValue",
  "total value": "enteredValue",
  "total_value": "enteredValue",
  // liquidationStatus
  "liquidation status": "liquidationStatus",
  "liquidation_status": "liquidationStatus",
  "liquidationstatus": "liquidationStatus",
  "liq status": "liquidationStatus",
  "liq_status": "liquidationStatus",
  // liquidationDate
  "liquidation date": "liquidationDate",
  "liquidation_date": "liquidationDate",
  "liquidationdate": "liquidationDate",
  "liq date": "liquidationDate",
  "liq_date": "liquidationDate",
  // importerName (for grouping, stored as clientCompany override)
  "importer name": "importerName",
  "importer_name": "importerName",
  "importername": "importerName",
  "importer": "importerName",
};

interface CsvRow {
  entryNumber?: string;
  countryOfOrigin?: string;
  entryDate?: string;
  enteredValue?: string;
  liquidationStatus?: string;
  liquidationDate?: string;
  importerName?: string;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Detect delimiter
  const headerLine = lines[0];
  const delimiter = headerLine.includes("\t") ? "\t" : ",";

  // Parse header
  const rawHeaders = splitCsvLine(headerLine, delimiter);
  const mappedHeaders: (string | null)[] = rawHeaders.map((h) => {
    const normalized = h.trim().toLowerCase().replace(/['"]/g, "");
    return COLUMN_MAP[normalized] || null;
  });

  // Parse data rows
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = splitCsvLine(lines[i], delimiter);
    if (fields.length === 0) continue;

    const row: CsvRow = {};
    for (let j = 0; j < mappedHeaders.length && j < fields.length; j++) {
      const key = mappedHeaders[j];
      if (key) {
        const val = fields[j].trim().replace(/^["']|["']$/g, "");
        if (val) {
          (row as Record<string, string>)[key] = val;
        }
      }
    }

    // Only include rows that have at least country + date + value
    if (row.countryOfOrigin && row.entryDate && row.enteredValue) {
      rows.push(row);
    }
  }

  return rows;
}

/** Split a CSV line respecting quoted fields */
function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function mapEligibilityStatus(
  status: string,
): "eligible" | "excluded_type" | "excluded_expired" | "excluded_adcvd" | "excluded_protest" | "unknown" {
  switch (status) {
    case "eligible": return "eligible";
    case "excluded_type": return "excluded_type";
    case "excluded_expired": return "excluded_expired";
    case "excluded_adcvd": return "excluded_adcvd";
    case "excluded_date": return "excluded_protest";
    default: return "unknown";
  }
}

function mapLiquidationStatus(
  status?: string,
): "unliquidated" | "liquidated" | "final" | "unknown" {
  if (!status) return "unknown";
  const lower = status.toLowerCase();
  if (lower === "liquidated") return "liquidated";
  if (lower === "unliquidated") return "unliquidated";
  if (lower === "final") return "final";
  return "unknown";
}
