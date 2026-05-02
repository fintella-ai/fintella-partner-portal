"use client";

import { useCallback, useState } from "react";
import VoiceDictation from "./VoiceDictation";

/* ─── Types ─────────────────────────────────────────────────────────── */

interface ParsedRequest {
  type: "time_bound" | "due_by" | "open_ended";
  recipientId?: string;
  recipientName?: string;
  title: string;
  body?: string;
  proposedTime?: string;
  dueBy?: string;
}

interface ParseResult {
  parsed: ParsedRequest;
  confidence: number;
}

interface VoiceToRequestProps {
  /** Pre-select an entity context (workspace) */
  entityId?: string;
  /** Callback when the request has been submitted to the API */
  onSubmitted?: (request: Record<string, unknown>) => void;
  /** Callback to dismiss/close the component */
  onCancel?: () => void;
  /** Extra classes on the outer wrapper */
  className?: string;
}

type Step = "idle" | "listening" | "parsing" | "review" | "submitting" | "done" | "error";

/* ─── Component ─────────────────────────────────────────────────────── */

export default function VoiceToRequest({
  entityId,
  onSubmitted,
  onCancel,
  className = "",
}: VoiceToRequestProps) {
  const [step, setStep] = useState<Step>("idle");
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<ParsedRequest | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState("");

  /* ── Editable fields (user can tweak before submit) ──────────────── */
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editType, setEditType] = useState<ParsedRequest["type"]>("open_ended");
  const [editRecipientId, setEditRecipientId] = useState("");
  const [editRecipientName, setEditRecipientName] = useState("");
  const [editProposedTime, setEditProposedTime] = useState("");
  const [editDueBy, setEditDueBy] = useState("");

  /* ── Parse voice transcript via API ──────────────────────────────── */
  const parseTranscript = useCallback(
    async (text: string) => {
      setRawText(text);
      setStep("parsing");
      setError("");

      try {
        const res = await fetch("/api/ops/voice/parse-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, entityId }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ error: "Parse failed" }));
          throw new Error(errBody.error || `HTTP ${res.status}`);
        }

        const data: ParseResult = await res.json();
        setParsed(data.parsed);
        setConfidence(data.confidence);

        /* Pre-fill editable fields */
        setEditTitle(data.parsed.title);
        setEditBody(data.parsed.body || "");
        setEditType(data.parsed.type);
        setEditRecipientId(data.parsed.recipientId || "");
        setEditRecipientName(data.parsed.recipientName || "");
        setEditProposedTime(data.parsed.proposedTime || "");
        setEditDueBy(data.parsed.dueBy || "");

        setStep("review");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Parse failed");
        setStep("error");
      }
    },
    [entityId]
  );

  /* ── Submit confirmed request ────────────────────────────────────── */
  const submit = useCallback(async () => {
    setStep("submitting");
    setError("");

    try {
      const payload: Record<string, unknown> = {
        recipientId: editRecipientId,
        type: editType,
        title: editTitle,
        body: editBody || undefined,
        entityId: entityId || undefined,
      };
      if (editType === "time_bound" && editProposedTime) {
        payload.proposedTime = editProposedTime;
      }
      if (editType === "due_by" && editDueBy) {
        payload.dueBy = editDueBy;
      }

      const res = await fetch("/api/ops/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "Submit failed" }));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setStep("done");
      onSubmitted?.(data.request);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Submit failed");
      setStep("error");
    }
  }, [editBody, editDueBy, editProposedTime, editRecipientId, editTitle, editType, entityId, onSubmitted]);

  /* ── Reset ───────────────────────────────────────────────────────── */
  const reset = useCallback(() => {
    setStep("idle");
    setRawText("");
    setParsed(null);
    setError("");
  }, []);

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div className={`rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
        Voice to Request
      </h3>

      {/* ── Idle / listening ─────────────────────────────────────── */}
      {(step === "idle" || step === "listening") && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Tap the mic and describe your request.
            <br />
            e.g. &quot;Ask Sarah to review the payout report by Friday&quot;
          </p>
          <VoiceDictation
            mode="tap"
            onTranscript={(text) => {
              if (text.trim()) parseTranscript(text);
            }}
          />
          {rawText && (
            <p className="text-xs text-gray-400 italic mt-1 max-w-xs truncate">
              &quot;{rawText}&quot;
            </p>
          )}
        </div>
      )}

      {/* ── Parsing spinner ──────────────────────────────────────── */}
      {step === "parsing" && (
        <div className="flex flex-col items-center gap-2 py-4">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500 dark:text-gray-400">Parsing your request...</p>
        </div>
      )}

      {/* ── Review / edit ────────────────────────────────────────── */}
      {step === "review" && parsed && (
        <div className="space-y-3">
          {/* Confidence badge */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500 dark:text-gray-400">Confidence:</span>
            <span
              className={`px-1.5 py-0.5 rounded font-medium ${
                confidence >= 0.8
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : confidence >= 0.5
                  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              {Math.round(confidence * 100)}%
            </span>
          </div>

          {/* Raw transcript */}
          <div className="text-xs text-gray-400 dark:text-gray-500 italic bg-gray-50 dark:bg-white/5 rounded p-2">
            &quot;{rawText}&quot;
          </div>

          {/* Type */}
          <label className="block">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Type</span>
            <select
              value={editType}
              onChange={(e) => setEditType(e.target.value as ParsedRequest["type"])}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-white/10
                bg-white dark:bg-white/5 px-2 py-1.5 text-sm
                text-gray-800 dark:text-gray-200"
            >
              <option value="time_bound">Time Bound</option>
              <option value="due_by">Due By</option>
              <option value="open_ended">Open Ended</option>
            </select>
          </label>

          {/* Recipient */}
          <label className="block">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Recipient</span>
            <input
              type="text"
              value={editRecipientName}
              onChange={(e) => setEditRecipientName(e.target.value)}
              placeholder="Recipient name"
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-white/10
                bg-white dark:bg-white/5 px-2 py-1.5 text-sm
                text-gray-800 dark:text-gray-200"
            />
            {editRecipientId && (
              <span className="text-[10px] text-gray-400 mt-0.5 block">
                ID: {editRecipientId}
              </span>
            )}
          </label>

          {/* Title */}
          <label className="block">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Title</span>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-white/10
                bg-white dark:bg-white/5 px-2 py-1.5 text-sm
                text-gray-800 dark:text-gray-200"
            />
          </label>

          {/* Body */}
          <label className="block">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Details</span>
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={2}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-white/10
                bg-white dark:bg-white/5 px-2 py-1.5 text-sm
                text-gray-800 dark:text-gray-200 resize-none"
            />
          </label>

          {/* Proposed time (time_bound) */}
          {editType === "time_bound" && (
            <label className="block">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Proposed Time</span>
              <input
                type="datetime-local"
                value={editProposedTime ? editProposedTime.slice(0, 16) : ""}
                onChange={(e) => setEditProposedTime(e.target.value ? new Date(e.target.value).toISOString() : "")}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-white/10
                  bg-white dark:bg-white/5 px-2 py-1.5 text-sm
                  text-gray-800 dark:text-gray-200"
              />
            </label>
          )}

          {/* Due by (due_by) */}
          {editType === "due_by" && (
            <label className="block">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Due By</span>
              <input
                type="datetime-local"
                value={editDueBy ? editDueBy.slice(0, 16) : ""}
                onChange={(e) => setEditDueBy(e.target.value ? new Date(e.target.value).toISOString() : "")}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-white/10
                  bg-white dark:bg-white/5 px-2 py-1.5 text-sm
                  text-gray-800 dark:text-gray-200"
              />
            </label>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={submit}
              disabled={!editTitle || !editRecipientId}
              className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white
                hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Submit Request
            </button>
            <button
              onClick={reset}
              className="rounded-md border border-gray-300 dark:border-white/10 px-3 py-2 text-sm
                text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              Retry
            </button>
            {onCancel && (
              <button
                onClick={onCancel}
                className="rounded-md px-3 py-2 text-sm text-gray-400 hover:text-gray-600
                  dark:hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Submitting ───────────────────────────────────────────── */}
      {step === "submitting" && (
        <div className="flex flex-col items-center gap-2 py-4">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500 dark:text-gray-400">Submitting request...</p>
        </div>
      )}

      {/* ── Done ─────────────────────────────────────────────────── */}
      {step === "done" && (
        <div className="flex flex-col items-center gap-2 py-4">
          <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-200 font-medium">Request submitted</p>
          <button onClick={reset} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
            Create another
          </button>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────── */}
      {step === "error" && (
        <div className="flex flex-col items-center gap-2 py-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button onClick={reset} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
