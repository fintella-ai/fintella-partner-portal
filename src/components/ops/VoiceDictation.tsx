"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ─── Types ─────────────────────────────────────────────────────────── */

interface VoiceDictationProps {
  /** "hold" = press-and-hold to record, "tap" = tap to toggle */
  mode?: "hold" | "tap";
  /** Language / locale for speech recognition */
  language?: string;
  /** Called with the final transcript after each utterance */
  onTranscript: (text: string) => void;
  /** Optional — called with the raw audio Blob and its object URL */
  onVoiceNote?: (blob: Blob, url: string) => void;
  /** Extra classes on the outer wrapper */
  className?: string;
  /** Accessible label override */
  ariaLabel?: string;
}

/* ─── SpeechRecognition cross-browser helper ─────────────────────────
 *
 * The Web Speech API types (SpeechRecognition, SpeechRecognitionEvent,
 * SpeechRecognitionErrorEvent) are not included in all TS environments.
 * We use `any` for the recognition instance and access the constructor
 * from the global window object at runtime.
 * ──────────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSpeechRecognitionCtor(): (new () => any) | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/* ─── Component ─────────────────────────────────────────────────────── */

export default function VoiceDictation({
  mode = "tap",
  language = "en-US",
  onTranscript,
  onVoiceNote,
  className = "",
  ariaLabel = "Voice dictation",
}: VoiceDictationProps) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [denied, setDenied] = useState(false);
  const [interimText, setInterimText] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  /* ── Check support on mount ──────────────────────────────────────── */
  useEffect(() => {
    if (!getSpeechRecognitionCtor()) setSupported(false);
  }, []);

  /* ── Start ───────────────────────────────────────────────────────── */
  const start = useCallback(async () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    const rec = new Ctor();
    rec.lang = language;
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (ev: any) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) {
          onTranscript(t.trim());
          setInterimText("");
        } else {
          interim += t;
        }
      }
      if (interim) setInterimText(interim);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (ev: any) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setDenied(true);
      }
      stop();
    };

    rec.onend = () => {
      setListening(false);
      setInterimText("");
    };

    recognitionRef.current = rec;

    /* Optional: capture raw audio for voice-note export */
    if (onVoiceNote) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
        chunksRef.current = [];
        mr.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        mr.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const url = URL.createObjectURL(blob);
          onVoiceNote(blob, url);
          stream.getTracks().forEach((t) => t.stop());
        };
        mr.start();
        mediaRecorderRef.current = mr;
      } catch {
        /* Permission denied for MediaRecorder — still continue with SpeechRecognition */
      }
    }

    rec.start();
    setListening(true);
  }, [language, onTranscript, onVoiceNote]);

  /* ── Stop ─────────────────────────────────────────────────────────── */
  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    setListening(false);
    setInterimText("");
  }, []);

  /* ── Toggle (tap mode) ───────────────────────────────────────────── */
  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  /* ── Cleanup on unmount ──────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  /* ── Unsupported browser ─────────────────────────────────────────── */
  if (!supported) {
    return (
      <span className={`text-xs text-red-400 ${className}`}>
        Voice not supported
      </span>
    );
  }

  /* ── Permission denied ───────────────────────────────────────────── */
  if (denied) {
    return (
      <button
        disabled
        className={`flex items-center justify-center rounded-full
          w-11 h-11 min-w-[44px] min-h-[44px]
          bg-red-100 dark:bg-red-900/30 text-red-500 cursor-not-allowed
          ${className}`}
        title="Microphone access denied"
      >
        <MicOffIcon />
      </button>
    );
  }

  /* ── Main button ─────────────────────────────────────────────────── */
  const holdProps =
    mode === "hold"
      ? {
          onMouseDown: start,
          onMouseUp: stop,
          onMouseLeave: stop,
          onTouchStart: (e: React.TouchEvent) => {
            e.preventDefault();
            start();
          },
          onTouchEnd: stop,
        }
      : { onClick: toggle };

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        {...holdProps}
        aria-label={ariaLabel}
        className={`
          relative flex items-center justify-center rounded-full
          w-11 h-11 min-w-[44px] min-h-[44px]
          transition-colors duration-150 select-none
          ${
            listening
              ? "bg-red-500 text-white shadow-lg"
              : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20"
          }
        `}
      >
        {/* Pulse rings while recording — CSS-only animation */}
        {listening && (
          <>
            <span
              className="absolute inset-0 rounded-full bg-red-400/40"
              style={{
                animation: "voicePing 1s cubic-bezier(0, 0, 0.2, 1) infinite",
              }}
            />
            <span
              className="absolute inset-0 rounded-full bg-red-400/20"
              style={{
                animation: "voicePingSlow 1.4s cubic-bezier(0, 0, 0.2, 1) infinite",
              }}
            />
          </>
        )}
        <MicIcon />
      </button>

      {/* Interim text preview */}
      {listening && interimText && (
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 truncate max-w-[180px]">
          {interimText}
        </span>
      )}

      {/* Global keyframes for pulse animation */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes voicePing {
            0% { transform: scale(1); opacity: 0.6; }
            100% { transform: scale(1.6); opacity: 0; }
          }
          @keyframes voicePingSlow {
            0% { transform: scale(1); opacity: 0.4; }
            100% { transform: scale(2); opacity: 0; }
          }
        `,
      }} />
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

function MicOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-5 h-5"
    >
      <path d="M12 1a4 4 0 0 0-4 4v6c0 .266.026.527.077.78L3.293 6.997a1 1 0 0 0-1.414 1.414l18.384 18.384a1 1 0 0 0 1.414-1.414L16.9 20.604A6.97 6.97 0 0 0 19 15a1 1 0 1 0-2 0 5 5 0 0 1-5 5c-.812 0-1.578-.194-2.255-.539l-1.48-1.48A3.98 3.98 0 0 0 12 15V5a2 2 0 0 1 4 0v6a2 2 0 0 1-.17.8l1.45 1.45A3.98 3.98 0 0 0 16 11V5a4 4 0 0 0-4-4zM8 11V9.83L13.17 15H12a3 3 0 0 1-4-3.17z" />
    </svg>
  );
}
