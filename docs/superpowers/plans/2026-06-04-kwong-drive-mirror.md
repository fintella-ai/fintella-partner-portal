# Kwong Drive Mirror — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a Kwong (ERC) client finishes signing in SignWell, upload the intake `.md` and signed DSA `.pdf` (the two files already emailed to the firm) into the shared Google Drive `NEW` folder, additively.

**Architecture:** A new `src/lib/google-drive.ts` clones the existing `google-calendar.ts` OAuth-2.0 + demo-gate pattern (raw `fetch()`, refresh token on `PortalSettings`, own callback + write scope). Admin connects Drive on `/admin/settings`. The SignWell webhook's existing Kwong `document_completed` block — already holding the intake markdown string and the signed-PDF buffer — gets one additive, try/catch-wrapped upload call. No SignWell send/sign code changes.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma 5.20 + Neon Postgres, Google Drive REST v3 (multipart upload), no SDKs.

**Testing reality:** This repo has **no unit-test runner** (no jest/vitest). The gate is `./node_modules/.bin/next build` compiling cleanly + `npx prisma generate` after schema edits. Vercel **preview deploys are disabled**, so end-to-end Drive verification happens in production after John connects Drive (final task). Each task below uses build/typecheck as its automated check; Task 7 holds the manual E2E checklist.

**Branch:** `claude/kwong-drive-mirror` (already created off `main`; spec committed at `a589578`).

---

### Task 1: Add Drive fields to PortalSettings

**Files:**
- Modify: `prisma/schema.prisma` (the `PortalSettings` model — the one with `id "global"`, near the `googleCalendarRefreshToken String @default("")` field around line 796)

- [ ] **Step 1: Add three nullable columns**

Find the block in the `PortalSettings` model (around lines 796–799):

```prisma
  googleCalendarRefreshToken String @default("")
  googleCalendarConnectedEmail String @default("")
  googleCalendarCalendarId     String @default("primary") // "primary" or an explicit calendar id
  googleCalendarConnectedAt    DateTime?
```

Immediately after `googleCalendarConnectedAt    DateTime?`, add:

```prisma
  // Google Drive (Kwong intake mirror) — dedicated connection, separate
  // from Google Calendar so connect/disconnect never disturbs Calendar.
  googleDriveRefreshToken    String?
  googleDriveConnectedEmail  String?
  googleDriveIntakeFolderId  String?  // Drive folder ID for "1. INTAKE MARKDOWNS + DSA/NEW"
```

- [ ] **Step 2: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" success, no errors.

- [ ] **Step 3: Apply to the local/dev DB (additive, safe)**

Run: `npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema." Three columns added, **no data loss prompt** (they're nullable additions). If a data-loss warning appears, STOP — something else is wrong; do not pass `--accept-data-loss`.

- [ ] **Step 4: Typecheck via build**

Run: `./node_modules/.bin/next build`
Expected: compiles cleanly (same page count as before, only the pre-existing `global-error.tsx` Sentry warning).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add googleDrive* fields to PortalSettings for Kwong intake mirror"
```

---

### Task 2: Create the Google Drive client lib

**Files:**
- Create: `src/lib/google-drive.ts`

- [ ] **Step 1: Write the full lib**

Create `src/lib/google-drive.ts` with exactly this content:

