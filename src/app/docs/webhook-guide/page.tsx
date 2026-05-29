import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import WebhookGuideSidebar from "./WebhookGuideSidebar";

export const metadata: Metadata = {
  title: "Fintella Webhook Integration Guide",
  description: "Complete webhook integration guide for Fintella API partners — inbound, outbound, variables, and all services",
};

async function getLogoUrl(): Promise<string | null> {
  try {
    const settings = await prisma.portalSettings.findUnique({
      where: { id: "global" },
      select: { logoUrl: true },
    });
    return settings?.logoUrl || null;
  } catch {
    return null;
  }
}

/* ── Theme-aware CSS via prefers-color-scheme ─────────────────────────── */
const themeCSS = `
  :root {
    --doc-bg: #ffffff;
    --doc-text: #1a1a2e;
    --doc-text-secondary: #555;
    --doc-text-muted: #888;
    --doc-text-faint: #aaa;
    --doc-border: #e5e7eb;
    --doc-border-subtle: #f0f0f0;
    --doc-card-bg: #f8f9fa;
    --doc-code-bg: #f0f0f5;
    --doc-code-text: #9a6e00;
    --doc-pre-bg: #1a1a2e;
    --doc-pre-text: #e0e0e0;
    --doc-pre-key: #c4a050;
    --doc-pre-val: #2d8a56;
    --doc-info-bg: #fdf6e3;
    --doc-info-border: #c4a050;
    --doc-gold: #c4a050;
    --doc-green: #16a34a;
    --doc-blue: #2563eb;
    --doc-purple: #7c3aed;
    --doc-orange: #ea580c;
    --doc-red: #dc2626;
    --doc-yellow: #ca8a04;
    --doc-badge-bg: #f0f0f5;
    --doc-badge-border: #d1d5db;
    --doc-badge-text: #374151;
    --doc-step-bg: rgba(196,160,80,0.1);
    --doc-step-border: rgba(196,160,80,0.25);
    --doc-table-header-bg: rgba(196,160,80,0.08);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --doc-bg: #060a18;
      --doc-text: rgba(255,255,255,0.9);
      --doc-text-secondary: rgba(255,255,255,0.7);
      --doc-text-muted: rgba(255,255,255,0.4);
      --doc-text-faint: rgba(255,255,255,0.2);
      --doc-border: rgba(255,255,255,0.08);
      --doc-border-subtle: rgba(255,255,255,0.06);
      --doc-card-bg: rgba(255,255,255,0.03);
      --doc-code-bg: rgba(255,255,255,0.1);
      --doc-code-text: #f0d070;
      --doc-pre-bg: #0c1228;
      --doc-pre-text: rgba(255,255,255,0.7);
      --doc-pre-key: #c4a050;
      --doc-pre-val: #a8d8a8;
      --doc-info-bg: rgba(196,160,80,0.08);
      --doc-info-border: #c4a050;
      --doc-gold: #c4a050;
      --doc-green: #4ade80;
      --doc-blue: #60a5fa;
      --doc-purple: #a78bfa;
      --doc-orange: #fb923c;
      --doc-red: #f87171;
      --doc-yellow: #facc15;
      --doc-badge-bg: rgba(255,255,255,0.06);
      --doc-badge-border: rgba(255,255,255,0.1);
      --doc-badge-text: rgba(255,255,255,0.8);
      --doc-step-bg: rgba(196,160,80,0.15);
      --doc-step-border: rgba(196,160,80,0.25);
      --doc-table-header-bg: rgba(196,160,80,0.1);
    }
  }
`;

/* ── Helper Components ───────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 44 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--doc-text)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--doc-gold)", flexShrink: 0 }} />
        {title}
      </h2>
      {children}
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--doc-text)", marginBottom: 12, paddingBottom: 6, borderBottom: "1px solid var(--doc-border-subtle)" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 16, background: "var(--doc-info-bg)", borderLeft: "4px solid var(--doc-info-border)", borderRadius: "0 8px 8px 0", padding: "14px 20px", fontSize: 13, color: "var(--doc-text-secondary)", lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code style={{ background: "var(--doc-code-bg)", color: "var(--doc-code-text)", padding: "2px 6px", borderRadius: 4, fontSize: 13, fontFamily: "'SF Mono', Monaco, Consolas, monospace" }}>
      {children}
    </code>
  );
}

function FieldBadge({ children }: { children: string }) {
  return (
    <span style={{ display: "inline-block", background: "var(--doc-badge-bg)", border: "1px solid var(--doc-badge-border)", color: "var(--doc-badge-text)", padding: "3px 8px", borderRadius: 5, fontSize: 12, fontFamily: "'SF Mono', Monaco, Consolas, monospace", marginRight: 6, marginBottom: 6 }}>
      {children}
    </span>
  );
}

function ResponseBlock({ color, label, body }: { color: string; label: string; body: string }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
        <span style={{ fontSize: 13, fontWeight: 600, color }}>{label}</span>
      </div>
      <pre style={{ background: "var(--doc-pre-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, padding: "16px 20px", fontSize: 13, lineHeight: 1.7, color: "var(--doc-pre-text)", overflowX: "auto", margin: 0 }}>
        {body}
      </pre>
    </div>
  );
}

function TableHeader({ cols }: { cols: string[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: cols.map(() => "1fr").join(" "), background: "var(--doc-table-header-bg)", padding: "10px 16px", borderBottom: "1px solid var(--doc-border)", gap: 12 }}>
      {cols.map((c) => (
        <div key={c} style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--doc-gold)" }}>{c}</div>
      ))}
    </div>
  );
}

function TableRow({ cells, cols, last }: { cells: React.ReactNode[]; cols: number; last?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: Array(cols).fill("1fr").join(" "), padding: "12px 16px", borderBottom: last ? "none" : "1px solid var(--doc-border-subtle)", gap: 12, alignItems: "start" }}>
      {cells.map((cell, i) => (
        <div key={i} style={{ fontSize: 13, color: "var(--doc-text-secondary)", lineHeight: 1.55 }}>{cell}</div>
      ))}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */

