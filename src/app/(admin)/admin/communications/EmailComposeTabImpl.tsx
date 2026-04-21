"use client";

import { useEffect, useState } from "react";
import ComposeEmailForm from "@/components/admin/ComposeEmailForm";

/**
 * One-shot handoff from Templates → Compose. Templates calls
 * `stashComposePrefill({subject, body})` before routing to the compose
 * view; this component consumes it on mount and clears the key so the
 * prefill only fires once. SessionStorage is used instead of URL params
 * to avoid truncating long bodies + keep the URL clean.
 */
const PREFILL_KEY = "comms.compose.prefill";

export function stashComposePrefill(prefill: { subject: string; body: string }) {
  try {
    sessionStorage.setItem(PREFILL_KEY, JSON.stringify(prefill));
  } catch {}
}

function consumeComposePrefill(): { subject: string; body: string } | null {
  try {
    const raw = sessionStorage.getItem(PREFILL_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PREFILL_KEY);
    const parsed = JSON.parse(raw);
    if (typeof parsed?.subject === "string" && typeof parsed?.body === "string") {
      return parsed;
    }
  } catch {}
  return null;
}

/**
 * Compose section of the Communications hub. Wraps the shared
 * ComposeEmailForm so the same form can be mounted inline on the partner
 * detail page without duplicating autocomplete/template-picker logic.
 */
export default function EmailComposeTabImpl() {
  const [prefill, setPrefill] = useState<{ subject: string; body: string } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPrefill(consumeComposePrefill());
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <div className="card p-6">
      <h3 className="font-display text-lg font-bold mb-4">New Email</h3>
      <ComposeEmailForm
        initialSubject={prefill?.subject || ""}
        initialBody={prefill?.body || ""}
      />
    </div>
  );
}
