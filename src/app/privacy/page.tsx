import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy · Fintella",
  description: "Fintella Partner Portal privacy policy",
};

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
    --doc-info-bg: #fdf6e3;
    --doc-info-border: #c4a050;
    --doc-gold: #c4a050;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --doc-bg: #060a18;
      --doc-text: rgba(255,255,255,0.9);
      --doc-text-secondary: rgba(255,255,255,0.7);
      --doc-text-muted: rgba(255,255,255,0.5);
      --doc-text-faint: rgba(255,255,255,0.25);
      --doc-border: rgba(255,255,255,0.08);
      --doc-border-subtle: rgba(255,255,255,0.06);
      --doc-card-bg: rgba(255,255,255,0.03);
      --doc-info-bg: rgba(196,160,80,0.08);
      --doc-info-border: #c4a050;
      --doc-gold: #c4a050;
    }
  }
  .legal-body h2 {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: clamp(20px, 3.5vw, 24px);
    font-weight: 700;
    color: var(--doc-text);
    margin: 36px 0 12px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .legal-body h2::before {
    content: '';
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--doc-gold);
    flex-shrink: 0;
  }
  .legal-body h3 {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 16px;
    font-weight: 600;
    color: var(--doc-text);
    margin: 20px 0 8px;
  }
  .legal-body p, .legal-body li {
    font-size: 15px;
    line-height: 1.7;
    color: var(--doc-text-secondary);
  }
  .legal-body p {
    margin: 0 0 12px;
  }
  .legal-body ul {
    margin: 0 0 16px;
    padding-left: 22px;
  }
  .legal-body li {
    margin-bottom: 6px;
  }
  .legal-body strong {
    color: var(--doc-text);
    font-weight: 600;
  }
  .legal-body a {
    color: var(--doc-gold);
    text-decoration: none;
    border-bottom: 1px solid rgba(196,160,80,0.4);
  }
  .legal-body a:hover {
    border-bottom-color: var(--doc-gold);
  }
  .legal-callout {
    background: var(--doc-info-bg);
    border-left: 4px solid var(--doc-info-border);
    border-radius: 0 8px 8px 0;
    padding: 16px 20px;
    margin: 16px 0;
  }
  .legal-callout p {
    margin: 0;
    font-size: 14px;
    color: var(--doc-text-secondary);
  }