export default async function WebhookGuidePage() {
  const logoUrl = await getLogoUrl();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: themeCSS }} />
      <div style={{ minHeight: "100vh", background: "var(--doc-bg)", color: "var(--doc-text)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif", lineHeight: 1.65 }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "clamp(20px, 5vw, 40px) clamp(12px, 4vw, 24px) 60px" }}>

          {/* ── Logo Header ── */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ height: 1, background: "var(--doc-border)", margin: "0 -24px" }} />
            <div style={{ background: "#000", padding: "32px 0", margin: "0 -24px", display: "flex", justifyContent: "center" }}>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Fintella" style={{ maxHeight: 160, objectFit: "contain" }} />
              ) : (
                <div style={{ fontSize: 36, fontWeight: 700, color: "var(--doc-gold)", letterSpacing: 3 }}>FINTELLA</div>
              )}
            </div>
            <div style={{ height: 1, background: "var(--doc-border)", margin: "0 -24px 20px" }} />
          </div>

          {/* ── Page Title ── */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--doc-text)", marginBottom: 8, lineHeight: 1.2 }}>
              Webhook Integration Guide
            </h1>
            <p style={{ fontSize: 15, color: "var(--doc-text-secondary)", margin: 0, lineHeight: 1.6 }}>
              Complete reference for integrating your platform with the Fintella partner API. Covers inbound webhooks (partner → Fintella), outbound webhooks (Fintella → partner), workflow template variables, and all available services.
            </p>
          </div>

          {/* ── Two-column layout: sticky sidebar + scrolling content ── */}
          <div style={{ display: "flex", gap: 48, alignItems: "flex-start" }}>
            <WebhookGuideSidebar />
            <div style={{ flex: 1, minWidth: 0 }}>

          {/* ═══════════════════════════════════════════
              SECTION 1 — OVERVIEW
          ═══════════════════════════════════════════ */}
          <div id="overview" style={{ scrollMarginTop: 80 }}>
            <Section title="1. Overview">
              <p style={{ fontSize: 14, color: "var(--doc-text-secondary)", marginBottom: 20 }}>
                Fintella uses webhooks to keep your platform and our partner portal in sync. There are two directions of data flow:
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div style={{ background: "var(--doc-card-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, padding: "20px", borderTopWidth: 3, borderTopColor: "var(--doc-blue)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--doc-blue)", marginBottom: 10 }}>Inbound (Partner → Fintella)</div>
                  <p style={{ fontSize: 13, color: "var(--doc-text-secondary)", lineHeight: 1.6, margin: 0 }}>
                    Your CRM or platform sends deal data to Fintella via our REST API. Use this to create new referral deals, update stage and financial information, and close deals as they progress through your pipeline.
                  </p>
                </div>
                <div style={{ background: "var(--doc-card-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, padding: "20px", borderTopWidth: 3, borderTopColor: "var(--doc-green)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--doc-green)", marginBottom: 10 }}>Outbound (Fintella → Partner)</div>
                  <p style={{ fontSize: 13, color: "var(--doc-text-secondary)", lineHeight: 1.6, margin: 0 }}>
                    Fintella posts real-time event payloads to a URL you configure in your partner settings. Receive notifications when deals are created, updated, or closed — so your system stays in sync without polling.
                  </p>
                </div>
              </div>

              <div style={{ background: "var(--doc-card-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--doc-border-subtle)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "var(--doc-text-muted)" }}>Base API URL</div>
                {[
                  ["Inbound Endpoint", "POST https://fintella.partners/api/webhook/referral"],
                  ["Outbound Events", "Delivered to your configured webhook URL"],
                  ["Content-Type", "application/json (both directions)"],
                  ["Authentication", "Bearer token in Authorization header — see Section 2"],
                ].map(([label, value], i) => (
                  <div key={label} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", padding: "12px 16px", borderTop: i > 0 ? "1px solid var(--doc-border-subtle)" : "none", gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--doc-text-muted)", textTransform: "uppercase", letterSpacing: 0.8, width: 160, flexShrink: 0 }}>{label}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 13, color: "var(--doc-text-secondary)", wordBreak: "break-all" }}>{value}</div>
                  </div>
                ))}
              </div>

              <InfoBox>
                Every partner integration is unique. If you need a sandbox key, a test endpoint, or custom payload mapping, contact your Fintella account manager — we will provision what you need.
              </InfoBox>
            </Section>
          </div>

          {/* ═══════════════════════════════════════════
              SECTION 2 — AUTHENTICATION
          ═══════════════════════════════════════════ */}
          <div id="authentication" style={{ scrollMarginTop: 80 }}>
            <Section title="2. Authentication">
              <p style={{ fontSize: 14, color: "var(--doc-text-secondary)", marginBottom: 16 }}>
                All API calls require your partner API key. Use the <Code>Authorization</Code> header with a Bearer token on every request — both inbound calls to Fintella and when Fintella validates that it is the caller on outbound events.
              </p>

              <SubSection title="Sending Your API Key (Inbound Calls)">
                <p style={{ fontSize: 14, color: "var(--doc-text-secondary)", marginBottom: 12 }}>
                  Two header formats are accepted — use whichever your HTTP client supports:
                </p>
                <pre style={{ background: "var(--doc-pre-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, padding: "14px 20px", fontSize: 13, lineHeight: 1.7, color: "var(--doc-pre-text)", overflowX: "auto", marginBottom: 12 }}>
{`# Preferred
X-Fintella-Api-Key: <your_api_key>

# Also accepted
Authorization: Bearer <your_api_key>`}
                </pre>
                <p style={{ fontSize: 13, color: "var(--doc-text-muted)", marginBottom: 0 }}>
                  Missing or invalid API keys return <Code>401 Unauthorized</Code>. Never include your key in URLs, commit it to version control, or share it over unencrypted channels.
                </p>
              </SubSection>

              <SubSection title="Where to Find Your API Key">
                <div style={{ background: "var(--doc-card-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, padding: "16px 20px", marginBottom: 0 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ fontSize: 20 }}>🔑</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--doc-text)", marginBottom: 6 }}>Partner Settings → API &amp; Integrations</div>
                      <p style={{ fontSize: 13, color: "var(--doc-text-secondary)", margin: 0, lineHeight: 1.6 }}>
                        Log in to your Fintella partner portal, open <strong>Settings</strong> from the left sidebar, then navigate to the <strong>API &amp; Integrations</strong> tab. Your API key is shown there with a copy button. If you do not see this tab, contact your account manager to have API access enabled for your partner account.
                      </p>
                    </div>
                  </div>
                </div>
              </SubSection>

              <SubSection title="Outbound Webhook Verification (Fintella → You)">
                <p style={{ fontSize: 14, color: "var(--doc-text-secondary)", marginBottom: 12 }}>
                  When Fintella sends event payloads to your endpoint, it signs the request body with HMAC-SHA256 using a shared secret. Verify the signature before processing any payload:
                </p>
                <pre style={{ background: "var(--doc-pre-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, padding: "14px 20px", fontSize: 12, lineHeight: 1.7, color: "var(--doc-pre-text)", overflowX: "auto", marginBottom: 12 }}>
{`# Fintella sends this header on every outbound event
X-Fintella-Signature: sha256=<hex(HMAC-SHA256(rawBody, webhookSecret))>

# Verify in Node.js
import crypto from "crypto";

function verifySignature(rawBody: Buffer, signature: string, secret: string) {
  const expected = "sha256=" + crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
}`}
                </pre>
                <InfoBox>
                  Your webhook secret is separate from your API key. Set it once in <strong>Settings → API &amp; Integrations → Webhook Secret</strong>. If you rotate it, old in-flight deliveries will fail validation — rotate during a low-traffic window.
                </InfoBox>
              </SubSection>

              <SubSection title="Rate Limits">
                <div style={{ background: "var(--doc-card-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, overflow: "hidden" }}>
                  {[
                    ["Inbound calls", "60 requests per 60 seconds per API key (sliding window)"],
                    ["429 response includes", "Retry-After header (value in seconds)"],
                    ["Bulk backfills", "Coordinate with your account manager — do not hammer the endpoint"],
                  ].map(([label, val], i) => (
                    <div key={label} style={{ display: "flex", padding: "12px 16px", borderTop: i > 0 ? "1px solid var(--doc-border-subtle)" : "none", gap: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--doc-text-muted)", textTransform: "uppercase", letterSpacing: 0.8, width: 160, flexShrink: 0, paddingTop: 1 }}>{label}</div>
                      <div style={{ fontSize: 13, color: "var(--doc-text-secondary)" }}>{val}</div>
                    </div>
                  ))}
                </div>
              </SubSection>
            </Section>
          </div>

          {/* ═══════════════════════════════════════════
              SECTION 3 — INBOUND WEBHOOKS
          ═══════════════════════════════════════════ */}
          <div id="inbound" style={{ scrollMarginTop: 80 }}>
            <Section title="3. Inbound Webhooks (Partner → Fintella)">
              <p style={{ fontSize: 14, color: "var(--doc-text-secondary)", marginBottom: 20 }}>
                POST deal data to Fintella whenever a new referral is created or an existing deal progresses. The same endpoint handles both creation and updates — the presence of an identifier field (<Code>external_deal_id</Code>, <Code>hs_object_id</Code>, or <Code>dealId</Code>) determines which path executes.
              </p>

              <SubSection title="Endpoint">
                <div style={{ background: "var(--doc-card-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                  {[
                    ["URL", "https://fintella.partners/api/webhook/referral"],
                    ["Methods", "POST (create or update) · PATCH (update only)"],
                    ["Content-Type", "application/json"],
                  ].map(([label, value], i) => (
                    <div key={label} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", padding: "12px 16px", borderTop: i > 0 ? "1px solid var(--doc-border-subtle)" : "none", gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--doc-text-muted)", textTransform: "uppercase", letterSpacing: 0.8, width: 140, flexShrink: 0 }}>{label}</div>
                      <div style={{ fontFamily: "monospace", fontSize: 13, color: "var(--doc-text-secondary)", wordBreak: "break-all" }}>{value}</div>
                    </div>
                  ))}
                </div>
              </SubSection>

              <SubSection title="Request Body Fields">
                <p style={{ fontSize: 13, color: "var(--doc-text-muted)", marginBottom: 16 }}>
                  All fields are optional unless marked required. The API accepts snake_case, camelCase, and common form-field names interchangeably for every field.
                </p>

                {/* Partner Tracking */}
                <div style={{ background: "var(--doc-card-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--doc-border)", background: "rgba(196,160,80,0.08)" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--doc-gold)" }}>Partner Tracking</span>
                  </div>
                  <TableHeader cols={["Field", "Type", "Description"]} />
                  {[
                    [<Code key="1">partner_code</Code>, "string", "Your Fintella partner code (e.g. PTNABC123). Alternatively sent as utm_content or referral_code — all three map to the same field."],
                    [<Code key="2">external_deal_id</Code>, "string", <>Your internal deal ID from your CRM or platform. <strong style={{color:"var(--doc-gold)"}}>Store this on creation</strong> and include it on all future updates. Aliases: <Code>hs_object_id</Code>, <Code>hubspotDealId</Code>, <Code>externalDealId</Code>.</>],
                    [<Code key="3">ido_key</Code>, "string", <>Idempotency key — any unique string (UUID, hash, your submission ID). A duplicate POST with the same key returns 200 with the original deal; no duplicate is created. Alias: <Code>idempotencyKey</Code>, <Code>idempotency_key</Code>. Strongly recommended on every POST.</>],
                  ].map((cells, i, arr) => (
                    <TableRow key={i} cells={cells} cols={3} last={i === arr.length - 1} />
                  ))}
                </div>

                {/* Client Info */}
                <div style={{ background: "var(--doc-card-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--doc-border)", background: "rgba(34,197,94,0.06)" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--doc-green)" }}>Client Information</span>
                  </div>
                  <TableHeader cols={["Field", "Type", "Description"]} />
                  {[
                    [<Code key="1">first_name</Code>, "string", "Client first name. Alias: firstName."],
                    [<Code key="2">last_name</Code>, "string", "Client last name. Alias: lastName."],
                    [<Code key="3">email</Code>, "string", "Client email address. Alias: clientEmail."],
                    [<Code key="4">phone</Code>, "string", "Client phone number. Alias: clientPhone."],
                    [<Code key="5">business_title</Code>, "string", "Client's title at their company (e.g. CFO). Alias: businessTitle."],
                  ].map((cells, i, arr) => (
                    <TableRow key={i} cells={cells} cols={3} last={i === arr.length - 1} />
                  ))}
                </div>

                {/* Business */}
                <div style={{ background: "var(--doc-card-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--doc-border)", background: "rgba(37,99,235,0.06)" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--doc-blue)" }}>Business Details</span>
                  </div>
                  <TableHeader cols={["Field", "Type", "Description"]} />
                  {[
                    [<Code key="1">legal_entity_name</Code>, "string", "Company legal name. Alias: legalEntityName, company, businessName."],
                    [<Code key="2">company_ein</Code>, "string", "Federal EIN (e.g. 87-1234567). Alias: companyEin, ein."],
                    [<Code key="3">service_of_interest</Code>, "string", "Which Fintella service this referral is for. See Services Reference section for valid values."],
                    [<Code key="4">address</Code>, "string", "Street address line 1."],
                    [<Code key="5">street_address_2</Code>, "string", "Street address line 2 (suite, floor, etc.)."],
                    [<Code key="6">city</Code>, "string", "City."],
                    [<Code key="7">state</Code>, "string", "State — accepts 2-letter abbreviation (CA) or full name (California). Normalized to full name on save."],
                    [<Code key="8">zip</Code>, "string", "ZIP/postal code."],
                  ].map((cells, i, arr) => (
                    <TableRow key={i} cells={cells} cols={3} last={i === arr.length - 1} />
                  ))}
                </div>

                {/* Tariff / Import */}
                <div style={{ background: "var(--doc-card-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--doc-border)", background: "rgba(124,58,237,0.06)" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--doc-purple)" }}>Import / Tariff Fields</span>
                  </div>
                  <TableHeader cols={["Field", "Type", "Description"]} />
                  {[
                    [<Code key="1">imports_goods</Code>, "string/bool", "Whether the business imports goods (Yes/No or true/false)."],
                    [<Code key="2">import_countries</Code>, "string", "Countries goods are imported from (e.g. China, Vietnam)."],
                    [<Code key="3">annual_import_value</Code>, "string/number", "Annual import dollar value or range (e.g. $1M–$5M or 2500000)."],
                    [<Code key="4">importer_of_record</Code>, "string", "Entity that is the importer of record (usually the company legal name)."],
                    [<Code key="5">product_type</Code>, "string", <>Product category: <Code>ieepa</Code>, <Code>section301</Code>, or <Code>other</Code>.</>],
                    [<Code key="6">imported_products</Code>, "string", "Free-text description of the goods being imported."],
                  ].map((cells, i, arr) => (
                    <TableRow key={i} cells={cells} cols={3} last={i === arr.length - 1} />
                  ))}
                </div>

                {/* Deal Stage & Financials */}
                <div style={{ background: "var(--doc-card-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--doc-border)", background: "rgba(234,88,12,0.06)" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--doc-orange)" }}>Deal Stage &amp; Financials</span>
                  </div>
                  <TableHeader cols={["Field", "Type", "Description"]} />
                  {[
                    [<Code key="1">stage</Code>, "string", "Current deal stage in your pipeline. Stored as-is. Aliases: dealstage, deal_stage, pipeline_stage, status."],
                    [<Code key="2">estimated_refund_amount</Code>, "number", "Estimated refund or recovery amount in USD. Required when transitioning to in-process stages."],
                    [<Code key="3">actual_refund_amount</Code>, "number", "Actual refund received by the client. Set when deal closes."],
                    [<Code key="4">firm_fee_rate</Code>, "number", "Service provider fee rate as a percentage (e.g. 20 for 20%). Required at engagement/contract stages."],
                    [<Code key="5">firm_fee_amount</Code>, "number", "Fee dollar amount. Can be sent explicitly or is derived from refund × rate."],
                    [<Code key="6">consult_booked_date</Code>, "string", "Consultation date (YYYY-MM-DD)."],
                    [<Code key="7">consult_booked_time</Code>, "string", "Consultation time (HH:MM, 24-hour)."],
                    [<Code key="8">closed_lost_reason</Code>, "string", "Optional reason when a deal is moved to Closed Lost."],
                  ].map((cells, i, arr) => (
                    <TableRow key={i} cells={cells} cols={3} last={i === arr.length - 1} />
                  ))}
                </div>

                {/* Notes / Raw Response */}
                <div style={{ background: "var(--doc-card-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--doc-border)", background: "rgba(136,136,136,0.06)" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--doc-text-muted)" }}>Notes &amp; Raw Data</span>
                  </div>
                  <TableHeader cols={["Field", "Type", "Description"]} />
                  {[
                    [<Code key="1">affiliate_notes</Code>, "string", "Notes from the referring partner or CRM about this lead."],
                    [<Code key="2">notes</Code>, "string", "General deal notes or internal comments."],
                    [<Code key="3">partner_response</Code>, "object", "Arbitrary key-value object — store any raw response or metadata from your system alongside the deal. Saved in serviceFields."],
                    [<Code key="4">internal_raw_code</Code>, "string", "Your platform's internal status code or stage identifier. Stored verbatim for your reference."],
                  ].map((cells, i, arr) => (
                    <TableRow key={i} cells={cells} cols={3} last={i === arr.length - 1} />
                  ))}
                </div>

                <InfoBox>
                  <strong style={{ color: "var(--doc-gold)" }}>Sparse payloads are accepted.</strong> If a POST has no identifying fields (name, email, company), the deal is still created — the raw body is preserved in <Code>rawPayload</Code> for admin review and a <Code>warning</Code> field is returned in the 201 response. No leads are lost.
                </InfoBox>
              </SubSection>

              <SubSection title="Idempotency">
                <p style={{ fontSize: 14, color: "var(--doc-text-secondary)", marginBottom: 12 }}>
                  Include an <Code>ido_key</Code> (or <Code>idempotencyKey</Code>) on every POST to make retries safe. The first POST with a new key creates the deal and returns 201. Any subsequent POST with the same key returns 200 with the original deal — no duplicate is created.
                </p>
                <pre style={{ background: "var(--doc-pre-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, padding: "14px 20px", fontSize: 13, lineHeight: 1.7, color: "var(--doc-pre-text)", overflowX: "auto", margin: 0 }}>
{`{
  "ido_key": "my-crm-submission-uuid-abc123",
  "partner_code": "PTNABC123",
  "external_deal_id": "deal_98765",
  "first_name": "Jane",
  ...
}`}
                </pre>
              </SubSection>

              <SubSection title="Creating a Deal (POST)">
                <pre style={{ background: "var(--doc-pre-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, padding: "14px 20px", fontSize: 12, lineHeight: 1.65, color: "var(--doc-pre-text)", overflowX: "auto", margin: "0 0 16px" }}>
{`curl -X POST https://fintella.partners/api/webhook/referral \\
  -H "Content-Type: application/json" \\
  -H "X-Fintella-Api-Key: $API_KEY" \\
  -d '{
    "ido_key": "crm-sub-20260529-001",
    "partner_code": "PTNABC123",
    "external_deal_id": "deal_98765",
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane@acmeimports.com",
    "phone": "(555) 123-4567",
    "legal_entity_name": "Acme Imports LLC",
    "company_ein": "87-1234567",
    "service_of_interest": "Tariff Refund",
    "address": "1201 S Main Street",
    "city": "Phoenix",
    "state": "Arizona",
    "zip": "85004",
    "imports_goods": "Yes",
    "import_countries": "China, Vietnam",
    "annual_import_value": "$1M - $5M"
  }'`}
                </pre>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <ResponseBlock color="var(--doc-green)" label="201 Created" body={`{\n  "received": true,\n  "dealId": "clx8f9abc123def456",\n  "dealName": "Acme Imports LLC",\n  "partnerCode": "PTNABC123"\n}`} />
                  <ResponseBlock color="var(--doc-blue)" label="200 OK (idempotent — ido_key already seen)" body={`{\n  "received": true,\n  "dealId": "clx8f9abc123def456",\n  "dealName": "Acme Imports LLC",\n  "partnerCode": "PTNABC123",\n  "idempotent": true\n}`} />
                  <ResponseBlock color="var(--doc-yellow)" label="201 Created with warning (sparse payload)" body={`{\n  "received": true,\n  "dealId": "clx8f9abc123def456",\n  "dealName": "Referral Form Submission",\n  "partnerCode": "UNATTRIBUTED",\n  "warning": "Accepted but the payload had no identifying fields. Full payload saved to rawPayload for admin review."\n}`} />
                </div>
              </SubSection>

              <SubSection title="Updating a Deal (POST or PATCH with external_deal_id)">
                <p style={{ fontSize: 14, color: "var(--doc-text-secondary)", marginBottom: 12 }}>
                  Include your <Code>external_deal_id</Code> (or <Code>hs_object_id</Code>) to update an existing deal. Send only the fields that changed — all are optional except the identifier.
                </p>
                <pre style={{ background: "var(--doc-pre-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, padding: "14px 20px", fontSize: 12, lineHeight: 1.65, color: "var(--doc-pre-text)", overflowX: "auto", margin: "0 0 16px" }}>
{`curl -X POST https://fintella.partners/api/webhook/referral \\
  -H "Content-Type: application/json" \\
  -H "X-Fintella-Api-Key: $API_KEY" \\
  -d '{
    "external_deal_id": "deal_98765",
    "stage": "Contract Sent",
    "estimated_refund_amount": 250000,
    "firm_fee_rate": 20
  }'`}
                </pre>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <ResponseBlock color="var(--doc-green)" label="200 Updated" body={`{\n  "updated": true,\n  "dealId": "clx8f9abc123def456",\n  "dealName": "Acme Imports LLC",\n  "fieldsUpdated": ["externalStage", "estimatedRefundAmount", "firmFeeRate"]\n}`} />
                  <ResponseBlock color="var(--doc-red)" label="404 Deal Not Found" body={`{\n  "error": "Deal not found"\n}`} />
                </div>
              </SubSection>

              <SubSection title="Closing a Deal">
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--doc-green)", marginBottom: 8 }}>Closed Won:</div>
                    <pre style={{ background: "var(--doc-pre-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, padding: "14px 20px", fontSize: 13, lineHeight: 1.7, color: "var(--doc-pre-text)", overflowX: "auto", margin: 0 }}>
{`{
  "external_deal_id": "deal_98765",
  "stage": "Closed Won",
  "estimated_refund_amount": 300000,
  "actual_refund_amount": 287500,
  "firm_fee_rate": 20,
  "firm_fee_amount": 57500
}`}
                    </pre>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--doc-red)", marginBottom: 8 }}>Closed Lost (with optional reason):</div>
                    <pre style={{ background: "var(--doc-pre-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, padding: "14px 20px", fontSize: 13, lineHeight: 1.7, color: "var(--doc-pre-text)", overflowX: "auto", margin: 0 }}>
{`{
  "external_deal_id": "deal_98765",
  "stage": "Closed Lost",
  "closed_lost_reason": "Client decided not to pursue recovery"
}`}
                    </pre>
                  </div>
                </div>
              </SubSection>
            </Section>
          </div>

          {/* ═══════════════════════════════════════════
              SECTION 4 — OUTBOUND WEBHOOKS
          ═══════════════════════════════════════════ */}
          <div id="outbound" style={{ scrollMarginTop: 80 }}>
            <Section title="4. Outbound Webhooks (Fintella → Partner)">
              <p style={{ fontSize: 14, color: "var(--doc-text-secondary)", marginBottom: 20 }}>
                Configure a webhook URL in your partner settings and Fintella will POST a signed JSON payload to it whenever a deal event occurs. Your endpoint must respond with HTTP 200 within 10 seconds; otherwise the delivery is retried.
              </p>

              <SubSection title="Configuration">
                <div style={{ background: "var(--doc-card-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ fontSize: 20 }}>⚙️</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--doc-text)", marginBottom: 6 }}>Partner Settings → API &amp; Integrations → Outbound Webhook URL</div>
                      <p style={{ fontSize: 13, color: "var(--doc-text-secondary)", margin: 0, lineHeight: 1.6 }}>
                        Enter your endpoint URL and optionally a webhook secret for HMAC verification. Changes take effect immediately for new events — already-queued deliveries use the previous secret.
                      </p>
                    </div>
                  </div>
                </div>
              </SubSection>

              <SubSection title="Event Types">
                <div style={{ background: "var(--doc-card-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                  <TableHeader cols={["Event", "When it fires"]} />
                  {[
                    [<Code key="1">deal.created</Code>, "A new referral deal is created in Fintella — either via inbound webhook or manually by an admin."],
                    [<Code key="2">deal.updated</Code>, "Any field on an existing deal is changed — stage, amounts, contact info, etc."],
                    [<Code key="3">deal.stage_changed</Code>, "The deal stage field specifically changes. Includes both old and new stage values in the payload."],
                    [<Code key="4">deal.consultation_booked</Code>, "A consultation date/time is set or updated on the deal."],
                    [<Code key="5">deal.closed_won</Code>, "Deal moves to Closed Won status. Commission ledger entries are created at this point."],
                    [<Code key="6">deal.closed_lost</Code>, "Deal moves to Closed Lost status."],
                    [<Code key="7">deal.payment_received</Code>, "Admin marks that payment has been received from the service provider. Partner commissions move to due status."],
                    [<Code key="8">partner.commission_paid</Code>, "A partner payout batch is processed and your commission is paid."],
                  ].map((cells, i, arr) => (
                    <TableRow key={i} cells={cells} cols={2} last={i === arr.length - 1} />
                  ))}
                </div>
              </SubSection>

              <SubSection title="Payload Structure">
                <p style={{ fontSize: 14, color: "var(--doc-text-secondary)", marginBottom: 12 }}>
                  Every outbound event payload shares a common envelope, with event-specific data in the <Code>data</Code> object:
                </p>
                <pre style={{ background: "var(--doc-pre-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, padding: "14px 20px", fontSize: 13, lineHeight: 1.7, color: "var(--doc-pre-text)", overflowX: "auto", marginBottom: 16 }}>
{`{
  "event": "deal.stage_changed",
  "timestamp": "2026-05-29T14:23:00Z",
  "fintella_version": "2",
  "data": {
    "deal_id":              "clx8f9abc123def456",
    "deal_url":             "https://fintella.partners/admin/deals/clx8f9abc123def456",
    "external_deal_id":     "deal_98765",
    "ido_key":              "crm-sub-20260529-001",
    "deal_name":            "Acme Imports LLC",
    "stage":                "Contract Sent",
    "stage_previous":       "Qualified",
    "referral_partner_code": "PTNABC123",
    "referral_partner_name": "Jane Doe",
    "client_name":          "John Smith",
    "client_email":         "john@acmeimports.com",
    "client_phone":         "(555) 123-4567",
    "company":              "Acme Imports LLC",
    "service":              "Tariff Refund",
    "estimated_refund_amount": 250000,
    "actual_refund_amount":    null,
    "firm_fee_rate":           20,
    "firm_fee_amount":         50000,
    "consult_booked_date":  "2026-06-01",
    "consult_booked_time":  "14:00",
    "created_at":           "2026-05-29T10:00:00Z",
    "updated_at":           "2026-05-29T14:23:00Z"
  }
}`}
                </pre>

                <div style={{ background: "var(--doc-card-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--doc-border)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--doc-text-muted)" }}>Payload Field Reference</div>
                  <TableHeader cols={["Field", "Type", "Description"]} />
                  {[
                    [<Code key="1">deal_id</Code>, "string", "Fintella internal deal ID (cuid). Stable, never changes."],
                    [<Code key="2">deal_url</Code>, "string", "Direct URL to the deal in the Fintella admin portal. Use this as a deep link from your system."],
                    [<Code key="3">external_deal_id</Code>, "string | null", "Your platform's deal ID — the value you sent as external_deal_id or hs_object_id on the inbound POST."],
                    [<Code key="4">ido_key</Code>, "string | null", "The idempotency key you sent when the deal was created, if any."],
                    [<Code key="5">referral_partner_code</Code>, "string", "The Fintella partner code attributed to this deal."],
                    [<Code key="6">referral_partner_name</Code>, "string", "Full display name of the attributed partner (first + last name)."],
                    [<Code key="7">deal_name</Code>, "string", "Human-readable deal name (usually the company or client name)."],
                    [<Code key="8">stage</Code>, "string", "Current deal stage."],
                    [<Code key="9">stage_previous</Code>, "string | null", "Previous stage (only present on deal.stage_changed events)."],
                    [<Code key="10">client_name</Code>, "string", "Client full name."],
                    [<Code key="11">client_email</Code>, "string", "Client email address."],
                    [<Code key="12">client_phone</Code>, "string", "Client phone number."],
                    [<Code key="13">company</Code>, "string", "Business legal entity name."],
                    [<Code key="14">service</Code>, "string", "The Fintella service this deal is for (e.g. Tariff Refund, Penalty Abatement)."],
                    [<Code key="15">estimated_refund_amount</Code>, "number | null", "Estimated refund/recovery amount in USD."],
                    [<Code key="16">actual_refund_amount</Code>, "number | null", "Actual refund received. Only populated after a deal closes."],
                    [<Code key="17">firm_fee_rate</Code>, "number | null", "Service provider fee rate (percentage)."],
                    [<Code key="18">firm_fee_amount</Code>, "number | null", "Service provider fee dollar amount."],
                  ].map((cells, i, arr) => (
                    <TableRow key={i} cells={cells} cols={3} last={i === arr.length - 1} />
                  ))}
                </div>
              </SubSection>

              <SubSection title="Example Payloads">
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--doc-green)", marginBottom: 8 }}>deal.created</div>
                    <pre style={{ background: "var(--doc-pre-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, padding: "14px 20px", fontSize: 12, lineHeight: 1.65, color: "var(--doc-pre-text)", overflowX: "auto", margin: 0 }}>
{`{
  "event": "deal.created",
  "timestamp": "2026-05-29T10:00:00Z",
  "fintella_version": "2",
  "data": {
    "deal_id": "clx8f9abc123def456",
    "deal_url": "https://fintella.partners/admin/deals/clx8f9abc123def456",
    "external_deal_id": "deal_98765",
    "ido_key": "crm-sub-20260529-001",
    "deal_name": "Acme Imports LLC",
    "stage": "lead_submitted",
    "referral_partner_code": "PTNABC123",
    "referral_partner_name": "Jane Doe",
    "client_name": "John Smith",
    "client_email": "john@acmeimports.com",
    "company": "Acme Imports LLC",
    "service": "Tariff Refund",
    "estimated_refund_amount": null,
    "created_at": "2026-05-29T10:00:00Z",
    "updated_at": "2026-05-29T10:00:00Z"
  }
}`}
                    </pre>
                  </div>

                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--doc-orange)", marginBottom: 8 }}>deal.stage_changed</div>
                    <pre style={{ background: "var(--doc-pre-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, padding: "14px 20px", fontSize: 12, lineHeight: 1.65, color: "var(--doc-pre-text)", overflowX: "auto", margin: 0 }}>
{`{
  "event": "deal.stage_changed",
  "timestamp": "2026-05-30T09:15:00Z",
  "fintella_version": "2",
  "data": {
    "deal_id": "clx8f9abc123def456",
    "deal_url": "https://fintella.partners/admin/deals/clx8f9abc123def456",
    "external_deal_id": "deal_98765",
    "deal_name": "Acme Imports LLC",
    "stage": "client_engaged",
    "stage_previous": "qualified",
    "referral_partner_code": "PTNABC123",
    "referral_partner_name": "Jane Doe",
    "estimated_refund_amount": 250000,
    "firm_fee_rate": 20,
    "updated_at": "2026-05-30T09:15:00Z"
  }
}`}
                    </pre>
                  </div>

                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--doc-gold)", marginBottom: 8 }}>deal.closed_won</div>
                    <pre style={{ background: "var(--doc-pre-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, padding: "14px 20px", fontSize: 12, lineHeight: 1.65, color: "var(--doc-pre-text)", overflowX: "auto", margin: 0 }}>
{`{
  "event": "deal.closed_won",
  "timestamp": "2026-06-15T16:00:00Z",
  "fintella_version": "2",
  "data": {
    "deal_id": "clx8f9abc123def456",
    "deal_url": "https://fintella.partners/admin/deals/clx8f9abc123def456",
    "external_deal_id": "deal_98765",
    "deal_name": "Acme Imports LLC",
    "stage": "closedwon",
    "referral_partner_code": "PTNABC123",
    "referral_partner_name": "Jane Doe",
    "client_name": "John Smith",
    "company": "Acme Imports LLC",
    "service": "Tariff Refund",
    "estimated_refund_amount": 300000,
    "actual_refund_amount": 287500,
    "firm_fee_rate": 20,
    "firm_fee_amount": 57500,
    "close_date": "2026-06-15T16:00:00Z",
    "updated_at": "2026-06-15T16:00:00Z"
  }
}`}
                    </pre>
                  </div>
                </div>
              </SubSection>

              <SubSection title="Delivery &amp; Retry">
                <div style={{ background: "var(--doc-card-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, overflow: "hidden" }}>
                  {[
                    ["Timeout", "10 seconds per delivery attempt"],
                    ["Success", "Your endpoint must return HTTP 2xx"],
                    ["Retry schedule", "Attempt 1 immediately → 30s → 2min → 10min → 1hr → give up"],
                    ["Idempotency", "Your endpoint may receive the same event twice on retry — use deal_id + event to deduplicate"],
                  ].map(([label, val], i) => (
                    <div key={label} style={{ display: "flex", padding: "12px 16px", borderTop: i > 0 ? "1px solid var(--doc-border-subtle)" : "none", gap: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--doc-text-muted)", textTransform: "uppercase", letterSpacing: 0.8, width: 140, flexShrink: 0, paddingTop: 1 }}>{label}</div>
                      <div style={{ fontSize: 13, color: "var(--doc-text-secondary)" }}>{val}</div>
                    </div>
                  ))}
                </div>
              </SubSection>
            </Section>
          </div>

          {/* ═══════════════════════════════════════════
              SECTION 5 — WORKFLOW VARIABLES
          ═══════════════════════════════════════════ */}
          <div id="workflow-variables" style={{ scrollMarginTop: 80 }}>
            <Section title="5. Workflow Variables">
              <p style={{ fontSize: 14, color: "var(--doc-text-secondary)", marginBottom: 20 }}>
                When building automated workflows, email templates, or CRM automations that reference Fintella deal data, use these variables. Fintella&apos;s workflow engine substitutes them at send time. All variables use the <Code>{"{{double_brace}}"}</Code> syntax.
              </p>

              {/* Deal Variables */}
              <div style={{ background: "var(--doc-card-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--doc-border)", background: "rgba(196,160,80,0.08)" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--doc-gold)" }}>Deal Variables</span>
                </div>
                <TableHeader cols={["Variable", "Description", "Example"]} />
                {[
                  [<Code key="1">{"{{deal_id}}"}</Code>, "Fintella internal deal ID", "clx8f9abc123def456"],
                  [<Code key="2">{"{{deal_url}}"}</Code>, "Direct link to this deal in Fintella admin — useful for partner notifications", "https://fintella.partners/admin/deals/clx8f9abc..."],
                  [<Code key="3">{"{{deal_name}}"}</Code>, "Deal display name (usually company or client name)", "Acme Imports LLC"],
                  [<Code key="4">{"{{external_deal_id}}"}</Code>, "Your platform's deal ID (what you sent as external_deal_id)", "deal_98765"],
                  [<Code key="5">{"{{deal_stage}}"}</Code>, "Current deal stage", "client_engaged"],
                  [<Code key="6">{"{{service}}"}</Code>, "Fintella service for this deal", "Tariff Refund"],
                  [<Code key="7">{"{{estimated_refund_amount}}"}</Code>, "Estimated recovery amount (formatted as USD)", "$250,000"],
                  [<Code key="8">{"{{actual_refund_amount}}"}</Code>, "Actual recovery received (formatted as USD)", "$287,500"],
                  [<Code key="9">{"{{firm_fee_rate}}"}</Code>, "Service provider fee rate", "20%"],
                  [<Code key="10">{"{{firm_fee_amount}}"}</Code>, "Service provider fee dollar amount (formatted as USD)", "$57,500"],
                  [<Code key="11">{"{{close_date}}"}</Code>, "Date the deal was closed (formatted as M/D/YYYY)", "6/15/2026"],
                  [<Code key="12">{"{{consult_date}}"}</Code>, "Scheduled consultation date", "June 1, 2026"],
                  [<Code key="13">{"{{consult_time}}"}</Code>, "Scheduled consultation time", "2:00 PM"],
                ].map((cells, i, arr) => (
                  <TableRow key={i} cells={cells} cols={3} last={i === arr.length - 1} />
                ))}
              </div>

              {/* Partner Variables */}
              <div style={{ background: "var(--doc-card-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--doc-border)", background: "rgba(37,99,235,0.06)" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--doc-blue)" }}>Partner Variables</span>
                </div>
                <TableHeader cols={["Variable", "Description", "Example"]} />
                {[
                  [<Code key="1">{"{{referral_partner_code}}"}</Code>, "Partner code attributed to this deal", "PTNABC123"],
                  [<Code key="2">{"{{referral_partner_name}}"}</Code>, "Full display name of the attributed partner", "Jane Doe"],
                  [<Code key="3">{"{{referral_partner_email}}"}</Code>, "Partner email address", "jane@partnerfirm.com"],
                  [<Code key="4">{"{{partner_commission_rate}}"}</Code>, "This partner's commission rate for the deal", "15%"],
                  [<Code key="5">{"{{partner_commission_amount}}"}</Code>, "This partner's commission dollar amount (formatted)", "$8,625"],
                  [<Code key="6">{"{{partner_tier}}"}</Code>, "Partner tier level (L1, L2, or L3)", "L1"],
                ].map((cells, i, arr) => (
                  <TableRow key={i} cells={cells} cols={3} last={i === arr.length - 1} />
                ))}
              </div>

              {/* Client Variables */}
              <div style={{ background: "var(--doc-card-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--doc-border)", background: "rgba(34,197,94,0.06)" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--doc-green)" }}>Client Variables</span>
                </div>
                <TableHeader cols={["Variable", "Description", "Example"]} />
                {[
                  [<Code key="1">{"{{client_name}}"}</Code>, "Client full name", "John Smith"],
                  [<Code key="2">{"{{client_first_name}}"}</Code>, "Client first name", "John"],
                  [<Code key="3">{"{{client_last_name}}"}</Code>, "Client last name", "Smith"],
                  [<Code key="4">{"{{client_email}}"}</Code>, "Client email address", "john@acmeimports.com"],
                  [<Code key="5">{"{{client_phone}}"}</Code>, "Client phone number", "(555) 123-4567"],
                  [<Code key="6">{"{{client_title}}"}</Code>, "Client's title at their company", "CFO"],
                  [<Code key="7">{"{{company_name}}"}</Code>, "Business legal entity name", "Acme Imports LLC"],
                  [<Code key="8">{"{{company_ein}}"}</Code>, "Business EIN", "87-1234567"],
                  [<Code key="9">{"{{company_city}}"}</Code>, "Business city", "Phoenix"],
                  [<Code key="10">{"{{company_state}}"}</Code>, "Business state", "Arizona"],
                ].map((cells, i, arr) => (
                  <TableRow key={i} cells={cells} cols={3} last={i === arr.length - 1} />
                ))}
              </div>

              <InfoBox>
                Variables that have no value for a given deal resolve to an empty string by default. To avoid awkward blanks in templates, use conditional blocks where supported: <Code>{"{{#if estimated_refund_amount}}Estimated: {{estimated_refund_amount}}{{/if}}"}</Code>
              </InfoBox>
            </Section>
          </div>

          {/* ═══════════════════════════════════════════
              SECTION 6 — API ENDPOINTS REFERENCE
          ═══════════════════════════════════════════ */}
          <div id="api-reference" style={{ scrollMarginTop: 80 }}>
            <Section title="6. API Endpoints Reference">
              <p style={{ fontSize: 14, color: "var(--doc-text-secondary)", marginBottom: 20 }}>
                All endpoints under <Code>https://fintella.partners/api/</Code> require authentication unless noted. Use your API key as described in Section 2.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  {
                    method: "POST",
                    path: "/api/webhook/referral",
                    color: "var(--doc-green)",
                    desc: "Create a new deal. Idempotent when ido_key is provided. Auto-routes to update when external_deal_id or hs_object_id is present.",
                    key_fields: "partner_code, external_deal_id, ido_key, client and business fields",
                    returns: "{ received, dealId, dealName, partnerCode }",
                  },
                  {
                    method: "PATCH",
                    path: "/api/webhook/referral",
                    color: "var(--doc-blue)",
                    desc: "Update an existing deal. Requires external_deal_id, hs_object_id, or dealId to identify the deal.",
                    key_fields: "external_deal_id (required), any updatable fields",
                    returns: "{ updated, dealId, dealName, fieldsUpdated[] }",
                  },
                  {
                    method: "GET",
                    path: "/api/webhook/referral",
                    color: "var(--doc-text-muted)",
                    desc: "Health check — unauthenticated. Returns endpoint status and full field reference documentation.",
                    key_fields: "none",
                    returns: "{ status, fields, ... }",
                  },
                  {
                    method: "GET",
                    path: "/api/deals",
                    color: "var(--doc-text-muted)",
                    desc: "Partner-facing — returns your own deals, downline deals, and pending invites. Requires partner session.",
                    key_fields: "session auth only",
                    returns: "{ directDeals[], downlineDeals[], downlinePartners[], pendingInvites[] }",
                  },
                  {
                    method: "POST",
                    path: "/api/deals",
                    color: "var(--doc-green)",
                    desc: "Partner-facing — submit a new referral directly from the partner portal UI. Requires partner session.",
                    key_fields: "businessName, email, phone, productType, importedProducts, estimatedAnnualImportValue",
                    returns: "{ deal }",
                  },
                ].map((ep) => (
                  <div key={ep.path + ep.method} style={{ background: "var(--doc-card-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--doc-border-subtle)" }}>
                      <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: ep.color, background: "var(--doc-code-bg)", padding: "3px 8px", borderRadius: 4, flexShrink: 0 }}>{ep.method}</span>
                      <span style={{ fontFamily: "monospace", fontSize: 13, color: "var(--doc-text)", fontWeight: 600 }}>{ep.path}</span>
                    </div>
                    <div style={{ padding: "12px 16px" }}>
                      <p style={{ fontSize: 13, color: "var(--doc-text-secondary)", margin: "0 0 8px" }}>{ep.desc}</p>
                      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--doc-text-muted)", marginBottom: 3 }}>Key fields</div>
                          <div style={{ fontSize: 12, color: "var(--doc-text-secondary)", fontFamily: "monospace" }}>{ep.key_fields}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--doc-text-muted)", marginBottom: 3 }}>Returns</div>
                          <div style={{ fontSize: 12, color: "var(--doc-text-secondary)", fontFamily: "monospace" }}>{ep.returns}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          {/* ═══════════════════════════════════════════
              SECTION 7 — TESTING
          ═══════════════════════════════════════════ */}
          <div id="testing" style={{ scrollMarginTop: 80 }}>
            <Section title="7. Testing Webhooks">
              <SubSection title="Inspect Inbound Payloads Before Going Live">
                <p style={{ fontSize: 14, color: "var(--doc-text-secondary)", marginBottom: 12 }}>
                  Use a free service like <strong>webhook.site</strong> or <strong>requestbin.com</strong> to inspect the exact payloads your system sends before pointing them at Fintella:
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {[
                    ["1", "Open webhook.site — a unique URL is generated for you automatically"],
                    ["2", "Configure your CRM or automation to POST to that URL instead of fintella.partners"],
                    ["3", "Trigger a test submission from your system"],
                    ["4", "Inspect the exact JSON body that arrives at webhook.site"],
                    ["5", "Verify field names match what Fintella expects (see field tables in Section 3)"],
                    ["6", "Once confirmed, switch the target URL to https://fintella.partners/api/webhook/referral"],
                  ].map(([num, step]) => (
                    <div key={num} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--doc-step-bg)", border: "1px solid var(--doc-step-border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--doc-gold)" }}>{num}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--doc-text-secondary)", paddingTop: 3 }}>{step}</div>
                    </div>
                  ))}
                </div>
              </SubSection>

              <SubSection title="Test Outbound Webhook Delivery">
                <p style={{ fontSize: 14, color: "var(--doc-text-secondary)", marginBottom: 12 }}>
                  To test that Fintella can reach your endpoint:
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {[
                    ["1", "Set your endpoint URL in Settings → API & Integrations → Outbound Webhook URL"],
                    ["2", "Use the \"Send Test Event\" button on the same settings page — this fires a deal.created event with synthetic data to your URL"],
                    ["3", "Verify your server receives the payload, validates the HMAC signature, and returns HTTP 200"],
                    ["4", "Check the delivery log in your Fintella settings for status of recent deliveries"],
                  ].map(([num, step]) => (
                    <div key={num} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--doc-step-bg)", border: "1px solid var(--doc-step-border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--doc-gold)" }}>{num}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--doc-text-secondary)", paddingTop: 3 }}>{step}</div>
                    </div>
                  ))}
                </div>
              </SubSection>

              <SubSection title="Sandbox / Preview API Key">
                <InfoBox>
                  A sandbox API key is available on request. It points to an isolated test database — no real deal data is touched. Contact your Fintella account manager to provision sandbox credentials.
                </InfoBox>
              </SubSection>

              <SubSection title="Quick Smoke Test (cURL)">
                <pre style={{ background: "var(--doc-pre-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, padding: "14px 20px", fontSize: 12, lineHeight: 1.65, color: "var(--doc-pre-text)", overflowX: "auto", margin: 0 }}>
{`# 1. Health check — no auth required
curl https://fintella.partners/api/webhook/referral

# 2. Minimal deal creation with idempotency
curl -X POST https://fintella.partners/api/webhook/referral \\
  -H "Content-Type: application/json" \\
  -H "X-Fintella-Api-Key: $API_KEY" \\
  -d '{
    "ido_key": "test-001",
    "partner_code": "PTNABC123",
    "external_deal_id": "test-ext-001",
    "first_name": "Test",
    "last_name": "Client",
    "email": "test@example.com",
    "legal_entity_name": "Test Corp"
  }'

# 3. Retry the same POST — should return 200 + idempotent: true
curl -X POST https://fintella.partners/api/webhook/referral \\
  -H "Content-Type: application/json" \\
  -H "X-Fintella-Api-Key: $API_KEY" \\
  -d '{ "ido_key": "test-001", "partner_code": "PTNABC123" }'`}
                </pre>
              </SubSection>
            </Section>
          </div>

          {/* ═══════════════════════════════════════════
              SECTION 8 — SERVICES REFERENCE
          ═══════════════════════════════════════════ */}
          <div id="services" style={{ scrollMarginTop: 80 }}>
            <Section title="8. Services Reference">
              <p style={{ fontSize: 14, color: "var(--doc-text-secondary)", marginBottom: 20 }}>
                The Fintella API works for all services offered through the partner network. Use the <Code>service_of_interest</Code> field (inbound) or the <Code>{"{{service}}"}</Code> variable (workflows/outbound) to identify which service a deal is for. The API and webhook format are identical across all services.
              </p>

              <div style={{ background: "var(--doc-card-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                <TableHeader cols={["service_of_interest value", "Description", "Key Deal Fields"]} />
                {[
                  [
                    <><FieldBadge key="1">Tariff Refund</FieldBadge><FieldBadge key="2">IEEPA Tariff Relief</FieldBadge></>,
                    "Recovery of tariffs paid under Section 301 (China) or IEEPA executive orders. Client must be the importer of record.",
                    "imports_goods, import_countries, annual_import_value, product_type, importer_of_record",
                  ],
                  [
                    <><FieldBadge key="1">Penalty Abatement</FieldBadge><FieldBadge key="2">ERC Recovery</FieldBadge></>,
                    "IRS penalty abatement or Employee Retention Credit recovery. No import fields required.",
                    "legal_entity_name, company_ein, estimated_refund_amount",
                  ],
                  [
                    <FieldBadge key="1">Other</FieldBadge>,
                    "Any other service offered by a Fintella partner provider. Use partner_response to pass service-specific structured data.",
                    "partner_response (arbitrary key-value object)",
                  ],
                ].map((cells, i, arr) => (
                  <TableRow key={i} cells={cells} cols={3} last={i === arr.length - 1} />
                ))}
              </div>

              <InfoBox>
                <strong style={{ color: "var(--doc-gold)" }}>All API behavior is identical across services.</strong> Authentication, idempotency, inbound/outbound formats, and workflow variables all work the same way regardless of <Code>service_of_interest</Code>. Service-specific fields (like import data for tariff deals) are simply ignored if not relevant.
              </InfoBox>
            </Section>
          </div>

          {/* ═══════════════════════════════════════════
              SECTION 9 — ERROR HANDLING
          ═══════════════════════════════════════════ */}
          <div id="error-handling" style={{ scrollMarginTop: 80 }}>
            <Section title="9. Error Handling &amp; Retry Strategy">
              <SubSection title="HTTP Status Codes">
                <div style={{ background: "var(--doc-card-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                  {[
                    ["201", "Created", "New deal created successfully.", "var(--doc-green)"],
                    ["200", "OK", "Successful update, or idempotent replay of a prior POST.", "var(--doc-blue)"],
                    ["400", "Bad Request", "Invalid JSON or missing required fields. Do NOT retry — fix the payload.", "var(--doc-yellow)"],
                    ["401", "Unauthorized", "Missing or invalid API key. Check your X-Fintella-Api-Key header.", "var(--doc-red)"],
                    ["404", "Not Found", "Update with an unknown external_deal_id. Verify the identifier.", "var(--doc-red)"],
                    ["429", "Too Many Requests", "Rate limit exceeded. Respect the Retry-After header.", "var(--doc-orange)"],
                    ["5xx", "Server Error", "Fintella error. Retry with exponential backoff — max 5 attempts.", "var(--doc-purple)"],
                  ].map(([code, name, desc, color], i) => (
                    <div key={code} style={{ padding: "14px 16px", borderTop: i > 0 ? "1px solid var(--doc-border-subtle)" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                        <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color }}>{code}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--doc-text)" }}>{name}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--doc-text-secondary)", paddingLeft: 18 }}>{desc}</div>
                    </div>
                  ))}
                </div>
              </SubSection>

              <SubSection title="Retry Schedule (for 5xx and 429)">
                <div style={{ background: "var(--doc-card-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                  {[
                    ["Attempt 1", "immediately"],
                    ["Attempt 2", "after 30 seconds"],
                    ["Attempt 3", "after 2 minutes"],
                    ["Attempt 4", "after 10 minutes"],
                    ["Attempt 5", "after 1 hour"],
                    ["Give up", "log + alert your ops channel; contact Fintella support if outage persists"],
                  ].map(([step, delay], i) => (
                    <div key={step} style={{ display: "flex", padding: "10px 16px", borderTop: i > 0 ? "1px solid var(--doc-border-subtle)" : "none", fontSize: 13 }}>
                      <div style={{ width: 120, color: "var(--doc-text-muted)", flexShrink: 0 }}>{step}</div>
                      <div style={{ fontFamily: "monospace", color: "var(--doc-text-secondary)" }}>{delay}</div>
                    </div>
                  ))}
                </div>
                <InfoBox>
                  <strong style={{ color: "var(--doc-gold)" }}>Never retry 4xx errors except 429.</strong> A 400, 401, or 404 indicates the request itself is wrong — retrying produces the same error. Fix the payload or credentials first. Use <Code>ido_key</Code> on every POST so retries are safe by design.
                </InfoBox>
              </SubSection>

              <SubSection title="Common Error Patterns">
                <div style={{ background: "var(--doc-card-bg)", border: "1px solid var(--doc-border)", borderRadius: 12, overflow: "hidden" }}>
                  <TableHeader cols={["Symptom", "Likely Cause", "Fix"]} />
                  {[
                    ["Always getting 401", "Wrong header name or value", <><Code key="1">X-Fintella-Api-Key</Code> header is case-sensitive. Verify there are no leading/trailing spaces in your key.</>],
                    ["201 returns partnerCode: UNATTRIBUTED", "partner_code not in payload", "Include partner_code (or utm_content, referral_code) in the POST body."],
                    ["404 on update", "external_deal_id not found", "Verify the value you're sending matches what was sent on the original POST. Check for whitespace or encoding issues."],
                    ["Duplicate deals appearing", "Not using ido_key", "Add a stable unique ido_key to every POST. If duplicates already exist, contact support — we can de-duplicate."],
                    ["Outbound events not arriving", "Webhook URL unreachable or returning non-2xx", "Verify your endpoint is publicly reachable. Check your server logs for incoming requests. Use the test button in Settings."],
                    ["HMAC validation failing", "Raw body altered before verification", "Compute the HMAC on the exact raw bytes received, before any JSON parsing."],
                  ].map((cells, i, arr) => (
                    <TableRow key={i} cells={cells} cols={3} last={i === arr.length - 1} />
                  ))}
                </div>
              </SubSection>
            </Section>
          </div>

          {/* Footer */}
          <div style={{ borderTop: "1px solid var(--doc-border)", paddingTop: 20, marginTop: 48, display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, fontSize: 11, color: "var(--doc-text-faint)" }}>
            <span>Fintella Partner Portal &mdash; Webhook Integration Guide</span>
            <span>Last updated: May 29, 2026</span>
          </div>
            </div> {/* end main content column */}
          </div>   {/* end flex row */}
        </div>
      </div>
    </>
  );
}