```typescript
import { prisma } from "@/lib/prisma";

/**
 * Google Drive client — OAuth 2.0 user flow, modeled 1:1 on
 * src/lib/google-calendar.ts. Dedicated connection (own callback + scope)
 * so connecting/disconnecting Drive never disturbs the Calendar link.
 *
 * Credentials on PortalSettings (singleton id="global"):
 *   googleDriveRefreshToken    — long-lived, obtained once via OAuth
 *   googleDriveConnectedEmail  — display-only
 *   googleDriveIntakeFolderId  — destination "NEW" folder ID
 *
 * OAuth client config (shared with Calendar) from env:
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 *   NEXT_PUBLIC_PORTAL_URL — builds the redirect URI
 *
 * Demo-gate: if no refresh token is stored, uploadFileToDrive returns
 * { demo: true } and never throws — matching the SendGrid/Twilio/SignWell
 * pattern so dev/demo environments don't break.
 *
 * Scope note: drive.file is least-privilege and is the documented scope
 * for an app that writes files into a user-accessible folder by ID. If
 * production uploads into the pre-existing NEW folder are rejected
 * (403/404) under drive.file, widen DRIVE_SCOPE to
 * "https://www.googleapis.com/auth/drive" and reconnect.
 */

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file email";

type AccessTokenCache = { token: string; expiresAt: number };
let cached: AccessTokenCache | null = null;

export function invalidateCachedDriveAccessToken(): void {
  cached = null;
}

export function driveOauthRedirectUri(originOverride?: string): string {
  const raw =
    originOverride?.trim() ||
    (process.env.NEXT_PUBLIC_PORTAL_URL || "http://localhost:3000").trim();
  const base = raw.replace(/\/$/, "");
  return `${base}/api/admin/google-drive/oauth-callback`;
}

export function buildDriveAuthorizationUrl(state: string, originOverride?: string): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || "";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: driveOauthRedirectUri(originOverride),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: DRIVE_SCOPE,
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeDriveCodeForTokens(
  code: string,
  originOverride?: string
): Promise<{ refreshToken: string; accessToken: string; expiresIn: number; email?: string }> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) throw new Error("Google OAuth client credentials are not configured");

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: driveOauthRedirectUri(originOverride),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`google-drive: code exchange failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    id_token?: string;
  };

  if (!data.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Revoke Fintella's access at https://myaccount.google.com/permissions and try connecting again."
    );
  }

  let email: string | undefined;
  if (data.id_token) {
    try {
      const payload = data.id_token.split(".")[1];
      const decoded = JSON.parse(Buffer.from(payload, "base64").toString());
      email = decoded.email;
    } catch {
      // non-fatal
    }
  }

  return { refreshToken: data.refresh_token, accessToken: data.access_token, expiresIn: data.expires_in, email };
}

async function getDriveAccessToken(): Promise<string | null> {
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;

  const settings = await prisma.portalSettings.findUnique({ where: { id: "global" } });
  const refreshToken = settings?.googleDriveRefreshToken || "";
  if (!refreshToken) return null;

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) return null;

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`google-drive: refresh token exchange failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export interface DriveUploadResult {
  id?: string;
  webViewLink?: string;
  demo: boolean;
}

/**
 * Upload one file into a Drive folder via multipart/related.
 * Returns { demo: true } if Drive isn't connected. Never throws for the
 * not-connected case; real API errors do throw so the caller's try/catch
 * can log them.
 */
export async function uploadFileToDrive(opts: {
  name: string;
  mimeType: string;
  content: Buffer | string;
  folderId: string;
}): Promise<DriveUploadResult> {
  const token = await getDriveAccessToken();
  if (!token) return { demo: true };

  const contentBuf = Buffer.isBuffer(opts.content) ? opts.content : Buffer.from(opts.content, "utf-8");
  const boundary = "fintelladrive" + Math.random().toString(36).slice(2);
  const metadata = JSON.stringify({ name: opts.name, parents: [opts.folderId] });

  const pre = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${metadata}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${opts.mimeType}\r\n\r\n`,
    "utf-8"
  );
  const post = Buffer.from(`\r\n--${boundary}--`, "utf-8");
  const body = Buffer.concat([pre, contentBuf, post]);

  const url =
    `${DRIVE_UPLOAD_URL}?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`google-drive: upload failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { id?: string; webViewLink?: string };
  return { id: data.id, webViewLink: data.webViewLink, demo: false };
}
```

- [ ] **Step 2: Typecheck via build**

Run: `./node_modules/.bin/next build`
Expected: compiles cleanly. (The lib isn't imported anywhere yet — this just verifies it type-checks.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/google-drive.ts
git commit -m "feat: add google-drive lib (OAuth + multipart upload, demo-gated)"
```

---

### Task 3: OAuth routes (start, callback, disconnect)

**Files:**
- Create: `src/app/api/admin/google-drive/oauth-start/route.ts`
- Create: `src/app/api/admin/google-drive/oauth-callback/route.ts`
- Create: `src/app/api/admin/google-drive/disconnect/route.ts`

- [ ] **Step 1: oauth-start**

