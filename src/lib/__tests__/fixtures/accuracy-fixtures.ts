// ---------------------------------------------------------------------------
// Labeled accuracy fixtures.
//
// Each fixture is a piece of GROUND TRUTH for the extraction + calc pipeline:
//   - `expected`  — the correct field values for a known CF 7501 / ACE sample
//   - `actual`    — the system's captured extraction for that sample (seeded to
//                   match `expected` as a clean baseline; replace with real
//                   extractFromImage output as runs accumulate)
//   - `confidence`— the model's self-reported confidence for that extraction
//   - `calc`      — optional golden refund/eligibility for calc-accuracy scoring
//
// The accuracy run scores `actual` against `expected` (field precision) and, if
// `calc` is present, re-runs the calculator and compares to the golden value
// (calc accuracy + drift over time).
// ---------------------------------------------------------------------------

import type { ExtractedFields } from "../../accuracy-scoring";

export interface AccuracyFixture {
  id: string;
  label: string;
  documentType: string;
  expected: ExtractedFields;
  actual: Partial<ExtractedFields>;
  confidence: number;
  calc?: {
    // Inputs for the calculator + the golden expected outputs.
    countryOfOrigin: string;
    entryDate: string;
    enteredValue: number;
    expectedEligibility: string; // e.g. "eligible" | "excluded_date"
  };
}

export const ACCURACY_FIXTURES: AccuracyFixture[] = [
  {
    id: "cf7501-cn-clean",
    label: "CF 7501 — China consumption entry (clean scan)",
    documentType: "cf7501",
    expected: {
      entryNumber: "ABC-1234567-8",
      entryDate: "2025-02-10",
      entryType: "01",
      countryOfOrigin: "CN",
      enteredValue: 100000,
      dutyPaid: 14500,
      htsCode: "8501.10.4020",
      importerNumber: "12-3456789",
      liquidationDate: null,
      filerCode: "ABC",
    },
    actual: {
      entryNumber: "ABC-1234567-8",
      entryDate: "2025-02-10",
      entryType: "01",
      countryOfOrigin: "CN",
      enteredValue: 100000,
      dutyPaid: 14500,
      htsCode: "8501.10.4020",
      importerNumber: "12-3456789",
      liquidationDate: null,
      filerCode: "ABC",
    },
    confidence: 0.96,
    calc: { countryOfOrigin: "CN", entryDate: "2025-02-10", enteredValue: 100000, expectedEligibility: "eligible" },
  },
  {
    id: "ace-cn-faint",
    label: "ACE report — China entry (faint print, minor OCR drift)",
    documentType: "ace_report",
    expected: {
      entryNumber: "XYZ-9988776-5",
      entryDate: "2025-03-01",
      entryType: "01",
      countryOfOrigin: "CN",
      enteredValue: 250000,
      dutyPaid: 36250,
      htsCode: "8471.30.0100",
      importerNumber: "98-7654321",
      liquidationDate: null,
      filerCode: "XYZ",
    },
    // Captured extraction got the HTS suffix slightly wrong — a realistic miss.
    actual: {
      entryNumber: "XYZ-9988776-5",
      entryDate: "2025-03-01",
      entryType: "01",
      countryOfOrigin: "CN",
      enteredValue: 250000,
      dutyPaid: 36250,
      htsCode: "8471.30.0150",
      importerNumber: "98-7654321",
      liquidationDate: null,
      filerCode: "XYZ",
    },
    confidence: 0.62,
    calc: { countryOfOrigin: "CN", entryDate: "2025-03-01", enteredValue: 250000, expectedEligibility: "eligible" },
  },
  {
    id: "cf7501-de-excluded",
    label: "CF 7501 — Germany entry (outside IEEPA scope)",
    documentType: "cf7501",
    expected: {
      entryNumber: "DEF-5544332-1",
      entryDate: "2024-11-01",
      entryType: "01",
      countryOfOrigin: "DE",
      enteredValue: 80000,
      dutyPaid: 0,
      htsCode: "8703.23.0190",
      importerNumber: "45-6677889",
      liquidationDate: "2025-04-15",
      filerCode: "DEF",
    },
    actual: {
      entryNumber: "DEF-5544332-1",
      entryDate: "2024-11-01",
      entryType: "01",
      countryOfOrigin: "DE",
      enteredValue: 80000,
      dutyPaid: 0,
      htsCode: "8703.23.0190",
      importerNumber: "45-6677889",
      liquidationDate: "2025-04-15",
      filerCode: "DEF",
    },
    confidence: 0.88,
  },
];
