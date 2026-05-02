import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/ops/voice/upload
 *
 * Accepts a multipart form with an audio file, uploads it to Vercel Blob,
 * and returns the public URL. Used by VoiceMessageButton for voice
 * messages in Ops Center channels and DMs.
 *
 * Demo-gated: when BLOB_READ_WRITE_TOKEN is unset, returns a mock URL
 * so the UI can work in development without blob storage configured.
 *
 * Constraints:
 *   - Max 10 MB (60s of audio at typical web codec bitrate)
 *   - Audio MIME types only (audio/*, video/webm for browser compat)
 */

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_PREFIXES = ["audio/", "video/webm"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  /* ── Demo gate ───────────────────────────────────────────────────── */
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({
      url: `https://demo.blob.vercel-storage.com/voice/demo-${Date.now()}.webm`,
      duration: null,
      demo: true,
    });
  }

  /* ── Parse multipart ─────────────────────────────────────────────── */
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file field is required" }, { status: 400 });
  }

  /* ── Validate MIME ───────────────────────────────────────────────── */
  const isAllowed = ALLOWED_MIME_PREFIXES.some((prefix) =>
    file.type.startsWith(prefix)
  );
  if (!isAllowed) {
    return NextResponse.json(
      {
        error: `Unsupported content type: ${file.type}. Only audio files are accepted.`,
      },
      { status: 415 }
    );
  }

  /* ── Validate size ───────────────────────────────────────────────── */
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (${file.size} bytes). Max 10 MB.` },
      { status: 413 }
    );
  }

  /* ── Upload to Vercel Blob ───────────────────────────────────────── */
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  const blobPath = `ops-voice/${session.user.id}/${Date.now()}-${safeName}`;

  try {
    const result = await put(blobPath, file, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: true,
    });

    return NextResponse.json({
      url: result.url,
      pathname: result.pathname,
      contentType: file.type,
      bytes: file.size,
      duration: null, // Client can compute duration from the Blob if needed
    });
  } catch (e: unknown) {
    console.error("[api/ops/voice/upload]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}