Create `src/app/api/admin/google-drive/oauth-start/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildDriveAuthorizationUrl } from "@/lib/google-drive";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/google-drive/oauth-start
 * super_admin-only. Redirects to Google's consent screen for the
 * dedicated Drive connection. Callback stores the refresh token on
 * PortalSettings (singleton).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "super_admin") {
    return NextResponse.json({ error: "Only super admins can connect Google Drive" }, { status: 403 });
  }
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "Google OAuth client credentials not configured. Set GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET on Vercel." },
      { status: 500 }
    );
  }
  const state = encodeURIComponent(session.user.email || "unknown");
  return NextResponse.redirect(buildDriveAuthorizationUrl(state, req.nextUrl.origin));
}
```

- [ ] **Step 2: oauth-callback**

Create `src/app/api/admin/google-drive/oauth-callback/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exchangeDriveCodeForTokens, invalidateCachedDriveAccessToken } from "@/lib/google-drive";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/google-drive/oauth-callback?code=...
 * Exchanges the code, stores refresh token + connected email on
 * PortalSettings, redirects back to /admin/settings with a status flag.
 */
export async function GET(req: NextRequest) {
  const base = (process.env.NEXT_PUBLIC_PORTAL_URL || new URL(req.url).origin).trim();
  const settingsUrl = `${base.replace(/\/$/, "")}/admin/settings`;

  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(`${settingsUrl}?google_drive=error&reason=unauthorized`);
  }
  const role = (session.user as any).role;
  if (role !== "super_admin") {
    return NextResponse.redirect(`${settingsUrl}?google_drive=error&reason=forbidden`);
  }

  const code = req.nextUrl.searchParams.get("code");
  const err = req.nextUrl.searchParams.get("error");
  if (err) {
    return NextResponse.redirect(`${settingsUrl}?google_drive=error&reason=${encodeURIComponent(err)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${settingsUrl}?google_drive=error&reason=no_code`);
  }

  try {
    const tokens = await exchangeDriveCodeForTokens(code, req.nextUrl.origin);
    await prisma.portalSettings.upsert({
      where: { id: "global" },
      update: {
        googleDriveRefreshToken: tokens.refreshToken,
        googleDriveConnectedEmail: tokens.email || "",
      },
      create: {
        id: "global",
        googleDriveRefreshToken: tokens.refreshToken,
        googleDriveConnectedEmail: tokens.email || "",
      },
    });
    invalidateCachedDriveAccessToken();
    return NextResponse.redirect(`${settingsUrl}?google_drive=connected`);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[google-drive oauth-callback]", message);
    return NextResponse.redirect(`${settingsUrl}?google_drive=error&reason=${encodeURIComponent(message)}`);
  }
}
```

- [ ] **Step 3: disconnect**

Create `src/app/api/admin/google-drive/disconnect/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidateCachedDriveAccessToken } from "@/lib/google-drive";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/google-drive/disconnect
 * super_admin-only. Clears the Drive connection (keeps the folder ID).
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.portalSettings.update({
    where: { id: "global" },
    data: { googleDriveRefreshToken: null, googleDriveConnectedEmail: null },
  });
  invalidateCachedDriveAccessToken();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Typecheck via build**

Run: `./node_modules/.bin/next build`
Expected: compiles cleanly; three new routes appear in the route list.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/google-drive/
git commit -m "feat: google-drive OAuth start/callback/disconnect routes (super_admin)"
```

---

### Task 4: Accept the folder ID in the settings PUT handler

**Files:**
- Modify: `src/app/api/admin/settings/route.ts:154` (right after the `activeThemeId` / `themeCustomizations` lines, before the `// Upsert` comment at line ~157)

- [ ] **Step 1: Add the field to the PUT allow-list**

After this existing line (around 154–155):

```typescript
    if (body.activeThemeId !== undefined) data.activeThemeId = body.activeThemeId;
    if (body.themeCustomizations !== undefined) data.themeCustomizations = body.themeCustomizations;
```

Add:

```typescript
    // Google Drive (Kwong intake) destination folder ID
    if (body.googleDriveIntakeFolderId !== undefined) {
      data.googleDriveIntakeFolderId = body.googleDriveIntakeFolderId === ""
        ? null
        : String(body.googleDriveIntakeFolderId).trim();
    }
```

(The GET handler returns the whole `settings` row, so the new field is exposed to the UI automatically — no GET change needed. The refresh token is also returned by GET, but the UI only reads `googleDriveConnectedEmail`/`googleDriveIntakeFolderId`; the token is never rendered.)

- [ ] **Step 2: Typecheck via build**

Run: `./node_modules/.bin/next build`
Expected: compiles cleanly.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/settings/route.ts
git commit -m "feat: accept googleDriveIntakeFolderId in settings PUT"
```

---

### Task 5: Settings UI — connect button, folder field, status banner

**Files:**
- Modify: `src/app/(admin)/admin/settings/page.tsx`

This file is ~1913 lines. Use the anchors below; locate exact lines with grep first.

- [ ] **Step 1: Add state for the two Drive values**

Run: `grep -n "useState" "src/app/(admin)/admin/settings/page.tsx" | head -5` to find where component state is declared. Near the other `useState` declarations (top of the component), add:

```typescript
  const [googleDriveConnectedEmail, setGoogleDriveConnectedEmail] = useState<string>("");
  const [googleDriveIntakeFolderId, setGoogleDriveIntakeFolderId] = useState<string>("");
```

- [ ] **Step 2: Populate them when settings load**

Run: `grep -n 'fetch("/api/admin/settings")' "src/app/(admin)/admin/settings/page.tsx"` — the load is around line 329. Inside the block that reads the fetched settings into state (where other fields like `homeEmbedVideoUrl` are set from the response), add:

```typescript
        setGoogleDriveConnectedEmail(data.settings?.googleDriveConnectedEmail || "");
        setGoogleDriveIntakeFolderId(data.settings?.googleDriveIntakeFolderId || "");
```

(Match the exact shape used by neighboring setters — if they read from `s` or `result.settings` instead of `data.settings`, use the same variable name.)

- [ ] **Step 3: Include the folder ID in the save body**

The save `body` object is built around line 519–533 (ends with `themeCustomizations: JSON.stringify(themeCustomizations),`). Add to that object literal:

```typescript
        googleDriveIntakeFolderId: googleDriveIntakeFolderId.trim() || null,
```

- [ ] **Step 4: Render the Google Drive card**

Pick a logical spot in the settings JSX near other integration/connection cards (e.g. after a Google Calendar or branding section). Insert this block. The default folder ID is John's `NEW` folder; the field stays editable.

```tsx
        {/* Google Drive — Kwong intake mirror */}
        <div className="card p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold theme-text">Google Drive — Kwong Intake</h2>
            <p className="text-sm theme-text-muted">
              On signing completion, the intake markdown and signed DSA are uploaded
              into the shared <code>NEW</code> folder for the Kwong workflow.
            </p>
          </div>

          {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("google_drive") === "connected" && (
            <div className="rounded-md bg-green-500/10 text-green-600 text-sm px-3 py-2">
              Google Drive connected.
            </div>
          )}
          {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("google_drive") === "error" && (
            <div className="rounded-md bg-red-500/10 text-red-600 text-sm px-3 py-2">
              Google Drive connection failed: {new URLSearchParams(window.location.search).get("reason")}
            </div>
          )}

          {googleDriveConnectedEmail ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm theme-text">
                Connected as <strong>{googleDriveConnectedEmail}</strong>
              </span>
              <button
                type="button"
                onClick={async () => {
                  await fetch("/api/admin/google-drive/disconnect", { method: "POST" });
                  setGoogleDriveConnectedEmail("");
                }}
                className="text-sm px-3 py-2 rounded-md border theme-border theme-text hover:bg-red-500/10"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <a
              href="/api/admin/google-drive/oauth-start"
              className="inline-block text-sm px-4 py-2 rounded-md theme-bg-accent text-white"
            >
              Connect Google Drive
            </a>
          )}

          <div>
            <label className="block text-sm font-medium theme-text mb-1">
              Destination folder ID (the <code>NEW</code> folder)
            </label>
            <input
              type="text"
              value={googleDriveIntakeFolderId}
              onChange={(e) => setGoogleDriveIntakeFolderId(e.target.value)}
              placeholder="1IdDPP9e3cjUo9K-ecsNiLlnXW9oKwPUG"
              className="w-full px-3 py-2 rounded-md border theme-border theme-bg theme-text text-sm"
            />
            <p className="text-xs theme-text-muted mt-1">
              Saved with the rest of settings. Matched by ID, never by folder title.
            </p>
          </div>
        </div>
