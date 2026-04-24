/**
 * PartnerOS AI — PDF text extraction helper
 *
 * Thin wrapper around pdf-parse for PartnerOS Phase 2b knowledge ingest.
 * Called from /api/admin/training/resources POST + backfill endpoint.
 * Failures are non-fatal — the upload succeeds, we just leave
 * TrainingResource.extractedText null and log the error.
 */

export interface PdfExtractResult {
  text: string;
  pages?: number;
  byteLength: number;
}

/**
 * Download a PDF from a URL and extract plain text with pdf-parse.
 * Returns { text: "" } if the URL is unreachable or the parse fails —
 * never throws. Callers should treat empty text as "extraction
 * unavailable for this upload" and continue.
 */
export async function extractPdfTextFromUrl(
  url: string
): Promise<PdfExtractResult> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(
        `[pdf-extraction] fetch failed for ${url}: ${res.status} ${res.statusText}`
      );
      return { text: "", byteLength: 0 };
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return extractPdfTextFromBuffer(buffer);
  } catch (err) {
    console.warn("[pdf-extraction] url extract failed", err);
    return { text: "", byteLength: 0 };
  }
}

/**
 * Extract plain text from a PDF Buffer. Uses pdf-parse with default
 * options. Large PDFs (> ~10MB) are capped — we log a warning and
 * extract the first chunk to avoid blowing memory in the serverless
 * function's tight limits.
 */
export async function extractPdfTextFromBuffer(
  buffer: Buffer
): Promise<PdfExtractResult> {
  const MAX_BYTES = 15 * 1024 * 1024; // 15 MB cap
  const byteLength = buffer.byteLength;
  if (byteLength === 0) {
    return { text: "", byteLength: 0 };
  }
  if (byteLength > MAX_BYTES) {
    console.warn(
      `[pdf-extraction] PDF too large (${byteLength} bytes); skipping extraction`
    );
    return { text: "", byteLength };
  }
  try {
    // Dynamic import — pdf-parse pulls in heavy deps we want lazy-loaded
    // off the hot path for any request that doesn't need extraction.
    // Cast through `unknown` because the module's published types don't
    // match either the CJS-style callable export or the ESM default shape
    // we actually get at runtime. Worst case at runtime we fall into the
    // catch below and return empty text.
    type PdfParseFn = (buf: Buffer) => Promise<{ text: string; numpages?: number }>;
    const pdfParseModule = (await import("pdf-parse")) as unknown as
      | PdfParseFn
      | { default: PdfParseFn };
    const pdfParse: PdfParseFn =
      typeof pdfParseModule === "function"
        ? pdfParseModule
        : pdfParseModule.default;
    const parsed = await pdfParse(buffer);
    return {
      text: (parsed.text || "").trim(),
      pages: parsed.numpages,
      byteLength,
    };
  } catch (err) {
    console.warn("[pdf-extraction] parse failed", err);
    return { text: "", byteLength };
  }
}
