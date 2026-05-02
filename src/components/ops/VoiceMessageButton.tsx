"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ─── Types ─────────────────────────────────────────────────────────── */

interface VoiceMessageButtonProps {
  /** Called with the uploaded Blob URL after recording + upload completes */
  onVoiceMessage: (voiceUrl: string) => void;
  /** Max recording duration in seconds (default 60) */
  maxDuration?: number;
  /** Extra classes on the outer wrapper */
  className?: string;
}

type RecordingState = "idle" | "recording" | "uploading" | "error";

/* ─── Component ─────────────────────────────────────────────────────── */

export default function VoiceMessageButton({
  onVoiceMessage,
  maxDuration = 60,
  className = "",
}: VoiceMessageButtonProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  /* ── Start recording ─────────────────────────────────────────────── */
  const startRecording = useCallback(async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const mr = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        /* Stop all tracks */
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        /* Clear timer */
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        if (chunksRef.current.length === 0) {
          setState("idle");
          return;
        }

        const blob = new Blob(chunksRef.current, { type: mimeType });
        await uploadBlob(blob);
      };

      mr.start(250); // collect data every 250ms
      mediaRecorderRef.current = mr;
      startTimeRef.current = Date.now();
      setDuration(0);
      setState("recording");

      /* Duration ticker */
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);
        if (elapsed >= maxDuration) {
          stopRecording();
        }
      }, 250);
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access denied"
          : "Could not start recording";
      setError(msg);
      setState("error");
    }
  }, [maxDuration]);

  /* ── Stop recording ──────────────────────────────────────────────── */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  /* ── Upload to Vercel Blob ───────────────────────────────────────── */
  const uploadBlob = useCallback(
    async (blob: Blob) => {
      setState("uploading");
      try {
        const form = new FormData();
        form.append("file", blob, `voice-${Date.now()}.webm`);

        const res = await fetch("/api/ops/voice/upload", {
          method: "POST",
          body: form,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(errBody.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        setState("idle");
        setDuration(0);
        onVoiceMessage(data.url);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Upload failed");
        setState("error");
      }
    },
    [onVoiceMessage]
  );

  /* ── Toggle ──────────────────────────────────────────────────────── */
  const toggle = useCallback(() => {
    if (state === "recording") stopRecording();
    else if (state === "idle" || state === "error") startRecording();
  }, [state, startRecording, stopRecording]);

  /* ── Cleanup on unmount ──────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  /* ── Format duration ─────────────────────────────────────────────── */
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <button
        onClick={toggle}
        disabled={state === "uploading"}
        aria-label={state === "recording" ? "Stop recording" : "Record voice message"}
        className={`
          relative flex items-center justify-center rounded-full
          w-11 h-11 min-w-[44px] min-h-[44px]
          transition-colors duration-150 select-none
          ${
            state === "recording"
              ? "bg-red-500 text-white shadow-lg"
              : state === "uploading"
              ? "bg-gray-200 dark:bg-white/10 text-gray-400 cursor-wait"
              : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20"
          }
        `}
      >
        {/* Pulse ring while recording */}
        {state === "recording" && (
          <span className="absolute inset-0 rounded-full bg-red-400/40 animate-ping" />
        )}

        {state === "uploading" ? (
          <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        ) : state === "recording" ? (
          <StopIcon />
        ) : (
          <MicIcon />
        )}
      </button>

      {/* Duration display */}
      {state === "recording" && (
        <span className="text-sm font-mono text-red-500 tabular-nums min-w-[40px]">
          {fmt(duration)}
        </span>
      )}

      {/* Max duration warning */}
      {state === "recording" && duration >= maxDuration - 10 && (
        <span className="text-xs text-red-400 animate-pulse">
          {maxDuration - duration}s left
        </span>
      )}

      {/* Uploading label */}
      {state === "uploading" && (
        <span className="text-xs text-gray-500 dark:text-gray-400">Uploading...</span>
      )}

      {/* Error */}
      {state === "error" && error && (
        <span className="text-xs text-red-500">{error}</span>
      )}
    </div>
  );
}

/* ─── Icons ─────────────────────────────────────────────────────────── */

function MicIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-5 h-5"
    >
      <path d="M12 1a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4z" />
      <path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V21H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-3.07A7 7 0 0 0 19 11z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-5 h-5"
    >
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
