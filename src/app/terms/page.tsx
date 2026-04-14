import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms & Conditions · Fintella",
  description: "Fintella Partner Portal terms and conditions",
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

export default function TermsPage() {
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
              Terms &amp; Conditions
            </h1>
            <div style={{ fontSize: 13, color: "var(--doc-text-muted)" }}>Last updated: April 15, 2026</div>
            <div style={{ height: 2, width: 80, background: "var(--doc-gold)", borderRadius: 2, marginTop: 16 }} />
          </div>

          <div className="legal-body">
            <p>
              These Terms and Conditions (&quot;Terms&quot;) govern your access to and use of the Fintella Partner
              Portal and related services (the &quot;Service&quot;) operated by Financial Intelligence Network DBA
              (Fintella), a DBA of Annexation PR LLC (&quot;Fintella,&quot; &quot;we,&quot; &quot;us,&quot; or
              &quot;our&quot;).
            </p>

            <h2>1. Acceptance of Terms</h2>
            <p>
              By creating a partner account, accessing the portal, or submitting any referral through the Service, you
              agree to be bound by these Terms, our Privacy Policy, and any partnership agreement you have executed
              with Fintella. If you do not agree, do not use the Service.
            </p>

            <h2>2. Description of Service</h2>
            <p>
              Fintella operates a partner referral management platform that connects independent referral partners
              with professional service firms. The Service lets you submit client referrals, track deal status and
              stage, view earned and pending commissions, manage your downline (for recruiters), access training and
              support, and e-sign partnership agreements. The Service is provided on an &quot;as is&quot; and &quot;as
              available&quot; basis.
            </p>

            <h2>3. Account Registration</h2>
            <ul>
              <li><strong>Invite-only.</strong> Partner accounts are created by invitation from an existing Fintella partner or Fintella staff. You may not register without a valid invite.</li>
              <li><strong>Accurate information.</strong> You agree to provide accurate, current, and complete information during registration and to keep your account information up to date.</li>
              <li><strong>One account per person.</strong> You may hold only one active partner account at a time. Duplicate accounts may be merged or closed at our discretion.</li>
              <li><strong>Credentials.</strong> You are responsible for maintaining the confidentiality of your sign-in credentials and for any activity under your account.</li>
              <li><strong>Eligibility.</strong> You must be at least 18 years old and legally able to enter into binding contracts.</li>
            </ul>

            <h2>4. Partner Obligations</h2>
            <p>As a Fintella partner, you agree to:</p>
            <ul>
              <li>Submit only <strong>qualified referrals</strong> — clients who have a legitimate interest in the service you are referring and who have consented to being contacted.</li>
              <li>Maintain <strong>accurate profile and payout information</strong>, including your current mailing address, TIN, and bank details.</li>
              <li><strong>Comply with all applicable laws</strong>, including those governing marketing, solicitation, consumer privacy, telemarketing (TCPA), CAN-SPAM, and data protection.</li>
              <li>Not misrepresent your affiliation with Fintella or the professional service firms you refer to.</li>
              <li>Not engage in spam, deceptive practices, fraudulent referrals, or any activity that could harm Fintella&apos;s reputation or partners.</li>
              <li>Respect the confidentiality of any non-public information you receive through the portal.</li>
            </ul>

            <h2>5. Commission Structure</h2>
            <p>
              Commissions are calculated in accordance with the partnership agreement you executed when joining
              Fintella. Key points:
            </p>
            <ul>
              <li>Commissions are <strong>only payable after the associated professional service firm has received payment from the end client</strong> <em>and</em> the firm has paid Fintella the corresponding override or fee.</li>
              <li>Commissions not yet earned are considered <strong>pending</strong> and may be adjusted, reversed, or canceled if a deal is lost, refunded, charged back, or otherwise reversed.</li>
              <li>Fintella <strong>reserves the right to audit</strong> any commission, referral, or partner activity and to withhold or claw back commissions paid in error, procured through fraud, or otherwise in violation of these Terms.</li>
              <li>Payouts are issued on our regular payout schedule. Delayed or failed payouts due to incomplete or incorrect banking or tax information are your responsibility.</li>
              <li>You are responsible for all taxes on commissions earned. Fintella will issue tax forms (e.g. 1099-NEC) as required by law.</li>
            </ul>

            <h2>6. SMS Communications</h2>
            <div className="legal-callout">
              <p>
                <strong>Program name:</strong> Fintella Partner Notifications. By opting in during registration, you
                consent to receive transactional text messages from Fintella about your partner account.
              </p>
            </div>
            <ul>
              <li><strong>Message frequency varies</strong> based on your account activity.</li>
              <li><strong>Message and data rates may apply.</strong> Your mobile carrier may charge standard message and data fees.</li>
              <li><strong>Carriers are not liable</strong> for delayed or undelivered messages.</li>
              <li>Text <strong>STOP</strong> to any Fintella SMS to unsubscribe.</li>
              <li>Text <strong>HELP</strong> or contact <a href="mailto:support@fintellaconsulting.com">support@fintellaconsulting.com</a> for help.</li>
              <li><strong>Compatible carriers</strong> include AT&amp;T, T-Mobile, Verizon, Sprint, Boost, U.S. Cellular, and others.</li>
              <li>SMS opt-in is optional and is not a condition of registration or of using the Service.</li>
              <li>For full details on how we handle SMS opt-in and phone data, see our <Link href="/privacy">Privacy Policy</Link>.</li>
            </ul>

            <h2>7. Intellectual Property</h2>
            <p>
              The Fintella name, brand, logos, portal software, documentation, training materials, and all related
              content are the proprietary property of Fintella and its licensors and are protected by copyright,
              trademark, and other intellectual property laws. You are granted a limited, non-exclusive, non-
              transferable license to access and use the Service for the purpose of performing your duties as a
              Fintella partner. You may not copy, modify, distribute, sell, reverse engineer, or create derivative
              works based on the Service or any of its content without our prior written consent.
            </p>

            <h2>8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, in no event shall Fintella, its parent Annexation PR
              LLC, or any of their officers, directors, employees, agents, or affiliates be liable for any indirect,
              incidental, special, consequential, or punitive damages, including lost profits, lost revenue, lost
              data, or business interruption, arising out of or in connection with your use of the Service, even if
              Fintella has been advised of the possibility of such damages. Fintella&apos;s total aggregate liability
              for any claim arising out of or related to the Service or these Terms shall not exceed the total
              commissions paid to you in the twelve (12) months preceding the claim, or one hundred U.S. dollars
              ($100), whichever is greater. The Service is provided on an &quot;as is&quot; and &quot;as
              available&quot; basis without warranties of any kind, express or implied.
            </p>

            <h2>9. Termination</h2>
            <ul>
              <li><strong>By you.</strong> You may terminate your partner relationship with Fintella at any time by emailing us at <a href="mailto:support@fintellaconsulting.com">support@fintellaconsulting.com</a>.</li>
              <li><strong>By Fintella.</strong> We may suspend or terminate your account at any time, with or without notice, for any reason, including violation of these Terms, fraud, or inactivity.</li>
              <li><strong>Effect of termination.</strong> Upon termination, your access to the portal will end. Commissions that have been fully earned prior to termination — meaning the associated client payment has been received by the firm <em>and</em> the firm has paid Fintella — will still be payable to you according to the normal payout schedule. Pending or unearned commissions are forfeited upon termination for cause.</li>
              <li>Sections that by their nature should survive termination (including Intellectual Property, Limitation of Liability, Governing Law, and these Terms generally) will survive.</li>
            </ul>

            <h2>10. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of the State of Florida, without
              regard to its conflict of laws principles. Any dispute arising out of or relating to these Terms or the
              Service shall be resolved exclusively in the state or federal courts located in Miami-Dade County,
              Florida, and you consent to the personal jurisdiction of such courts.
            </p>

            <h2>11. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. When we make material changes, we will notify active
              partners by email <strong>at least 30 days in advance</strong> of the effective date. Your continued use
              of the Service after the effective date constitutes acceptance of the revised Terms. If you do not agree
              to the revised Terms, you must stop using the Service before the effective date.
            </p>

            <h2>12. Contact</h2>
            <p>Questions about these Terms can be directed to:</p>
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
