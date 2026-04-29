/**
 * SendGrid Email Address Validation API wrapper.
 * Uses the same SENDGRID_API_KEY. Demo-gated if unset.
 * Docs: https://www.twilio.com/docs/sendgrid/api-reference/email-address-validation/validate-an-email
 */

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";

export interface EmailValidationResult {
  email: string;
  verdict: "Valid" | "Risky" | "Invalid" | "unknown";
  score: number;
  hasValidMx: boolean;
  isDisposable: boolean;
  isCatchAll: boolean;
  demo: boolean;
}

export async function validateEmail(email: string): Promise<EmailValidationResult> {
  if (!SENDGRID_API_KEY) {
    return { email, verdict: "unknown", score: 0, hasValidMx: false, isDisposable: false, isCatchAll: false, demo: true };
  }

  try {
    const res = await fetch("https://api.sendgrid.com/v3/validations/email", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, source: "fintella_import" }),
    });

    if (!res.ok) {
      return { email, verdict: "unknown", score: 0, hasValidMx: false, isDisposable: false, isCatchAll: false, demo: false };
    }

    const data = await res.json();
    const r = data.result || {};
    return {
      email,
      verdict: r.verdict || "unknown",
      score: r.score ?? 0,
      hasValidMx: r.checks?.domain?.has_valid_address_syntax ?? false,
      isDisposable: r.checks?.additional?.is_disposable_address ?? false,
      isCatchAll: r.checks?.additional?.is_suspected_disposable_address ?? false,
      demo: false,
    };
  } catch {
    return { email, verdict: "unknown", score: 0, hasValidMx: false, isDisposable: false, isCatchAll: false, demo: false };
  }
}

export async function validateEmailBatch(emails: string[]): Promise<Map<string, EmailValidationResult>> {
  const results = new Map<string, EmailValidationResult>();
  for (const email of emails) {
    const result = await validateEmail(email);
    results.set(email, result);
  }
  return results;
}
