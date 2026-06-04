# Kwong Intake + Signed DSA → Google Drive Mirror

*Design doc — 2026-06-04. Approved by John before plan/implementation.*

## Goal

When a Kwong Penalty Abatement (ERC) client finishes signing in SignWell, the
firm already receives an email with **two attachments**: the intake markdown
(`INTAKE-{id}.md`) and the signed Data Sharing Agreement PDF
(`INTAKE-{id}-signed-agreement.pdf`). John wants those **same two files also
uploaded to a shared Google Drive folder** (shared with admin@fintella.partners)
so the downstream Kwong workflow can pick them up. The email keeps working
exactly as today — Drive is purely additive.

## Context that shapes the design

The shared Drive folder is the **exchange surface** for a separate downstream
"Kwong workflow" (documented in `GOOGLE-DRIVE-ORGANIZATION-AND-WORKFLOW.md`,
provided by John). The relevant rule:

> `1. INTAKE MARKDOWNS + DSA/NEW` — the Fintella intake dashboard drops new
> client intake `.md` files here; the workflow **pulls** them to the local
> system of record and a sweep routes them into client folders **by the
> client's exact legal name read from the file content** (not the filename).

Implications, confirmed with John:

- **Target = the `NEW` folder.** John confirmed the pasted folder ID
  `1IdDPP9e3cjUo9K-ecsNiLlnXW9oKwPUG` **is** the `1. INTAKE MARKDOWNS + DSA/NEW`
  folder. Both files upload **directly into it**.
- **Flat — no per-client subfolders.** A subfolder on our side would break the
  downstream pull/sweep, which expects loose files in `NEW`.
