# Tara Knowledge Pipeline Extensions

**Date:** 2026-04-26
**Status:** Draft
**Scope:** Call recording transcription cron, video resource transcription, Tara gap analysis dashboard

---

## 1. Overview

Three extensions to Tara's existing knowledge pipeline:

1. **Call recording transcription cron** — daily job processes `ConferenceSchedule.recordingUrl` and `CallLog.recordingUrl` entries through Whisper, stores transcripts, bumps knowledge version so Tara can reference meeting content.
2. **Video transcription for training resources** — extend `transcribeAudioFromUrl()` to accept video file types (mp4, webm, mov). Whisper API accepts video files directly up to 25MB — no ffmpeg needed.
3. **Tara gap analysis dashboard** — track when Tara says "I don't have that information" and surface gaps on an admin dashboard tile.

## 2. Call Recording Transcription Cron

### 2.1 Schema Changes

Add to `ConferenceSchedule`:
```prisma
recordingTranscript String?
recordingTranscribedAt DateTime?
```

Add to `CallLog`:
```prisma
recordingTranscript String?
recordingTranscribedAt DateTime?
```

### 2.2 Cron Route

New file: `src/app/api/cron/transcribe-recordings/route.ts`

- `GET /api/cron/transcribe-recordings`
- Auth: `CRON_SECRET` bearer token (same pattern as existing crons)
- Queries: `ConferenceSchedule` where `recordingUrl IS NOT NULL AND recordingTranscript IS NULL` + `CallLog` where `recordingUrl IS NOT NULL AND recordingTranscript IS NULL`
- For each: call `transcribeAudioFromUrl(url, { fileType: "audio" })`
- On success: update row with `recordingTranscript` + `recordingTranscribedAt`
- On failure: skip (non-fatal), log warning
- After all: bump knowledge version if any succeeded
- Rate: daily (Vercel cron schedule: `0 3 * * *` — 3am UTC)

### 2.3 Knowledge Integration

Update `src/lib/ai-knowledge.ts` `buildProductSpecialistPrompt()`:
- Add section "## Meeting Recordings" — query `ConferenceSchedule` where `recordingTranscript IS NOT NULL AND published = true`
- Format: `### {title} ({schedule})\n{recordingTranscript}`
- Add section "## Call Recordings" — query recent `CallLog` where `recordingTranscript IS NOT NULL` (last 30 days, limit 20)
- Format: `### Call with {partnerCode} on {date}\n{recordingTranscript}`

### 2.4 Vercel Cron Config

Add to `vercel.json`:
```json
{ "path": "/api/cron/transcribe-recordings", "schedule": "0 3 * * *" }
```

## 3. Video Transcription for Training Resources

### 3.1 Changes to transcription.ts

Remove the `fileType !== "audio"` gate. Whisper API accepts video files (mp4, webm, mov, avi) up to 25MB directly — no audio extraction needed.

Change:
```typescript
if (opts.fileType && opts.fileType !== "audio") {
    return { text: "", byteLength: 0, skippedReason: "unsupported_type" };
}
```

To:
```typescript
const SUPPORTED_TYPES = new Set(["audio", "video"]);
if (opts.fileType && !SUPPORTED_TYPES.has(opts.fileType)) {
    return { text: "", byteLength: 0, skippedReason: "unsupported_type" };
}
```

### 3.2 Changes to Training Resource Routes

In `src/app/api/admin/training/resources/route.ts` POST and `[id]/route.ts` PUT:
- Currently only calls `transcribeAudioFromUrl` for `fileType === "audio"`
- Extend to also call for `fileType === "video"`
- Store result in existing `audioTranscript` field (rename is cosmetic, not worth a migration)

### 3.3 Knowledge Integration

Already handled — `buildProductSpecialistPrompt()` already queries resources with `audioTranscript IS NOT NULL`. Video transcripts stored in the same field will be picked up automatically.

## 4. Tara Gap Analysis Dashboard

### 4.1 Schema

New model:
```prisma
model AiKnowledgeGap {
  id             String   @id @default(cuid())
  conversationId String
  messageId      String
  partnerCode    String
  question       String   // the partner's question Tara couldn't answer
  taraResponse   String   // Tara's "I don't know" response
  category       String?  // auto-classified: "product", "process", "legal", "technical"
  resolved       Boolean  @default(false)
  resolvedBy     String?  // admin email who marked resolved
  resolvedAt     DateTime?
  createdAt      DateTime @default(now())

  @@index([resolved])
  @@index([createdAt])
  @@index([category])
}
```

### 4.2 Detection

In `src/lib/ai.ts`, after Tara generates a response, scan the response text for gap indicators:
- "I don't have that information"
- "I don't have enough information"
- "not covered in my knowledge base"
- "I'm not sure about that"
- "I don't have specific details"
- "beyond what I currently know"

If detected, create an `AiKnowledgeGap` row asynchronously (fire-and-forget).

### 4.3 Admin Dashboard Tile

Add to `/admin/ai-activity` page (or create new `/admin/knowledge-gaps` page):
- Table of unresolved gaps sorted by newest first
- Columns: Date, Partner, Question (truncated), Category, Actions (Resolve)
- Summary stats: Total gaps, Unresolved count, Top categories
- "Resolve" button marks the gap as resolved (PATCH endpoint)
- Filter: All / Unresolved / Resolved

### 4.4 API Routes

- `GET /api/admin/knowledge-gaps` — list gaps with pagination + filters
- `PATCH /api/admin/knowledge-gaps/[id]` — mark resolved

## 5. Implementation Order

1. Video transcription (smallest change — just remove the gate in transcription.ts)
2. Call recording transcription cron (new cron route + schema + knowledge integration)
3. Tara gap analysis (schema + detection + admin UI)
