"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CallState =
  | "idle"
  | "registering"
  | "ready"
  | "connecting"
  | "ringing"
  | "in-call"
  | "ended"
  | "error"
  | "demo";

type SoftPhoneAPI = {
  call: (phone: string, partnerName?: string) => void;
  hangup: () => void;
  state: CallState;
};

// Module-level reference so the partner profile "Call Partner" button can
// dispatch an event that the docked SoftPhone picks up without a provider.
// Keeps the wiring minimal while still letting any page trigger a call.
declare global {
  interface Window {
    __fintellaSoftphone?: SoftPhoneAPI;
  }
}

export default function SoftPhone() {
  const [state, setState] = useState<CallState>("idle");
  const [open, setOpen] = useState(false);
  const [currentNumber, setCurrentNumber] = useState("");
  const [currentName, setCurrentName] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [missing, setMissing] = useState<string[]>([]);
  const deviceRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startDurationTimer = useCallback(() => {
    setDurationSec(0);
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    durationTimerRef.current = setInterval(() => {
      setDurationSec((d) => d + 1);
    }, 1000);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  // Initialise the Twilio Device once per session. Lazy — we only load
  // the SDK and register when the admin actually wants to place a call,
  // so demo-mode admins don't pull the SDK bundle for nothing.
  const ensureDevice = useCallback(async () => {
    if (deviceRef.current) return deviceRef.current;
    setState("registering");
    try {
      const res = await fetch("/api/twilio/voice-token");
      const data = await res.json();
      if (data.demo || !data.token) {
        setMissing(data.missing || []);
        setState("demo");
        return null;
      }
      const { Device } = await import("@twilio/voice-sdk");
      const device = new Device(data.token, {
        logLevel: 1,
      });
      device.on("registered", () => setState("ready"));
      device.on("error", (err: any) => {
        console.error("[SoftPhone] device error:", err);
        setErrorMsg(err?.message || "Device error");
        setState("error");
      });
      await device.register();
      deviceRef.current = device;
      return device;
    } catch (err: any) {
      console.error("[SoftPhone] init failed:", err);
      setErrorMsg(err?.message || "Failed to initialize softphone");
      setState("error");
      return null;
    }
  }, []);

  const call = useCallback(
    async (phone: string, partnerName?: string) => {
      setOpen(true);
      setCurrentNumber(phone);
      setCurrentName(partnerName || "");
      setErrorMsg(null);
      setMuted(false);
      const device = await ensureDevice();
      if (!device) {
        // Demo mode — fake a connected state for UX testing
        if (state === "demo") {
          setState("in-call");
          startDurationTimer();
        }
        return;
      }
      setState("connecting");
      try {
        const c = await device.connect({ params: { To: phone } });
        callRef.current = c;
        c.on("ringing", () => setState("ringing"));
        c.on("accept", () => {
          setState("in-call");
          startDurationTimer();
        });
        c.on("disconnect", () => {
          setState("ended");
          stopDurationTimer();
          callRef.current = null;
        });
        c.on("cancel", () => {
          setState("ended");
          stopDurationTimer();
          callRef.current = null;
        });
        c.on("reject", () => {
          setState("ended");
          stopDurationTimer();
          callRef.current = null;
        });
        c.on("error", (err: any) => {
          console.error("[SoftPhone] call error:", err);
          setErrorMsg(err?.message || "Call error");
          setState("error");
          stopDurationTimer();
        });
      } catch (err: any) {
        console.error("[SoftPhone] connect failed:", err);
        setErrorMsg(err?.message || "Call failed");
        setState("error");
      }
    },
    [ensureDevice, startDurationTimer, stopDurationTimer, state]
  );

  const hangup = useCallback(() => {
    try {
      callRef.current?.disconnect?.();
    } catch {}
    callRef.current = null;
    stopDurationTimer();
    setState("ended");
  }, [stopDurationTimer]);

  const toggleMute = useCallback(() => {
    if (callRef.current?.mute) {
      callRef.current.mute(!muted);
      setMuted(!muted);
    }
  }, [muted]);

  // Register the API on window so any admin page can fire it.
  useEffect(() => {
    const api: SoftPhoneAPI = { call, hangup, state };
    window.__fintellaSoftphone = api;
    return () => {
      if (window.__fintellaSoftphone === api) {
        delete window.__fintellaSoftphone;
      }
    };
  }, [call, hangup, state]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        callRef.current?.disconnect?.();
        deviceRef.current?.destroy?.();
      } catch {}
      stopDurationTimer();
    };
  }, [stopDurationTimer]);

  const fmtDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // Don't render anything until the admin triggers a call for the first time.
  if (!open) {
    return (
      <button
        onClick={async () => {
          setOpen(true);
          await ensureDevice();
        }}
        title="Open softphone"
        className="fixed bottom-6 right-6 z-[950] bg-gradient-to-br from-brand-gold to-[#e8c060] text-brand-dark rounded-full shadow-lg shadow-brand-gold/20 w-14 h-14 text-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
      >
        📞
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[951] w-[320px] bg-[var(--app-bg-secondary)] border border-brand-gold/30 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--app-border)] bg-gradient-to-r from-brand-gold/10 to-transparent">
        <div>
          <div className="font-body text-[11px] uppercase tracking-[1.5px] text-brand-gold">Softphone</div>
          <div className="font-body text-[10px] text-[var(--app-text-muted)] mt-0.5">
            {state === "demo" ? "Demo mode — not configured" : state.replace("-", " ")}
          </div>
        </div>
        <button
          onClick={() => {
            if (state === "in-call" || state === "ringing" || state === "connecting") hangup();
            setOpen(false);
          }}
          className="text-[var(--app-text-muted)] hover:text-[var(--app-text)] text-lg w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--app-input-bg)] transition-colors"
          title="Close"
        >
          ✕
        </button>
      </div>

      <div className="p-5">
        {state === "demo" && (
          <div className="font-body text-[11px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4">
            Softphone is in demo mode. Missing env vars:{" "}
            <span className="font-mono text-[10px] text-yellow-300">
              {missing.join(", ") || "TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_TWIML_APP_SID"}
            </span>
          </div>
        )}

        <div className="text-center mb-5">
          <div className="text-4xl mb-2">
            {state === "in-call" ? "📞" : state === "ringing" ? "📲" : state === "ended" ? "📴" : "☎️"}
          </div>
          <div className="font-display text-lg font-bold text-[var(--app-text)]">
            {currentName || currentNumber || "Ready"}
          </div>
          {currentNumber && currentName && (
            <div className="font-body text-[12px] text-[var(--app-text-muted)]">{currentNumber}</div>
          )}
          {state === "in-call" && (
            <div className="font-mono text-[13px] text-brand-gold mt-2">{fmtDuration(durationSec)}</div>
          )}
          {state === "error" && errorMsg && (
            <div className="font-body text-[11px] text-red-400 mt-2">{errorMsg}</div>
          )}
        </div>

        <div className="flex items-center justify-center gap-3">
          {(state === "in-call" || state === "ringing" || state === "connecting") && (
            <>
              <button
                onClick={toggleMute}
                disabled={state !== "in-call"}
                className={`w-12 h-12 rounded-full border transition-colors disabled:opacity-40 ${
                  muted
                    ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40"
                    : "text-[var(--app-text-muted)] border-[var(--app-border)] hover:text-[var(--app-text-secondary)]"
                }`}
                title={muted ? "Unmute" : "Mute"}
              >
                {muted ? "🔇" : "🎙️"}
              </button>
              <button
                onClick={hangup}
                className="w-14 h-14 rounded-full bg-red-500/90 hover:bg-red-500 text-white text-xl shadow-lg shadow-red-500/30 transition-colors"
                title="Hang up"
              >
                ✖
              </button>
            </>
          )}
          {(state === "ready" || state === "ended" || state === "demo" || state === "error" || state === "idle") && (
            <div className="font-body text-[11px] text-[var(--app-text-muted)] text-center">
              {state === "ready" && "Ready to call. Click Call Partner on any profile."}
              {state === "ended" && "Call ended."}
              {state === "idle" && "Initializing..."}
              {state === "error" && "Click Call Partner again to retry."}
              {state === "demo" && "UI preview only — real calls need Twilio config."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
