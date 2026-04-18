# Live Chat Deal Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a partner references one of their deals in the live chat, the admin agent sees a clickable link that opens the deal in a new tab. Zero partner UX change, zero schema change.

**Architecture:** Pure client-side linkification. Backend extends the single-session admin chat GET with a `partnerDeals` list. Admin chat page calls a pure helper `linkifyDealMentions(content, deals)` on each partner message (admin messages untouched), mapping returned text/link segments to React nodes. Ambiguous matches (two deals match the same substring) stay as plain text.

**Tech Stack:** Next.js 14 App Router API route + Prisma (`prisma.deal.findMany`) for the partner-deals fetch. Plain TypeScript pure function for the linkifier. Next.js client component for render. Node `assert` via `npx ts-node` for the linkifier tests (matches the existing `scripts/seed-*.ts` invocation pattern — no new test framework).

**Spec:** `docs/superpowers/specs/2026-04-18-live-chat-deal-links-design.md`

---

### Task 1: Create the pure linkifier helper with failing tests

**Files:**
- Create: `src/lib/linkifyDeals.ts`
- Create: `src/lib/__tests__/linkifyDeals.test.ts`

- [ ] **Step 1: Write the failing test file**

```ts
// src/lib/__tests__/linkifyDeals.test.ts
import assert from "node:assert/strict";
import { linkifyDealMentions } from "../linkifyDeals";

type Deal = {
  id: string;
  dealName: string | null;
  legalEntityName: string | null;
  clientLastName: string | null;
};

const deal = (overrides: Partial<Deal> & { id: string }): Deal => ({
  dealName: null,
  legalEntityName: null,
  clientLastName: null,
  ...overrides,
});

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${(e as Error).message}`);
  }
}

console.log("linkifyDealMentions");

test("no deals → single text segment equal to input", () => {
  const out = linkifyDealMentions("hello world", []);
  assert.deepEqual(out, [{ type: "text", value: "hello world" }]);
});

test("no match → single text segment", () => {
  const deals = [deal({ id: "d1", dealName: "Acme Corp" })];
  const out = linkifyDealMentions("just saying hello", deals);
  assert.deepEqual(out, [{ type: "text", value: "just saying hello" }]);
});

test("single match by dealName produces link segment", () => {
  const deals = [deal({ id: "d1", dealName: "Acme Corp" })];
  const out = linkifyDealMentions("can you help with Acme Corp?", deals);
  assert.deepEqual(out, [
    { type: "text", value: "can you help with " },
    { type: "link", href: "/admin/deals/d1", value: "Acme Corp" },
    { type: "text", value: "?" },
  ]);
});

test("single match by legalEntityName", () => {
  const deals = [deal({ id: "d2", legalEntityName: "Northwind Industries" })];
  const out = linkifyDealMentions("Northwind Industries is stalled", deals);
  assert.deepEqual(out, [
    { type: "link", href: "/admin/deals/d2", value: "Northwind Industries" },
    { type: "text", value: " is stalled" },
  ]);
});

test("single match by clientLastName (>=4 chars)", () => {
  const deals = [deal({ id: "d3", clientLastName: "Johnson" })];
  const out = linkifyDealMentions("re: Johnson's refund", deals);
  assert.deepEqual(out, [
    { type: "text", value: "re: " },
    { type: "link", href: "/admin/deals/d3", value: "Johnson" },
    { type: "text", value: "'s refund" },
  ]);
});

test("ambiguous: two deals share clientLastName → left as text", () => {
  const deals = [
    deal({ id: "d4", clientLastName: "Johnson" }),
    deal({ id: "d5", clientLastName: "Johnson" }),
  ];
  const out = linkifyDealMentions("the Johnson deal", deals);
  assert.deepEqual(out, [{ type: "text", value: "the Johnson deal" }]);
});

