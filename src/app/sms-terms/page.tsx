import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SMS Terms & Conditions — Fintella Partner Portal",
  description: "SMS messaging terms, opt-in consent, and opt-out instructions for Fintella partner notifications.",
  robots: { index: true, follow: true },
};

export default function SmsTermsPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--app-bg)", color: "var(--app-text)" }}>
      <nav className="border-b" style={{ borderColor: "var(--app-border)" }}>
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-xl" style={{ color: "var(--brand-gold, #c4a050)" }}>Fintella</Link>
          <Link href="/login" className="text-sm" style={{ color: "var(--app-text-muted)" }}>Partner Login</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="font-display text-3xl font-bold mb-2">SMS Terms &amp; Conditions</h1>
        <p className="text-sm mb-8" style={{ color: "var(--app-text-muted)" }}>Last updated: April 28, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed" style={{ color: "var(--app-text-secondary, #94a3b8)" }}>

          <section>
            <h2 className="font-display text-lg font-bold mb-3" style={{ color: "var(--app-text)" }}>1. Program Overview</h2>
            <p>
              Fintella Partners (&quot;Fintella,&quot; operated by Annexation PR LLC) offers an SMS notification service to keep partners informed about their account activity, deal status updates, commission payment alerts, agreement reminders, and other partner program communications.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold mb-3" style={{ color: "var(--app-text)" }}>2. Consent &amp; Opt-In</h2>
            <p className="mb-3">
              Partners provide explicit SMS opt-in consent through a mandatory checkbox during account registration at{" "}
              <strong style={{ color: "var(--app-text)" }}>https://fintella.partners/getstarted</strong>. The checkbox text states:
            </p>
            <div className="p-4 rounded-lg border mb-3" style={{ background: "var(--app-card-bg, #0c1220)", borderColor: "var(--app-border)" }}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0" style={{ borderColor: "var(--brand-gold, #c4a050)" }}>
                  <svg className="w-3 h-3" style={{ color: "var(--brand-gold, #c4a050)" }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-sm" style={{ color: "var(--app-text)" }}>
                  &quot;I agree to receive SMS notifications about my account activity, deal status updates, and commission payment alerts. Message frequency varies. Message and data rates may apply. Reply STOP to cancel at any time.&quot;
                </p>
              </div>
            </div>
            <p>
              This checkbox must be selected before the registration form can be submitted. Consent is not a condition of purchase or partnership — partners may opt out at any time without affecting their partnership status.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold mb-3" style={{ color: "var(--app-text)" }}>3. Message Types &amp; Frequency</h2>
            <p className="mb-3">You may receive SMS messages for the following purposes:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Account activation and welcome messages</li>
              <li>Partnership agreement status updates</li>
              <li>Deal status change notifications</li>
              <li>Commission payment alerts</li>
              <li>Onboarding reminders</li>
              <li>Scheduled call reminders (Live Weekly)</li>
              <li>Security alerts (password reset, login notifications)</li>
            </ul>
            <p className="mt-3">
              <strong style={{ color: "var(--app-text)" }}>Message frequency varies</strong> based on your account activity. Typical partners receive 2-8 messages per month. Message and data rates may apply depending on your mobile carrier and plan.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold mb-3" style={{ color: "var(--app-text)" }}>4. How to Opt Out</h2>
            <p className="mb-3">You can opt out of SMS messages at any time using any of these methods:</p>
            <div className="p-4 rounded-lg border mb-3" style={{ background: "var(--app-card-bg, #0c1220)", borderColor: "var(--app-border)" }}>
              <p className="font-semibold mb-2" style={{ color: "var(--app-text)" }}>Text any of these keywords to our number:</p>
              <div className="flex flex-wrap gap-2">
                {["STOP", "STOPALL", "CANCEL", "END", "QUIT", "UNSUBSCRIBE", "REVOKE", "OPTOUT"].map((kw) => (
                  <span key={kw} className="px-3 py-1 rounded-full text-xs font-semibold border" style={{ borderColor: "var(--app-border)", color: "var(--app-text)" }}>{kw}</span>
                ))}
              </div>
            </div>
            <p className="mb-3">
              <strong style={{ color: "var(--app-text)" }}>Via your account settings:</strong> Log in at{" "}
              <strong>https://fintella.partners/dashboard/settings</strong> and toggle off SMS notifications in the Communication Preferences section.
            </p>
            <p>
              After opting out, you will receive a final confirmation message: &quot;You have successfully been unsubscribed. You will not receive any more messages from this number. Reply START to resubscribe.&quot;
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold mb-3" style={{ color: "var(--app-text)" }}>5. How to Opt Back In</h2>
            <p>
              To re-subscribe after opting out, text any of the following keywords to our number:
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {["START", "YES", "UNSTOP"].map((kw) => (
                <span key={kw} className="px-3 py-1 rounded-full text-xs font-semibold border" style={{ borderColor: "var(--app-border)", color: "var(--app-text)" }}>{kw}</span>
              ))}
            </div>
            <p className="mt-3">
              You can also re-enable SMS from your account settings at{" "}
              <strong>https://fintella.partners/dashboard/settings</strong>.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold mb-3" style={{ color: "var(--app-text)" }}>6. Help</h2>
            <p>
              For help with SMS messaging, text <strong style={{ color: "var(--app-text)" }}>HELP</strong> or <strong style={{ color: "var(--app-text)" }}>INFO</strong> to our number. You will receive: &quot;Reply STOP to unsubscribe. Msg&amp;Data Rates May Apply.&quot;
            </p>
            <p className="mt-2">
              You can also contact us directly at <strong style={{ color: "var(--app-text)" }}>support@fintellaconsulting.com</strong> or call <strong style={{ color: "var(--app-text)" }}>(410) 497-5947</strong>.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold mb-3" style={{ color: "var(--app-text)" }}>7. Carriers &amp; Liability</h2>
            <p>
              Supported carriers include but are not limited to AT&amp;T, Verizon, T-Mobile, Sprint, U.S. Cellular, and other major US carriers. Carriers are not liable for delayed or undelivered messages. Message delivery is subject to effective transmission from your network.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold mb-3" style={{ color: "var(--app-text)" }}>8. Privacy</h2>
            <p>
              We respect your privacy. Your phone number and messaging data are handled in accordance with our{" "}
              <Link href="/privacy" className="underline" style={{ color: "var(--brand-gold, #c4a050)" }}>Privacy Policy</Link>. We do not sell, rent, or share your phone number with third parties for marketing purposes. Your phone number is used solely for the partner program communications described above.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold mb-3" style={{ color: "var(--app-text)" }}>9. Contact Information</h2>
            <div className="p-4 rounded-lg border" style={{ background: "var(--app-card-bg, #0c1220)", borderColor: "var(--app-border)" }}>
              <p style={{ color: "var(--app-text)" }}><strong>Fintella — Financial Intelligence Network</strong></p>
              <p>Operated by Annexation PR LLC</p>
              <p>111 2nd Ave NE, Suite 1250</p>
              <p>St. Petersburg, FL 33701</p>
              <p className="mt-2">Email: support@fintellaconsulting.com</p>
              <p>Phone: (410) 497-5947</p>
              <p className="mt-2">
                <Link href="/privacy" className="underline mr-4" style={{ color: "var(--brand-gold, #c4a050)" }}>Privacy Policy</Link>
                <Link href="/terms" className="underline" style={{ color: "var(--brand-gold, #c4a050)" }}>Terms &amp; Conditions</Link>
              </p>
            </div>
          </section>

        </div>
      </div>

      <footer className="border-t py-6" style={{ borderColor: "var(--app-border)" }}>
        <div className="max-w-3xl mx-auto px-6 text-center text-xs" style={{ color: "var(--app-text-faint, #64748b)" }}>
          <p>&copy; {new Date().getFullYear()} Fintella &mdash; Financial Intelligence Network. All rights reserved.</p>
          <div className="mt-2 flex justify-center gap-4">
            <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
            <Link href="/terms" className="hover:underline">Terms</Link>
            <Link href="/sms-terms" className="hover:underline font-semibold">SMS Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