```

(If the surrounding code uses different utility class names for cards/buttons/inputs, match the neighbors — the key wiring is: anchor link to `/api/admin/google-drive/oauth-start`, the disconnect `fetch`, and the controlled input bound to `googleDriveIntakeFolderId`.)

- [ ] **Step 5: Typecheck via build**

Run: `./node_modules/.bin/next build`
Expected: compiles cleanly.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(admin)/admin/settings/page.tsx"
git commit -m "feat: Google Drive connect UI + folder ID field on admin settings"
```

---

### Task 6: Additive Drive upload in the SignWell webhook

**Files:**
- Modify: `src/app/api/signwell/webhook/route.ts` (insert after the intake-email block that currently ends at line ~303, before the `// Fire deal.stage_changed` comment at line ~305)

The enclosing `if (kwongDeal && kwongDeal.stage === "lead_submitted")` guard (line 217) means this runs **once** per signing — on a webhook retry the deal is already `"engaged"` and the whole block is skipped. That guard provides idempotency (same as the existing email/Blob), so no separate dedup flag is needed; we persist the uploaded file IDs to `serviceFields.driveUpload` for traceability.

- [ ] **Step 1: Add the import**

At the top of the file, with the other `@/lib/*` imports, add:

```typescript
import { uploadFileToDrive } from "@/lib/google-drive";
```