test("sub-4-character fields are ignored", () => {
  const deals = [deal({ id: "d6", clientLastName: "Ng" })];
  const out = linkifyDealMentions("Ng called", deals);
  assert.deepEqual(out, [{ type: "text", value: "Ng called" }]);
});

test("regex metacharacters in dealName do not crash", () => {
  const deals = [deal({ id: "d7", dealName: "Acme (US) Corp." })];
  const out = linkifyDealMentions("update on Acme (US) Corp. please", deals);
  assert.deepEqual(out, [
    { type: "text", value: "update on " },
    { type: "link", href: "/admin/deals/d7", value: "Acme (US) Corp." },
    { type: "text", value: " please" },
  ]);
});

test("longest match wins per position (overlapping candidates)", () => {
  const deals = [
    deal({ id: "d8", dealName: "Acme" }),
    deal({ id: "d9", dealName: "Acme Corp" }),
  ];
  const out = linkifyDealMentions("Acme Corp is the client", deals);
  assert.deepEqual(out, [
    { type: "link", href: "/admin/deals/d9", value: "Acme Corp" },
    { type: "text", value: " is the client" },
  ]);
});

test("multi-line content preserves line breaks", () => {
  const deals = [deal({ id: "d10", dealName: "Globex" })];
  const out = linkifyDealMentions("line one\nGlobex deal\nline three", deals);
  assert.deepEqual(out, [
    { type: "text", value: "line one\n" },
    { type: "link", href: "/admin/deals/d10", value: "Globex" },
    { type: "text", value: " deal\nline three" },
  ]);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx ts-node --compiler-options '{"module":"commonjs","esModuleInterop":true}' src/lib/__tests__/linkifyDeals.test.ts
```

Expected: module-not-found error for `../linkifyDeals` (file doesn't exist yet), or a TypeScript error. Non-zero exit code.

- [ ] **Step 3: Write the minimal linkifier implementation**

```ts
// src/lib/linkifyDeals.ts
export type LinkifyDeal = {
  id: string;
  dealName: string | null;
  legalEntityName: string | null;
  clientLastName: string | null;
};

export type Segment =
  | { type: "text"; value: string }
  | { type: "link"; href: string; value: string };

const MIN_MATCH_LEN = 4;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type Candidate = { start: number; end: number; value: string; dealIds: Set<string> };

export function linkifyDealMentions(content: string, deals: LinkifyDeal[]): Segment[] {
  try {
    if (!content) return [{ type: "text", value: content ?? "" }];
    if (!deals || deals.length === 0) return [{ type: "text", value: content }];

    // Build (candidateText → dealId) map. Each deal contributes up to 3 candidates.
    const candidateTexts: Array<{ text: string; dealId: string }> = [];
    for (const d of deals) {
      for (const field of [d.dealName, d.legalEntityName, d.clientLastName]) {
        if (!field) continue;
        const trimmed = field.trim();
        if (trimmed.length < MIN_MATCH_LEN) continue;
        candidateTexts.push({ text: trimmed, dealId: d.id });
      }
    }
    if (candidateTexts.length === 0) return [{ type: "text", value: content }];

    // Find every hit in the content (case-insensitive, word-boundary).
    const hits: Candidate[] = [];
    for (const { text, dealId } of candidateTexts) {
      const re = new RegExp(`\\b${escapeRegex(text)}\\b`, "gi");
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        const existing = hits.find((h) => h.start === m!.index && h.end === m!.index + m![0].length);
        if (existing) {
          existing.dealIds.add(dealId);
        } else {
          hits.push({
            start: m.index,
            end: m.index + m[0].length,
            value: m[0],
            dealIds: new Set([dealId]),
          });
        }
      }
    }
    if (hits.length === 0) return [{ type: "text", value: content }];

    // Sort hits by start (asc), then by length (desc — longest wins on ties).
    hits.sort((a, b) => (a.start - b.start) || ((b.end - b.start) - (a.end - a.start)));

    // Walk left-to-right, pick the earliest hit, skip any that overlap it.
    const chosen: Candidate[] = [];
    let cursor = 0;
    for (const h of hits) {
      if (h.start < cursor) continue; // overlaps a previously chosen hit
      chosen.push(h);
      cursor = h.end;
    }

    // Emit segments.
    const out: Segment[] = [];
    let pos = 0;
    for (const h of chosen) {
      if (h.start > pos) out.push({ type: "text", value: content.slice(pos, h.start) });
      if (h.dealIds.size === 1) {
        const [dealId] = Array.from(h.dealIds);
        out.push({ type: "link", href: `/admin/deals/${dealId}`, value: h.value });
      } else {
        out.push({ type: "text", value: h.value });
      }
      pos = h.end;
    }
    if (pos < content.length) out.push({ type: "text", value: content.slice(pos) });
    return out;
  } catch {
    return [{ type: "text", value: content }];
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx ts-node --compiler-options '{"module":"commonjs","esModuleInterop":true}' src/lib/__tests__/linkifyDeals.test.ts
```

Expected: `10 passed, 0 failed` and exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/linkifyDeals.ts src/lib/__tests__/linkifyDeals.test.ts
git commit -m "feat(chat): add linkifyDealMentions pure helper + unit tests"
```

---

### Task 2: Extend admin chat GET to return partnerDeals for single-session fetch

**Files:**
- Modify: `src/app/api/admin/chat/route.ts` (the `sessionId`-provided branch of `GET`)

- [ ] **Step 1: Read the current single-session branch**

Open `src/app/api/admin/chat/route.ts`. The branch starts with `if (sessionId) {` and ends with `return NextResponse.json({ session: {...} });`.

- [ ] **Step 2: Add the partner-deals fetch and include it in the response**

After the `prisma.partner.findUnique` call and before `return NextResponse.json(...)`, add:

```ts
      const partnerDeals = await prisma.deal.findMany({
        where: { partnerCode: chatSession.partnerCode },
        select: { id: true, dealName: true, legalEntityName: true, clientLastName: true },
        orderBy: { createdAt: "desc" },
      });
```

Then change the return to include the new field:

```ts
      return NextResponse.json({
        session: {
          ...chatSession,
          partnerName: partner ? `${partner.firstName} ${partner.lastName}` : chatSession.partnerCode,
          partnerId: partner?.id || null,
          partnerEmail: partner?.email || null,
          companyName: partner?.companyName || null,
        },
        partnerDeals,
      });
```

No change to the list-all-sessions branch.

- [ ] **Step 3: Build to verify TypeScript compiles**

```bash
./node_modules/.bin/next build
```

Expected: "✓ Compiled successfully" and 97+ pages prerendered. No TS errors in the chat route.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/chat/route.ts
git commit -m "feat(api): return partnerDeals alongside single-session admin chat GET"
```

---

### Task 3: Wire the linkifier into the admin chat page for partner messages

**Files:**
- Modify: `src/app/(admin)/admin/chat/page.tsx`

- [ ] **Step 1: Add the deal type and extend SessionDetail**

At the top of the file alongside the existing `type` declarations, add:

```ts
import { linkifyDealMentions, type LinkifyDeal } from "@/lib/linkifyDeals";
```

Then extend the existing `SessionDetail` type by adding one field:

```ts
type SessionDetail = {
  id: string;
  partnerCode: string;
  partnerId: string | null;
  partnerName: string;
  partnerEmail: string | null;
  companyName: string | null;
  status: string;
  messages: ChatMessage[];
  partnerDeals: LinkifyDeal[];
};
```

- [ ] **Step 2: Update the fetch callers to store partnerDeals on detail**

Both `openSession` and the polling effect set `setDetail(data.session)`. The API now returns `{ session, partnerDeals }`. Change each site to merge them:

In `openSession`:

```ts
  function openSession(id: string) {
    setSelectedId(id);
    fetch(`/api/admin/chat?sessionId=${id}`)
      .then((r) => r.json())
      .then((data) => setDetail(data.session ? { ...data.session, partnerDeals: data.partnerDeals || [] } : null))
      .catch(() => {});
  }
```

In the auto-refresh `useEffect` for `selectedId`:

```ts
  useEffect(() => {
    if (!selectedId) return;
    const interval = setInterval(() => {
      fetch(`/api/admin/chat?sessionId=${selectedId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.session) setDetail({ ...data.session, partnerDeals: data.partnerDeals || [] });
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedId]);
```

In `handleSend`'s post-POST refresh block:

```ts
      const r = await fetch(`/api/admin/chat?sessionId=${selectedId}`);
      const data = await r.json();
      if (data.session) setDetail({ ...data.session, partnerDeals: data.partnerDeals || [] });
```

- [ ] **Step 3: Replace the plain message content render with linkified segments for partner messages**

The current message render contains:

```tsx
<div className="font-body text-[13px] text-[var(--app-text)] leading-relaxed whitespace-pre-wrap">{msg.content}</div>
```

Replace that single line with:

```tsx
<div className="font-body text-[13px] text-[var(--app-text)] leading-relaxed whitespace-pre-wrap">
  {msg.senderType === "partner"
    ? linkifyDealMentions(msg.content, detail.partnerDeals).map((seg, i) =>
        seg.type === "link" ? (
          <a
            key={i}
            href={seg.href}
            target="_blank"
            rel="noopener"
            className="text-brand-gold underline underline-offset-2 hover:text-brand-gold/80"
          >
            {seg.value}
          </a>
        ) : (
          <span key={i}>{seg.value}</span>
        )
      )
    : msg.content}
</div>
```

- [ ] **Step 4: Build to verify everything compiles**

```bash
./node_modules/.bin/next build
```

Expected: "✓ Compiled successfully". No TS errors in the chat page.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(admin\)/admin/chat/page.tsx
git commit -m "feat(admin): linkify partner deal mentions in live chat messages"
```

---

### Task 4: Open PR and hand off for review

**Files:** none (git + gh only)

- [ ] **Step 1: Push the branch**

Assumes the feature branch was created at the start of the session (per superpowers workflow).

```bash
git push -u origin HEAD
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "feat: live chat auto-linkifies partner deal mentions for admin" --body "$(cat <<'EOF'
## Summary

- When a partner references one of their deals in live chat, admin now sees that substring as a clickable link that opens the deal in a new tab.
- Implements the design at \`docs/superpowers/specs/2026-04-18-live-chat-deal-links-design.md\`.

## Files changed

- \`src/lib/linkifyDeals.ts\` — new pure helper (word-boundary, case-insensitive, ≥4 char match; ambiguous matches left as text)
- \`src/lib/__tests__/linkifyDeals.test.ts\` — 10 assertion tests run via \`npx ts-node\`
- \`src/app/api/admin/chat/route.ts\` — single-session GET now returns \`partnerDeals\`
- \`src/app/(admin)/admin/chat/page.tsx\` — uses the helper on partner messages only

## Test plan

- [ ] Run \`npx ts-node --compiler-options '{"module":"commonjs","esModuleInterop":true}' src/lib/__tests__/linkifyDeals.test.ts\` → 10 passed
- [ ] Open an admin chat with a partner whose deal name appears in a message → link renders gold + underline, opens /admin/deals/{id} in new tab
- [ ] Ambiguous case (two deals share a clientLastName) → stays as plain text
- [ ] Admin's own sent messages stay unlinkified
- [ ] CI green (CodeQL + Vercel)
EOF
)"
```

- [ ] **Step 3: Report the PR URL**

Stop here and confirm the PR URL with the user before squash-merging. Per repo convention, main is branch-protected — the merge must be explicitly authorized.

---

## Out of scope (from the spec, do not build)

- Partner-side affordance (deal picker, `@mention` UI)
- Admin-side hover preview for ambiguous candidates
- Server-side persistence of detected links
- Linkification of admin messages
