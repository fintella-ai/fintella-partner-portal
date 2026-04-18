# Live Chat Deal Links — Design

**Date:** 2026-04-18
**Status:** Approved for implementation
**Surface:** `/admin/chat`

## Goal

When a partner mentions one of their deals in the live chat, the admin agent sees a clickable link that opens the deal in a new tab. No change to the partner UX. No schema change.

## Behavior

- Admin opens a chat session. Backend returns the session's messages plus a fresh list of that partner's deals.
- Each partner-sent message's text is scanned for mentions of any deal owned by the partner who sent it.
- Exactly-one-match substrings become `<a href="/admin/deals/{id}" target="_blank" rel="noopener">…</a>`. Ambiguous matches (two or more deals match the same substring) stay as plain text.
- Admin-sent messages are never linkified.

## Architecture

Three pieces:

1. **API extension** — `GET /api/admin/chat?sessionId=X` response gains a `partnerDeals` field.
2. **Pure helper** — `src/lib/linkifyDeals.ts` exports `linkifyDealMentions(content, deals)`, returning an array of segment objects: `{ type: "text"; value: string }` or `{ type: "link"; href: string; value: string }`.
3. **Admin render** — `src/app/(admin)/admin/chat/page.tsx` uses the helper on partner messages only, mapping segments to React nodes.

## API extension

**File:** `src/app/api/admin/chat/route.ts` — `GET` handler, the branch that runs when `sessionId` is provided.

After fetching the `chatSession` and `partner`, also fetch the partner's deals:

```ts
const partnerDeals = await prisma.deal.findMany({
  where: { partnerCode: chatSession.partnerCode },
  select: { id: true, dealName: true, legalEntityName: true, clientLastName: true },
  orderBy: { createdAt: "desc" },
});
```

Include `partnerDeals` alongside `session` in the response body.

No change to the list-all-sessions branch.

## Pure helper: `linkifyDealMentions`

**File:** `src/lib/linkifyDeals.ts` (new)

**Interface:**

```ts
type Deal = {
  id: string;
  dealName: string | null;
  legalEntityName: string | null;
  clientLastName: string | null;
};

type Segment =
  | { type: "text"; value: string }
  | { type: "link"; href: string; value: string };

export function linkifyDealMentions(content: string, deals: Deal[]): Segment[];
```

**Matching rules:**

- Candidate strings per deal: `dealName`, `legalEntityName`, `clientLastName` — each trimmed; each must be ≥4 characters to count (rejects "LLC", "Co", short surnames like "Ng").
- Case-insensitive, word-boundary match (regex: `\b<escaped>\b`).
- A matched span in the content is linked only if it uniquely identifies one deal. If two or more deals are candidates for the same span, the span is left as text.
- Overlapping matches: walk left-to-right, longest match wins per position. Once a character is consumed by a segment, it does not participate in further matches.
- Regex special characters in deal fields are escaped.

**Failure mode:** on any internal exception, return `[{ type: "text", value: content }]`.

## Admin render integration

**File:** `src/app/(admin)/admin/chat/page.tsx`

- Add `partnerDeals: Deal[]` to the `SessionDetail` type and state.
- When rendering `detail.messages.map(...)`:
  - For `senderType === "admin"`: render `{msg.content}` as before (unchanged).
  - For `senderType === "partner"`: run `linkifyDealMentions(msg.content, detail.partnerDeals)` and map segments:
    - `text` → plain span, preserves `whitespace-pre-wrap`.
    - `link` → `<a>` with classes `text-brand-gold underline underline-offset-2 hover:text-brand-gold/80`, `target="_blank"`, `rel="noopener"`.

## Error handling

- API extension reuses the existing try/catch wrapper.
- Helper returns the original content as one text segment if it throws.
- Missing `partnerDeals` in response (e.g., API deploy drift) → admin UI falls back to plain rendering with no crash.

## Testing

Unit tests for `linkifyDealMentions` (Jest, place at `src/lib/__tests__/linkifyDeals.test.ts`):

1. Single match by `dealName` → one link segment surrounded by text.
2. Single match by `legalEntityName`.
3. Single match by `clientLastName`.
4. Ambiguous — two deals share `clientLastName` "Johnson" → left as text.
5. No match → single text segment equal to input.
6. Overlapping candidates on the same span, longest wins.
7. Regex metacharacters in deal name (e.g. "Acme (US) Corp.") don't crash.
8. Empty deals array → one text segment equal to input.
9. Sub-4-character fields are ignored ("Co", "Ng").
10. Multi-line / `\n`-containing content preserves line breaks.

Manual browser verification after merge:
- Seed or find a partner chat with a message containing the partner's `dealName`.
- Confirm admin view linkifies it, click opens `/admin/deals/{id}` in a new tab.

## Out of scope

- Partner-side affordance (deal picker, `@mention` UI).
- Admin-side hover preview showing ambiguous match candidates.
- Server-side persistence of detected links.
- Linkification of admin messages (their `content` is not scanned).

## Files touched

- `src/app/api/admin/chat/route.ts` — add `partnerDeals` to single-session GET response.
- `src/lib/linkifyDeals.ts` — new pure helper.
- `src/lib/__tests__/linkifyDeals.test.ts` — new unit tests.
- `src/app/(admin)/admin/chat/page.tsx` — use helper for partner messages.