- **Match by folder ID, never title** (the doc's rule). So the destination is a
  stored, admin-editable folder ID, not a hardcoded path.
- **Timing = at signing completion** (parity with the email). Both files go up
  together at the `document_completed` webhook — the exact moment, and exact two
  artifacts, the firm email already sends.

## Non-negotiables this design respects

- **SignWell send/sign flow is LOCKED — additive only** (`feedback_signwell_dont_touch`).
  We add an upload call *alongside* the existing email/Blob mirror in the
  webhook; we change nothing about how documents are sent or signed.
- **Demo-gate pattern** (CLAUDE.md): if Drive isn't connected, the helper is a
  no-op that logs "skipped" and returns `{ demo: true }` — never throws, never
  blocks the webhook, email/Blob path unaffected.
- **No provider SDKs — raw `fetch()`** against Google REST APIs, mirroring
  `src/lib/google-calendar.ts`.
- **Additive schema only** — three new nullable `PortalSettings` columns; safe
  for `prisma db push` against the live production DB.
- **No preview deploys on this project** — end-to-end Drive verification happens
  in production after John connects Drive (documented in Testing below).

## Architecture / components

Each unit has one purpose and a well-defined interface.

### 1. `src/lib/google-drive.ts` (new)

A self-contained Drive client, modeled 1:1 on `google-calendar.ts`. Its own
OAuth callback path and its own (write) scope, **independent** of the Calendar
connection so connecting/disconnecting Drive never disturbs Calendar.

Exports:
- `driveOauthRedirectUri(origin?)` → `{origin}/api/admin/google-drive/oauth-callback`
- `buildDriveAuthorizationUrl(state, origin?)` → consent URL.
  Scope: `https://www.googleapis.com/auth/drive.file email`.
  `access_type=offline`, `prompt=consent` (forces refresh_token re-issue).
- `exchangeDriveCodeForTokens(code, origin?)` → `{ refreshToken, accessToken, expiresIn, email? }`
- `getDriveAccessToken()` → mints a short-lived access token from
  `PortalSettings.googleDriveRefreshToken`, caches in process memory until ~30s
  before expiry. Returns `null` if not connected.
- `uploadFileToDrive({ name, mimeType, content, folderId })` →
  multipart upload to
  `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true`.
  Body part 1 = JSON metadata `{ name, parents: [folderId] }`, part 2 = the file
  bytes. Returns `{ id, webViewLink }`, or `{ demo: true }` if not connected.
  Demo-gated; logs and returns instead of throwing on any error.

**Scope note:** `drive.file` is least-privilege and the documented scope for "an
app that writes files into a user-accessible folder by ID." If, in production,
uploads into the pre-existing `NEW` folder return 403/404 under `drive.file`,
the single fallback is to widen the scope constant to
`https://www.googleapis.com/auth/drive` (acceptable — this is an internal admin
account that is a collaborator on the folder) and reconnect. The scope lives in
one constant so this is a one-line change.

### 2. `prisma/schema.prisma` — `PortalSettings` (additive)

Three new nullable columns, matching the `googleCalendar*` naming:
- `googleDriveRefreshToken   String?`
- `googleDriveConnectedEmail String?`
- `googleDriveIntakeFolderId String?` — the `NEW` folder ID; defaults to
  `1IdDPP9e3cjUo9K-ecsNiLlnXW9oKwPUG` in the UI but is editable.

Applied via `npx prisma db push` (strictly additive → safe on live DB).

### 3. OAuth routes (new, mirror the Calendar routes)

- `src/app/api/admin/google-drive/oauth-start/route.ts` — `super_admin`-gated;
  builds the authorization URL (passing the real request origin) and redirects.
- `src/app/api/admin/google-drive/oauth-callback/route.ts` — exchanges the code,
  stores `googleDriveRefreshToken` + `googleDriveConnectedEmail` on the
  `PortalSettings` singleton, redirects back to admin settings with a success/
  error flag.
- `src/app/api/admin/google-drive/disconnect/route.ts` — clears the three
  fields (mirror of the Calendar disconnect, if one exists).

### 4. Admin Settings UI (extend existing)

In the same settings surface that hosts "Connect Google Calendar," add a
**"Connect Google Drive"** button (shows connected email + Disconnect when
connected) and a **destination folder ID** text field bound to
`googleDriveIntakeFolderId` (saved via the existing settings PUT). Exact file
located during planning by following the Calendar-connect button.

### 5. Webhook additive hook — `src/app/api/signwell/webhook/route.ts`

Insertion point: the Kwong branch, immediately **after** the existing intake
email block (after current line ~303) and **before** the `deal.stage_changed`
workflow trigger. At that point we already hold, in memory:
- `intakeMarkdown` (string), `intakeId`, `clientName`
- `pdfBuf` (the signed PDF buffer, already downloaded for Blob + email)

Add a fire-and-forget block that, when Drive is connected:
1. Reads `googleDriveIntakeFolderId` from `PortalSettings`.
2. Uploads `${intakeId}.md` (text/markdown) and, if `pdfBuf` exists,
   `${intakeId}-signed-agreement.pdf` (application/pdf) into that folder.
3. Records returned file IDs in `Deal.serviceFields.driveUpload` (see dedup).

Wrapped in `.catch()` so a Drive failure never affects the webhook response,
the email, the Blob mirror, or the workflow trigger.

## Data flow

```
client signs in SignWell
  → SignWell fires document_completed → /api/signwell/webhook
    → (existing) deal lead_submitted → engaged
    → (existing) download signed PDF buffer (pdfBuf)
    → (existing) mirror PDF to Vercel Blob
    → (existing) email .md + PDF to firm
    → (NEW) if Drive connected & not already uploaded:
         upload {id}.md + {id}-signed-agreement.pdf into NEW folder
         store {mdFileId, pdfFileId, uploadedAt} on Deal.serviceFields.driveUpload
    → (existing) fire deal.stage_changed
```

## Error handling & idempotency

- **Demo-gate:** not connected → log `"[Drive] upload skipped (not connected)"`,
  return. No throw.
- **Fire-and-forget:** all Drive work in a `.catch()`-guarded block; never blocks
  or fails the webhook.
- **Dedup against webhook retries:** SignWell can deliver `document_completed`
  more than once. Before uploading, check `Deal.serviceFields.driveUpload?.mdFileId`;
  if present, skip. After a successful upload, persist the file IDs +
  `uploadedAt`. This guarantees at most one copy of each file in `NEW` even
  across retries. (The downstream workflow also dedupes via its own sync ledger,
  but we must not rely on that — we avoid creating duplicates in the first place.)
- **Partial success:** if the `.md` uploads but the `.pdf` fails (or vice-versa),
  record whichever succeeded; a later retry uploads only the missing one.

## Testing

- **Local:** `./node_modules/.bin/next build` compiles clean (expected page
  count). `npx prisma generate` after the schema edit. Unit-level reasoning for
  `uploadFileToDrive` multipart body shape.
- **End-to-end (production, because this project disables preview deploys):**
  1. John registers the new redirect URI in the Google Cloud OAuth client
     (see "Out-of-band steps").
  2. Connect Google Drive in admin settings as **admin@fintella.partners**;
     confirm the folder ID field holds the `NEW` folder ID.
  3. Submit a test intake at `/intake/kwong`, complete signing.
  4. Confirm **both** files appear in the `NEW` folder, and the firm email still
     arrives with both attachments.
  5. Re-deliver the webhook (or re-fire) and confirm **no duplicate** files.

## Out-of-band steps for John (not code)

1. **Google Cloud Console → the existing OAuth client** (the one behind
   `GOOGLE_OAUTH_CLIENT_ID`): add an Authorized redirect URI
   `https://fintella.partners/api/admin/google-drive/oauth-callback`.
2. Ensure the `drive.file` scope is permitted on the consent screen (Internal
   app, or add admin@fintella.partners as a test user if External/testing).
3. After deploy: connect Drive in admin settings as admin@fintella.partners and
   verify the destination folder ID.

## Out of scope (YAGNI)

- No per-client subfolders, no renaming/moving/deleting in Drive (the downstream
  workflow owns organization; the connector there is read/create-only by design).
- No re-architecting the firm email or Blob mirror.
- No upload of the intake `.md` at submission time — both files go up together at
  signing completion (John's choice).
- No changes to `deal.created` / `deal.stage_changed` triggers.
