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