`;

export default function PrivacyPolicyPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: themeCSS }} />
      <div
        style={{
          minHeight: "100vh",
          background: "var(--doc-bg)",
          color: "var(--doc-text)",
          fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          lineHeight: 1.65,
        }}
      >
        <div
          style={{
            maxWidth: 800,
            margin: "0 auto",
            padding: "clamp(24px, 5vw, 48px) clamp(16px, 4vw, 24px) 60px",
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <Link
              href="https://fintella.partners"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                color: "var(--doc-text-muted)",
                textDecoration: "none",
                marginBottom: 24,
              }}
            >
              ← Back to fintella.partners
            </Link>
            <div
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 28,
                fontWeight: 700,
                color: "var(--doc-gold)",
                letterSpacing: 2,
                marginBottom: 2,
              }}
            >
              FINTELLA
            </div>
            <div style={{ fontSize: 13, color: "var(--doc-text-muted)", marginBottom: 24 }}>
              Financial Intelligence Network
            </div>
            <h1
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: "clamp(28px, 5vw, 36px)",
                fontWeight: 700,
                color: "var(--doc-text)",
                margin: "0 0 8px",
              }}
            >
              Privacy Policy
            </h1>
            <div style={{ fontSize: 13, color: "var(--doc-text-muted)" }}>Last updated: April 15, 2026</div>
            <div style={{ height: 2, width: 80, background: "var(--doc-gold)", borderRadius: 2, marginTop: 16 }} />
          </div>

          <div className="legal-body">
            <p>
              This Privacy Policy describes how Financial Intelligence Network DBA (Fintella), a DBA of Annexation PR LLC
              (&quot;Fintella,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), collects, uses, and shares
              information about you when you use the Fintella Partner Portal and related services (the
              &quot;Service&quot;).
            </p>

            <h2>1. Information We Collect</h2>
            <p>When you register as a partner and use the Fintella Partner Portal, we collect the following categories of information:</p>
            <h3>Personal Information</h3>
            <ul>
              <li>Name (first and last)</li>
              <li>Email address</li>
              <li>Phone number (mobile)</li>
              <li>Company name</li>
              <li>Mailing address</li>
              <li>Taxpayer Identification Number (TIN or SSN) for commission reporting</li>
              <li>Bank account or payment method details used for commission payouts</li>
            </ul>
            <h3>Usage Data</h3>
            <ul>
              <li>Portal pages visited, features used, and actions taken</li>
              <li>IP address, browser type, device type, and operating system</li>
              <li>Log data including timestamps and error reports</li>
            </ul>
            <h3>Cookies and Similar Technologies</h3>
            <p>
              We use session cookies to keep you signed in and analytics cookies to understand how the portal is used.
              See the <strong>Cookies</strong> section below for details.
            </p>

            <h2>2. How We Use Your Information</h2>
            <p>We use the information we collect for the following purposes:</p>
            <ul>
              <li><strong>Account management</strong> — creating and maintaining your partner account, authenticating you, and providing portal access</li>
              <li><strong>Notifications</strong> — sending you transactional email and, if you opt in, SMS text messages about account activity, deal status, agreements, and commission payouts</li>
              <li><strong>Commission tracking</strong> — calculating, attributing, and paying commissions owed to you under your partnership agreement</li>
              <li><strong>Support</strong> — responding to your questions, support tickets, and feature requests</li>
              <li><strong>Compliance</strong> — meeting tax reporting, anti-fraud, and legal obligations</li>
              <li><strong>Service improvement</strong> — monitoring performance, diagnosing errors, and improving the portal experience</li>
            </ul>

            <h2>3. SMS / Text Messaging</h2>
            <div className="legal-callout">
              <p>
                <strong>By opting in to SMS notifications during account registration, you consent to receive
                transactional text messages about your account activity, deal status updates, and commission payment
                alerts.</strong>
              </p>
            </div>
            <p>Our SMS program is operated on the following basis:</p>
            <ul>
              <li><strong>Program name:</strong> Fintella Partner Notifications</li>
              <li><strong>Message frequency varies</strong> based on your account activity (e.g. new deal created, deal stage change, commission earned or paid, agreement status updates).</li>
              <li><strong>Message and data rates may apply.</strong> Your mobile carrier may charge standard message and data fees.</li>
              <li><strong>Text STOP</strong> to any message to unsubscribe from SMS notifications at any time. Text <strong>HELP</strong> for help, or contact us at the email below.</li>
              <li><strong>SMS opt-in consent is never shared with third parties or affiliates for marketing purposes.</strong> Mobile phone numbers collected for SMS are used solely to deliver the transactional messages you requested.</li>
              <li><strong>SMS opt-in is optional and is not a condition of registration</strong> or of receiving any Fintella service. You can still create and use a partner account without opting in to SMS.</li>
              <li>Compatible carriers include AT&amp;T, T-Mobile, Verizon, Sprint, Boost, U.S. Cellular, and others. Carriers are not liable for delayed or undelivered messages.</li>
            </ul>

            <h2>4. How We Share Your Information</h2>
            <p><strong>We do not sell your personal information.</strong> We share information only in the following limited circumstances:</p>
            <ul>
              <li><strong>Service providers</strong> — we share information with trusted vendors who help us operate the portal, including Twilio (SMS and voice), SendGrid (transactional email), Vercel (hosting and analytics), Sentry (error monitoring), Neon (database hosting), SignWell (e-signature), and payment processors. These providers are contractually required to use your information only to provide services to Fintella.</li>
              <li><strong>Professional service firms</strong> — when you submit a client referral, we share the client&apos;s contact and qualification details with the professional service firm associated with the referral (e.g. law firm) so they can follow up on the lead.</li>
              <li><strong>Legal and safety</strong> — we may disclose information if required by law, subpoena, or court order, or to protect the rights, property, or safety of Fintella, our partners, or others.</li>
              <li><strong>Business transfers</strong> — in the event of a merger, acquisition, or sale of assets, information may be transferred as part of that transaction, subject to continuing privacy protections.</li>
            </ul>

            <h2>5. Data Security</h2>
            <p>We use industry-standard safeguards to protect your information, including:</p>
            <ul>
              <li><strong>Encryption in transit</strong> — all connections to the portal use TLS (HTTPS).</li>
              <li><strong>Encryption at rest</strong> — sensitive data is encrypted in our database provider.</li>
              <li><strong>Access controls</strong> — role-based access, unique credentials, and audit logging for administrative actions.</li>
              <li><strong>Secret management</strong> — API keys and secrets are stored in encrypted environment variables.</li>
            </ul>
            <p>No system is perfectly secure. If you believe your account has been compromised, contact us immediately.</p>

            <h2>6. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the following rights with respect to your personal information:</p>
            <ul>
              <li><strong>Access</strong> — request a copy of the information we hold about you.</li>
              <li><strong>Correction</strong> — update or correct inaccurate information. Most account fields can be edited directly in your portal settings.</li>
              <li><strong>Deletion</strong> — request deletion of your account and associated data, subject to legal retention requirements (e.g. commission and tax records).</li>
              <li><strong>Opt-out of communications</strong> — unsubscribe from email marketing, or text STOP to end SMS notifications. Transactional messages essential to your account may still be sent.</li>
            </ul>
            <p>To exercise any of these rights, email us at <a href="mailto:support@fintellaconsulting.com">support@fintellaconsulting.com</a>.</p>

            <h2>7. Cookies</h2>
            <p>We use two categories of cookies:</p>
            <ul>
              <li><strong>Session cookies</strong> — required for authentication. These keep you signed in and cannot be disabled without losing portal access.</li>
              <li><strong>Analytics cookies</strong> — Vercel Analytics collects anonymized usage data to help us understand which features are used most.</li>
            </ul>
            <p>You can clear cookies at any time in your browser settings. Doing so will sign you out of the portal.</p>

            <h2>8. Data Retention</h2>
            <p>
              We retain your information for as long as your partner account is active and for a reasonable period
              afterward to comply with legal obligations, resolve disputes, and enforce our agreements. Commission and
              tax records may be retained longer as required by applicable law. You can request deletion of your
              account at any time by emailing us, subject to these retention requirements.
            </p>

            <h2>9. Children&apos;s Privacy</h2>
            <p>
              The Fintella Partner Portal is not directed at children under 13, and we do not knowingly collect personal
              information from children. If you believe a child has provided us with personal information, contact us
              and we will delete it.
            </p>

            <h2>10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. When we make material changes, we will notify active
              partners by email and update the &quot;Last updated&quot; date at the top of this page. Your continued
              use of the portal after a change constitutes acceptance of the revised policy.
            </p>

            <h2>11. Contact Us</h2>
            <p>If you have questions about this Privacy Policy or our data practices, contact us at:</p>
            <div
              style={{
                background: "var(--doc-card-bg)",
                border: "1px solid var(--doc-border)",
                borderRadius: 12,
                padding: "20px 24px",
                marginTop: 12,
              }}
            >
              <p style={{ margin: 0 }}>
                <strong>Financial Intelligence Network DBA (Fintella)</strong>
                <br />
                A DBA of Annexation PR LLC
                <br />
                19111 Collins Ave #1804
                <br />
                Sunny Isles Beach, FL 33160
                <br />
                Email: <a href="mailto:support@fintellaconsulting.com">support@fintellaconsulting.com</a>
              </p>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              borderTop: "1px solid var(--doc-border)",
              paddingTop: 20,
              marginTop: 48,
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
              fontSize: 12,
              color: "var(--doc-text-faint)",
            }}
          >
            <span>
              <Link href="/terms" style={{ color: "var(--doc-text-muted)", textDecoration: "none" }}>
                Terms &amp; Conditions
              </Link>
              {" · "}
              <Link href="/privacy" style={{ color: "var(--doc-text-muted)", textDecoration: "none" }}>
                Privacy Policy
              </Link>
            </span>
            <span>&copy; 2026 Fintella</span>
          </div>
        </div>
      </div>
    </>
  );
}
