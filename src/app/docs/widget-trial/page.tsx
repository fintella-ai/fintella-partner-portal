import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Widget Trial Key — Integration Guide",
  description:
    "Embed Fintella's IEEPA tariff-refund analysis in your CRM or TMS with a free trial key. Eligibility and deadlines included; upgrade to unlock refund estimates.",
};

const GOLD = "#c4a050";

const embedExample = `<script src="https://fintella.partners/widget/tariff-trial.js"
        data-trial-key="ftk_xxxxxxxx..."></script>`;

const requestExample = `POST https://fintella.partners/api/tariff/widget-trial/calculate
X-Trial-Key: ftk_xxxxxxxx...
Content-Type: application/json

{
  "countryOfOrigin": "CN",
  "entryDate": "2025-01-15",
  "enteredValue": 100000
}`;

const responseExample = `{
  "countryOfOrigin": "CN",
  "entryDate": "2025-01-15",
  "enteredValue": 100000,
  "eligibility": "eligible",
  "eligibilityReason": "Within CAPE Phase-1 window",
  "deadlineDays": 42,
  "isUrgent": true,
  "filingMethod": "cape_phase1",
  "refundLocked": true,
  "upgradeMessage": "Upgrade to a paid plan to unlock the full refund estimate and file."
}`;

function Code({ children }: { children: string }) {
  return (
    <pre
      style={{
        background: "#1a1a2e",
        color: "#e0e0e0",
        padding: "16px 18px",
        borderRadius: 10,
        overflowX: "auto",
        fontSize: 13,
        lineHeight: 1.6,
        margin: "12px 0",
      }}
    >
      <code>{children}</code>
    </pre>
  );
}

export default function WidgetTrialDocsPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px", lineHeight: 1.65 }}>
      <p style={{ color: GOLD, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", fontSize: 13 }}>
        Integration Guide
      </p>
      <h1 style={{ fontSize: 34, margin: "6px 0 8px", fontWeight: 700 }}>Widget Trial Key</h1>
      <p style={{ fontSize: 17, opacity: 0.8 }}>
        Run Fintella&apos;s IEEPA tariff-refund analysis inside your own CRM or TMS. A free trial key returns a{" "}
        <strong>partial analysis</strong> — eligibility, filing deadlines, and the filing method — so you can see
        which entries qualify before you commit. Refund dollar amounts unlock when you upgrade to a paid plan.
      </p>

      <h2 style={{ fontSize: 22, marginTop: 36 }}>1. Get a trial key</h2>
      <p>
        Visit{" "}
        <a href="/recover/tariff-diy" style={{ color: GOLD, fontWeight: 600 }}>
          /recover/tariff-diy
        </a>
        , choose the &ldquo;Use a CRM or TMS?&rdquo; option, and request a free trial key. Your key looks like{" "}
        <code style={{ background: "rgba(196,160,80,0.15)", padding: "1px 6px", borderRadius: 4 }}>ftk_…</code> —
        treat it like a password. Store it server-side; don&apos;t commit it to a public repo.
      </p>

      <h2 style={{ fontSize: 22, marginTop: 36 }}>2. Embed the widget (optional)</h2>
      <p>Drop this one-line snippet anywhere in your app to render the trial calculator:</p>
      <Code>{embedExample}</Code>

      <h2 style={{ fontSize: 22, marginTop: 36 }}>3. Or call the API directly</h2>
      <p>
        Authenticate with the <code>X-Trial-Key</code> header (a <code>Bearer</code> token or a <code>trialKey</code>{" "}
        body field also work). One customs entry per request:
      </p>
      <Code>{requestExample}</Code>

      <h3 style={{ fontSize: 18, marginTop: 24 }}>Partial response</h3>
      <p>
        The trial response includes eligibility, deadlines, and the filing path. The IEEPA rate and every refund
        amount are intentionally withheld until you upgrade:
      </p>
      <Code>{responseExample}</Code>

      <h2 style={{ fontSize: 22, marginTop: 36 }}>4. Upgrade to unlock</h2>
      <p>
        When you&apos;re ready to see full refund estimates and file, choose a plan from the same{" "}
        <a href="/recover/tariff-diy" style={{ color: GOLD, fontWeight: 600 }}>
          /recover/tariff-diy
        </a>{" "}
        flow. Your trial key&apos;s history carries over.
      </p>

      <p style={{ marginTop: 40, fontSize: 13, opacity: 0.55 }}>
        Estimate only, not a guarantee of approval. Fintella is not a law firm.
      </p>
    </main>
  );
}