- [ ] **Step 2: Insert the upload block**

After the intake-email block (the `if (intakeMarkdown) { ... }` that ends around line 303) and before the `// Fire deal.stage_changed so workflows ...` comment (line ~305), insert:

```typescript
          // Additive: mirror the same intake .md + signed DSA .pdf into the
          // shared Google Drive "NEW" folder for the downstream Kwong
          // workflow. Demo-gated, fully wrapped — never affects the email,
          // Blob mirror, or webhook response. Runs once (stage guard above).
          try {
            const drvSettings = await prisma.portalSettings.findUnique({ where: { id: "global" } });
            const folderId = drvSettings?.googleDriveIntakeFolderId || "";
            const driveConnected = !!drvSettings?.googleDriveRefreshToken;
            if (intakeMarkdown && driveConnected && folderId) {
              const uploaded: Record<string, string> = {};
              const mdRes = await uploadFileToDrive({
                name: `${intakeId}.md`,
                mimeType: "text/markdown",
                content: intakeMarkdown,
                folderId,
              });
              if (mdRes.id) uploaded.mdFileId = mdRes.id;
              if (pdfBuf) {
                const pdfRes = await uploadFileToDrive({
                  name: `${intakeId}-signed-agreement.pdf`,
                  mimeType: "application/pdf",
                  content: pdfBuf,
                  folderId,
                });
                if (pdfRes.id) uploaded.pdfFileId = pdfRes.id;
              }
              if (uploaded.mdFileId || uploaded.pdfFileId) {
                const fresh = await prisma.deal.findUnique({ where: { id: kwongDeal.id } });
                await prisma.deal.update({
                  where: { id: kwongDeal.id },
                  data: {
                    serviceFields: {
                      ...((fresh?.serviceFields as any) || {}),
                      driveUpload: { ...uploaded, uploadedAt: new Date().toISOString() },
                    },
                  },
                });
                console.log(`[SignWellWebhook] Uploaded intake .md + signed PDF to Drive folder ${folderId} for deal ${kwongDeal.id}`);
              }
            } else {
              console.log("[SignWellWebhook] Drive upload skipped (not connected or no folder ID)");
            }
          } catch (driveErr) {
            console.error("[SignWellWebhook] Drive upload failed (non-fatal):", driveErr);
          }
```

- [ ] **Step 3: Typecheck via build**

