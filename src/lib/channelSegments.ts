// src/lib/channelSegments.ts
// NOTE: `prisma` is lazily required inside expandSegmentMatches so the pure
// helpers (evaluateSegmentRule, parseSegmentRule) can be imported and unit-tested
// via `npx ts-node` without pulling in the @/ path alias or a live DB connection.

export type SegmentField = "tier" | "status" | "state" | "signedAgreement" | "l3Enabled";
export type SegmentOp = "eq" | "in" | "neq";
export type SegmentValue = string | number | boolean | (string | number | boolean)[];

export type SegmentFilter = { field: SegmentField; op: SegmentOp; value: SegmentValue };
export type SegmentRule = { filters: SegmentFilter[] };

const VALID_FIELDS: Set<SegmentField> = new Set<SegmentField>(["tier", "status", "state", "signedAgreement", "l3Enabled"]);
const VALID_OPS: Set<SegmentOp> = new Set<SegmentOp>(["eq", "in", "neq"]);

export type PartnerForSegment = {
  tier: string;
  status: string;
  l3Enabled: boolean;
  profile: { state: string | null } | null;
  signedAgreement: boolean;
};

function getFieldValue(p: PartnerForSegment, field: SegmentField): unknown {
  switch (field) {
    case "tier": return p.tier;
    case "status": return p.status;
    case "state": return p.profile?.state ?? null;
    case "signedAgreement": return p.signedAgreement;
    case "l3Enabled": return p.l3Enabled;
  }
}

function applyOp(op: SegmentOp, fieldValue: unknown, filterValue: SegmentValue): boolean {
  if (op === "eq") return fieldValue === filterValue;
  if (op === "neq") return fieldValue !== filterValue;
  if (op === "in") {
    if (!Array.isArray(filterValue)) return false;
    return (filterValue as unknown[]).includes(fieldValue);
  }
  return false;
}

export function evaluateSegmentRule(rule: SegmentRule, partner: PartnerForSegment): boolean {
  if (!rule.filters || rule.filters.length === 0) return true;
  for (const f of rule.filters) {
    if (!applyOp(f.op, getFieldValue(partner, f.field), f.value)) return false;
  }
  return true;
}

export type ParseResult =
  | { ok: true; value: SegmentRule }
  | { ok: false; error: string };

export function parseSegmentRule(json: string): ParseResult {
  let parsed: any;
  try { parsed = JSON.parse(json); }
  catch { return { ok: false, error: "invalid JSON" }; }
  if (!parsed || !Array.isArray(parsed.filters)) return { ok: false, error: "missing filters array" };
  for (const f of parsed.filters) {
    if (!f || typeof f !== "object") return { ok: false, error: "filter must be object" };
    if (!VALID_FIELDS.has(f.field)) return { ok: false, error: `unknown field: ${f.field}` };
    if (!VALID_OPS.has(f.op)) return { ok: false, error: `unknown op: ${f.op}` };
  }
  return { ok: true, value: parsed as SegmentRule };
}

/**
 * Return the set of partnerCodes that currently match the given rule.
 * Joins Partner with PartnerProfile and checks any PartnershipAgreement
 * with status in (signed, approved) for the signedAgreement field.
 */
export async function expandSegmentMatches(rule: SegmentRule): Promise<string[]> {
  // Lazy import so pure helpers above stay importable in unit tests.
  const { prisma } = await import("@/lib/prisma");
  const partners = await prisma.partner.findMany({
    select: {
      partnerCode: true,
      tier: true,
      status: true,
      l3Enabled: true,
    },
  });
  const codes = partners.map((p) => p.partnerCode);
  if (codes.length === 0) return [];

  const profiles = await prisma.partnerProfile.findMany({
    where: { partnerCode: { in: codes } },
    select: { partnerCode: true, state: true },
  });
  const profileMap: Record<string, { state: string | null }> = {};
  for (const pr of profiles) profileMap[pr.partnerCode] = { state: pr.state };

  const agreements = await prisma.partnershipAgreement.findMany({
    where: { partnerCode: { in: codes }, status: { in: ["signed", "approved"] } },
    select: { partnerCode: true },
  });
  const signedSet = new Set(agreements.map((a) => a.partnerCode));

  const matches: string[] = [];
  for (const p of partners) {
    const subject: PartnerForSegment = {
      tier: p.tier,
      status: p.status,
      l3Enabled: p.l3Enabled,
      profile: profileMap[p.partnerCode] ?? null,
      signedAgreement: signedSet.has(p.partnerCode),
    };
    if (evaluateSegmentRule(rule, subject)) matches.push(p.partnerCode);
  }
  return matches;
}
