// ---------------------------------------------------------------------------
// Accuracy scoring engine (pure functions, no DB/framework imports).
//
// Scores the AI document extraction (src/lib/document-intake.ts) and the refund
// calculation against labeled fixtures: per-field precision, calc accuracy, and
// confidence calibration. The persisted AccuracyRun model + the /admin report
// consume these results; the `accuracy:run` script feeds real fixtures through
// extractFromImage + the calculator and stores the aggregate.
// ---------------------------------------------------------------------------

/** The subset of ExtractedEntry fields we score (mirrors document-intake). */
export interface ExtractedFields {
  entryNumber: string | null;
  entryDate: string | null;
  entryType: string | null;
  countryOfOrigin: string | null;
  enteredValue: number | null;
  dutyPaid: number | null;
  htsCode: string | null;
  importerNumber: string | null;
  liquidationDate: string | null;
  filerCode: string | null;
}

type FieldKind = "string" | "number" | "date";

const FIELD_KINDS: Record<keyof ExtractedFields, FieldKind> = {
  entryNumber: "string",
  entryDate: "date",
  entryType: "string",
  countryOfOrigin: "string",
  enteredValue: "number",
  dutyPaid: "number",
  htsCode: "string",
  importerNumber: "string",
  liquidationDate: "date",
  filerCode: "string",
};

export const SCORED_FIELDS = Object.keys(FIELD_KINDS) as (keyof ExtractedFields)[];

export interface FieldComparison {
  field: string;
  expected: string | number | null;
  actual: string | number | null;
  match: boolean;
}

export interface ExtractionScore {
  total: number;
  correct: number;
  precision: number; // correct / total
  fields: FieldComparison[];
}

const NUM_ABS_TOL = 0.5;     // half a cent/dollar of slack
const NUM_PCT_TOL = 0.005;   // 0.5%

function normStr(v: unknown): string | null {
  if (v == null) return null;
  return String(v).trim().toUpperCase();
}

function normDate(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  // Fast path for YYYY-MM-DD or ISO timestamps.
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.toUpperCase();
  return d.toISOString().slice(0, 10);
}

function numbersMatch(a: number | null, b: number | null): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= Math.max(NUM_ABS_TOL, NUM_PCT_TOL * Math.abs(b));
}

function fieldMatch(kind: FieldKind, expected: unknown, actual: unknown): boolean {
  if (kind === "number") return numbersMatch(expected as number | null, actual as number | null);
  if (kind === "date") return normDate(expected) === normDate(actual);
  return normStr(expected) === normStr(actual);
}

/** Compare an extracted entry against the labeled expected entry, field by field. */
export function scoreExtraction(expected: ExtractedFields, actual: Partial<ExtractedFields>): ExtractionScore {
  const fields: FieldComparison[] = SCORED_FIELDS.map((field) => {
    const exp = expected[field] ?? null;
    const act = (actual[field] ?? null) as string | number | null;
    return { field, expected: exp, actual: act, match: fieldMatch(FIELD_KINDS[field], exp, act) };
  });
  const correct = fields.filter((f) => f.match).length;
  const total = fields.length;
  return { total, correct, precision: total === 0 ? 0 : correct / total, fields };
}

export interface CalcComparison {
  expected: number;
  actual: number;
  absError: number;
  pctError: number;
  withinTolerance: boolean;
}

/** Compare a computed refund (or any $ figure) against the expected value. */
export function scoreCalc(expected: number, actual: number, tolerancePct = 0.005): CalcComparison {
  const absError = Math.abs(actual - expected);
  const pctError = expected === 0 ? (actual === 0 ? 0 : 1) : absError / Math.abs(expected);
  const withinTolerance = expected === 0 ? actual === 0 : pctError <= tolerancePct;
  return { expected, actual, absError, pctError, withinTolerance };
}

export interface FieldPrecision {
  field: string;
  total: number;
  correct: number;
  precision: number;
}

export interface ConfidenceBin {
  bin: string;
  count: number;
  accuracy: number; // mean per-entry field precision in this confidence band
}

export interface RunAggregate {
  totalFixtures: number;
  overallPrecision: number;
  fieldPrecision: FieldPrecision[];
  confidenceCalibration: ConfidenceBin[];
}

const BINS = [
  [0.0, 0.1], [0.1, 0.2], [0.2, 0.3], [0.3, 0.4], [0.4, 0.5],
  [0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 0.9], [0.9, 1.0],
] as const;

function binLabel(lo: number, hi: number): string {
  return `${lo.toFixed(1)}-${hi.toFixed(1)}`;
}

/** Roll up per-fixture extraction scores into field precision + confidence calibration. */
export function aggregateRun(items: { score: ExtractionScore; confidence: number }[]): RunAggregate {
  const fieldTotals = new Map<string, { total: number; correct: number }>();
  let correctSum = 0;
  let totalSum = 0;

  for (const { score } of items) {
    for (const f of score.fields) {
      const cur = fieldTotals.get(f.field) ?? { total: 0, correct: 0 };
      cur.total += 1;
      if (f.match) cur.correct += 1;
      fieldTotals.set(f.field, cur);
    }
    correctSum += score.correct;
    totalSum += score.total;
  }

  const fieldPrecision: FieldPrecision[] = SCORED_FIELDS.map((field) => {
    const t = fieldTotals.get(field) ?? { total: 0, correct: 0 };
    return { field, total: t.total, correct: t.correct, precision: t.total === 0 ? 0 : t.correct / t.total };
  });

  const confidenceCalibration: ConfidenceBin[] = BINS.map(([lo, hi]) => {
    const inBin = items.filter((it) => it.confidence >= lo && (hi === 1.0 ? it.confidence <= hi : it.confidence < hi));
    const accuracy = inBin.length === 0 ? 0 : inBin.reduce((s, it) => s + it.score.precision, 0) / inBin.length;
    return { bin: binLabel(lo, hi), count: inBin.length, accuracy };
  });

  return {
    totalFixtures: items.length,
    overallPrecision: totalSum === 0 ? 0 : correctSum / totalSum,
    fieldPrecision,
    confidenceCalibration,
  };
}