Run: `./node_modules/.bin/next build`
Expected: compiles cleanly. Confirm `intakeMarkdown`, `intakeId`, `pdfBuf`, and `kwongDeal` are all in scope at the insertion point (they are — declared at lines 231, 265–267).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/signwell/webhook/route.ts
git commit -m "feat: mirror Kwong intake .md + signed DSA to Google Drive NEW folder"
```

---

### Task 7: Final build, PR, and verification handoff

**Files:** none (process task)

- [ ] **Step 1: Full clean build**

Run: `./node_modules/.bin/next build`
Expected: compiles cleanly, expected page count, only the known `global-error.tsx` warning.

- [ ] **Step 2: Push the branch and open a PR (do NOT merge)**

```bash
git push -u origin claude/kwong-drive-mirror
gh pr create --title "feat: mirror Kwong intake + signed DSA to shared Google Drive" --body "See docs/superpowers/specs/2026-06-04-kwong-drive-mirror-design.md. Additive Drive upload at SignWell document_completed; SignWell send/sign untouched; demo-gated; idempotent via the existing lead_submitted stage guard."
```

Per repo rules `main` is branch-protected — PR only, wait for CodeQL + checks, and **do not merge without John's explicit "yes, merge."**

- [ ] **Step 3: Give John the out-of-band checklist (these are NOT code and block end-to-end use)**

1. **Google Cloud Console** → the OAuth client behind `GOOGLE_OAUTH_CLIENT_ID` → **Authorized redirect URIs** → add exactly:
   `https://fintella.partners/api/admin/google-drive/oauth-callback`
   (Save; allow a minute to propagate.)
2. Confirm the consent screen allows the `drive.file` scope (Internal app, or add admin@fintella.partners as a test user if External + Testing).
3. After this deploys to production: **Admin → Settings → Google Drive — Kwong Intake** → **Connect Google Drive**, sign in as **admin@fintella.partners**, and confirm the destination folder ID shows `1IdDPP9e3cjUo9K-ecsNiLlnXW9oKwPUG` (the `NEW` folder); Save.

- [ ] **Step 4: Production E2E verification (with John)**

1. Submit a test intake at `https://fintella.partners/intake/kwong` and complete signing.
2. Confirm **both** `INTAKE-{id}.md` and `INTAKE-{id}-signed-agreement.pdf` appear in the `NEW` folder.
3. Confirm the firm email still arrives with both attachments (unchanged).
4. Re-fire the SignWell webhook (or re-trigger) and confirm **no duplicate** files appear (stage guard holds).
5. If uploads 403/404 under `drive.file`: widen `DRIVE_SCOPE` in `src/lib/google-drive.ts` to `https://www.googleapis.com/auth/drive`, redeploy, disconnect + reconnect Drive, retry.

- [ ] **Step 5: Update session state + memory**

Update `.claude/session-state.md` (merge log, what's next) and add/refresh the relevant project memory once merged + verified live.

---

## Self-Review

**Spec coverage:**
- Dedicated Drive OAuth (`drive.file`, own callback) → Tasks 2, 3 ✓
- 3 additive `PortalSettings` columns → Task 1 ✓
- Admin connect UI + editable folder ID → Tasks 4 (PUT), 5 (UI) ✓
- Additive upload at `document_completed`, both files, flat into `NEW` → Task 6 ✓
- Demo-gate / fire-and-forget / never block webhook → Task 6 (try/catch) + lib demo-gate ✓
- Idempotency → Task 6 (relies on existing `lead_submitted` stage guard; documented) ✓
- SignWell send/sign untouched → only the webhook completion block is edited ✓
- Scope fallback documented → lib comment + Task 7 Step 4.5 ✓
- Out-of-band Google Console steps → Task 7 Step 3 ✓

**Placeholder scan:** No TBD/TODO. The two "match the neighbors" notes in Task 5 are because the 1913-line page's exact class/var names can't be quoted verbatim here; the required wiring (anchor href, disconnect fetch, controlled input, save-body key) is fully specified. Acceptable.

**Type consistency:** `uploadFileToDrive({ name, mimeType, content, folderId })` and `invalidateCachedDriveAccessToken()` / `buildDriveAuthorizationUrl` / `exchangeDriveCodeForTokens` are used in Tasks 3 & 6 exactly as defined in Task 2. `serviceFields.driveUpload.{mdFileId,pdfFileId,uploadedAt}` is internally consistent. `googleDriveIntakeFolderId` / `googleDriveConnectedEmail` / `googleDriveRefreshToken` match the Task 1 schema names throughout.
