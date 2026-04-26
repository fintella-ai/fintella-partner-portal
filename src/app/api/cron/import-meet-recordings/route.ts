import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DRIVE_BASE = "https://www.googleapis.com/drive/v3";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

async function getAccessToken(): Promise<string | null> {
  const settings = await prisma.portalSettings.findUnique({ where: { id: "global" } });
  const refreshToken = settings?.googleCalendarRefreshToken;
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
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/**
 * GET /api/cron/import-meet-recordings
 *
 * Scans the admin's Google Drive for files in "Meet Recordings" folders
 * created in the last 7 days. For each recording, matches it to an
 * existing ConferenceSchedule row by date proximity or creates metadata.
 * Updates the row with the Drive file's webViewLink as the recordingUrl.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({
      ok: false,
      error: "Google OAuth not configured — re-connect Google Calendar with Drive scope",
    });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const query = encodeURIComponent(
    `mimeType contains 'video/' and createdTime > '${sevenDaysAgo}' and (name contains 'Meet Recording' or parents in 'Meet Recordings')`
  );

  const driveRes = await fetch(
    `${DRIVE_BASE}/files?q=${query}&fields=files(id,name,webViewLink,createdTime,mimeType)&orderBy=createdTime desc&pageSize=20`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!driveRes.ok) {
    const errText = await driveRes.text().catch(() => "");
    if (driveRes.status === 403 && errText.includes("insufficientPermissions")) {
      return NextResponse.json({
        ok: false,
        error: "Drive scope not granted — re-connect Google Calendar in Settings → Integrations",
      });
    }
    return NextResponse.json({
      ok: false,
      error: `Drive API error ${driveRes.status}: ${errText.slice(0, 200)}`,
    });
  }

  const driveData = (await driveRes.json()) as {
    files?: Array<{
      id: string;
      name: string;
      webViewLink?: string;
      createdTime?: string;
      mimeType?: string;
    }>;
  };

  const files = driveData.files || [];
  if (files.length === 0) {
    return NextResponse.json({ ok: true, found: 0, imported: 0, note: "No recent Meet recordings found" });
  }

  const conferences = await prisma.conferenceSchedule.findMany({
    where: { nextCall: { gte: new Date(Date.now() - 14 * 86_400_000) } },
    orderBy: { nextCall: "desc" },
  });

  let imported = 0;

  for (const file of files) {
    if (!file.webViewLink) continue;

    const alreadyImported = conferences.some(
      (c) => c.recordingUrl === file.webViewLink || c.embedUrl === file.webViewLink
    );
    if (alreadyImported) continue;

    const fileDate = file.createdTime ? new Date(file.createdTime) : new Date();

    let bestMatch = conferences.find((c) => {
      if (!c.nextCall || c.recordingUrl) return false;
      const diff = Math.abs(c.nextCall.getTime() - fileDate.getTime());
      return diff < 48 * 60 * 60 * 1000;
    });

    if (bestMatch) {
      await prisma.conferenceSchedule.update({
        where: { id: bestMatch.id },
        data: {
          recordingUrl: file.webViewLink,
          isActive: false,
        },
      });
      imported++;
    } else {
      const title = file.name
        .replace(/\.mp4$/i, "")
        .replace(/^Meet Recording - /, "")
        .trim() || "Live Weekly Recording";

      await prisma.conferenceSchedule.create({
        data: {
          title,
          description: `Auto-imported from Google Drive on ${new Date().toLocaleDateString()}`,
          recordingUrl: file.webViewLink,
          nextCall: fileDate,
          isActive: false,
        },
      });
      imported++;
    }
  }

  return NextResponse.json({
    ok: true,
    found: files.length,
    imported,
    finishedAt: new Date().toISOString(),
  });
}
