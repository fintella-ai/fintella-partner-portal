"use client";

import { useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function KwongIntakeInner() {
  return <KwongIntakeForm />;
}

export default function KwongIntakePage() {
  return (
    <Suspense fallback={<div style={{ background: "#f4f6f9", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p>Loading...</p></div>}>
      <KwongIntakeInner />
    </Suspense>
  );
}

/* =====================================================================
   ENTITY TYPE → TITLE MAPPING (from build spec §5.1)
   ===================================================================== */
const ENTITY_TYPES = [
  "Sole Proprietorship",
  "General Partnership",
  "LLC (disregarded)",
  "LLC (partnership-taxed)",
  "LLC (corp-taxed)",
  "S Corporation",
  "C Corporation",
  "Limited Partnership (LP)",
  "Nonprofit Corporation",
  "Professional Corporation (PC)",
] as const;

const TITLE_MAP: Record<string, string[]> = {
  "Sole Proprietorship": ["Owner", "Sole Proprietor"],
  "General Partnership": ["Partner", "General Partner", "Partnership Representative (PR — BBA matters)"],
  "LLC (disregarded)": ["Owner", "Sole Member"],
  "LLC (partnership-taxed)": ["Member-Manager", "Managing Member", "Manager", "Partnership Representative (PR — BBA matters)"],
  "LLC (corp-taxed)": ["President", "CEO", "CFO", "Treasurer", "Secretary"],
  "S Corporation": ["President", "Vice President", "CEO", "CFO", "Treasurer", "Secretary"],
  "C Corporation": ["President", "Vice President", "CEO", "CFO", "Treasurer", "Secretary"],
  "Limited Partnership (LP)": ["General Partner", "Partnership Representative (PR — BBA matters)"],
  "Nonprofit Corporation": ["President", "Executive Director", "Treasurer", "Secretary"],
  "Professional Corporation (PC)": ["President", "Vice President", "CEO", "CFO", "Treasurer", "Secretary"],
};

/* =====================================================================
   FORMATTERS
   ===================================================================== */
function fmtSSN(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 9);
  if (d.length > 5) return d.slice(0, 3) + "-" + d.slice(3, 5) + "-" + d.slice(5);
  if (d.length > 3) return d.slice(0, 3) + "-" + d.slice(3);
  return d;
}
function fmtEIN(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 9);
  if (d.length > 2) return d.slice(0, 2) + "-" + d.slice(2);
  return d;
}
function fmtPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 10);
  if (d.length > 6) return "(" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6);
  if (d.length > 3) return "(" + d.slice(0, 3) + ") " + d.slice(3);
  if (d.length > 0) return "(" + d;
  return d;
}

/* =====================================================================
   VALIDATORS
   ===================================================================== */
function validSSN(v: string): boolean {
  if (!/^\d{3}-\d{2}-\d{4}$/.test(v)) return false;
  const d = v.replace(/-/g, "");
  const area = d.slice(0, 3);
  if (area === "000" || area === "666" || +area >= 900) return false;
  if (d.slice(3, 5) === "00") return false;
  if (d.slice(5) === "0000") return false;
  if (/^(\d)\1{8}$/.test(d)) return false;
  if (["078051120", "219099999", "457555462", "123456789"].includes(d)) return false;
  return true;
}
function validEIN(v: string): boolean { return /^\d{2}-\d{7}$/.test(v); }
function validEmail(v: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function validPhone(v: string): boolean { return v.replace(/\D/g, "").length === 10; }
function validState(v: string): boolean { return /^[A-Za-z]{2}$/.test(v); }
function validZIP(v: string): boolean { return /^\d{5}(-\d{4})?$/.test(v); }

/* =====================================================================
   STYLES (CSS-in-JS matching the original HTML)
   ===================================================================== */
const S = {
  bg: "#f4f6f9",
  card: "#ffffff",
  ink: "#1d2733",
  muted: "#5b6876",
  line: "#d8dee6",
  accent: "#01696f",
  accentDark: "#014b50",
  ok: "#1f9d57",
  err: "#c8362f",
  errBg: "#fdecea",
  radius: "12px",
};

interface FieldState {
  [key: string]: string;
}

function KwongIntakeForm() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref") || searchParams.get("utm_content") || "";

  const [filerType, setFilerType] = useState<"" | "Business" | "Individual">("");
  const [filingStatus, setFilingStatus] = useState<"" | "Filed jointly" | "Filed as an individual">("");
  const [entityType, setEntityType] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [fields, setFields] = useState<FieldState>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ssnVisible, setSsnVisible] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [signingUrl, setSigningUrl] = useState("");
  const [submitError, setSubmitError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const setField = useCallback((key: string, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const f = (key: string) => fields[key] || "";

  function validate(): { ok: boolean; firstBad: string | null } {
    const errs: Record<string, string> = {};
    let firstBad: string | null = null;
    function fail(key: string, msg: string) {
      errs[key] = msg;
      if (!firstBad) firstBad = key;
    }

    if (!filerType) fail("filer_type", "Please choose one.");

    if (filerType === "Individual") {
      if (!f("individual_legal_name").trim()) fail("individual_legal_name", "This field is required.");
      if (!f("individual_address_street").trim()) fail("individual_address_street", "Enter the street address.");
      if (!f("individual_address_city").trim()) fail("individual_address_city", "Enter the city.");
      if (!validState(f("individual_address_state").trim())) fail("individual_address_state", "2-letter state.");
      if (!validZIP(f("individual_address_zip").trim())) fail("individual_address_zip", "Enter a valid ZIP (5 or 9 digits).");
      if (!validSSN(f("individual_ssn").trim())) {
        fail("individual_ssn", /^\d{3}-\d{2}-\d{4}$/.test(f("individual_ssn").trim())
          ? "That doesn't look like a valid Social Security Number — please re-check it."
          : "Enter a complete 9-digit SSN in the format XXX-XX-XXXX.");
      }
      if (!filingStatus) fail("filing_status", "Please choose one.");

      if (filingStatus === "Filed jointly") {
        if (!f("spouse_legal_name").trim()) fail("spouse_legal_name", "This field is required.");
        if (!f("spouse_address_street").trim()) fail("spouse_address_street", "Enter the street address.");
        if (!f("spouse_address_city").trim()) fail("spouse_address_city", "Enter the city.");
        if (!validState(f("spouse_address_state").trim())) fail("spouse_address_state", "2-letter state.");
        if (!validZIP(f("spouse_address_zip").trim())) fail("spouse_address_zip", "Enter a valid ZIP (5 or 9 digits).");
        if (!validSSN(f("spouse_ssn").trim())) {
          fail("spouse_ssn", /^\d{3}-\d{2}-\d{4}$/.test(f("spouse_ssn").trim())
            ? "That doesn't look like a valid Social Security Number — please re-check it."
            : "Enter a complete 9-digit SSN in the format XXX-XX-XXXX.");
        }
      }
    }

    if (filerType === "Business") {
      if (!f("business_legal_name").trim()) fail("business_legal_name", "This field is required.");
      if (!f("owner_name").trim()) fail("owner_name", "This field is required.");
      if (!entityType) fail("entity_type", "Please choose one.");
      if (entityType && !signerTitle) fail("signer_title", "Please select a title.");
      if (!validEIN(f("business_ein").trim())) fail("business_ein", "Enter a valid 9-digit EIN.");
      if (!f("business_address_street").trim()) fail("business_address_street", "Enter the street address.");
      if (!f("business_address_city").trim()) fail("business_address_city", "Enter the city.");
      if (!validState(f("business_address_state").trim())) fail("business_address_state", "2-letter state.");
      if (!validZIP(f("business_address_zip").trim())) fail("business_address_zip", "Enter a valid ZIP (5 or 9 digits).");
    }

    const mob = f("mobile_phone").trim();
    const biz = f("business_phone").trim();
    const mobOk = mob === "" || validPhone(mob);
    const bizOk = biz === "" || validPhone(biz);
    const haveOne = (mob !== "" && validPhone(mob)) || (biz !== "" && validPhone(biz));
    if (!haveOne || !mobOk || !bizOk) fail("phone", "Enter at least one valid phone number.");
    if (!validEmail(f("email").trim())) fail("email", "Enter a valid email address.");

    setErrors(errs);
    return { ok: Object.keys(errs).length === 0, firstBad };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = validate();
    if (!res.ok) {
      if (res.firstBad) {
        document.getElementById(res.firstBad)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    const isIndividual = filerType === "Individual";
    const isBusiness = filerType === "Business";
    const isJoint = isIndividual && filingStatus === "Filed jointly";

    const body: Record<string, any> = {
      ref,
      filer_type: filerType,
      // Individual fields
      individual_legal_name: isIndividual ? f("individual_legal_name").trim() : "",
      individual_address_street: isIndividual ? f("individual_address_street").trim() : "",
      individual_address_city: isIndividual ? f("individual_address_city").trim() : "",
      individual_address_state: isIndividual ? f("individual_address_state").trim().toUpperCase() : "",
      individual_address_zip: isIndividual ? f("individual_address_zip").trim() : "",
      individual_ssn: isIndividual ? f("individual_ssn").trim() : "",
      filing_status: isIndividual ? filingStatus : "",
      // Spouse fields (joint only)
      spouse_legal_name: isJoint ? f("spouse_legal_name").trim() : "",
      spouse_address_street: isJoint ? f("spouse_address_street").trim() : "",
      spouse_address_city: isJoint ? f("spouse_address_city").trim() : "",
      spouse_address_state: isJoint ? f("spouse_address_state").trim().toUpperCase() : "",
      spouse_address_zip: isJoint ? f("spouse_address_zip").trim() : "",
      spouse_ssn: isJoint ? f("spouse_ssn").trim() : "",
      // Business fields
      business_legal_name: isBusiness ? f("business_legal_name").trim() : "",
      owner_name: isBusiness ? f("owner_name").trim() : "",
      entity_type: isBusiness ? entityType : "",
      signer_title: isBusiness ? signerTitle : "",
      business_ein: isBusiness ? f("business_ein").trim() : "",
      business_address_street: isBusiness ? f("business_address_street").trim() : "",
      business_address_city: isBusiness ? f("business_address_city").trim() : "",
      business_address_state: isBusiness ? f("business_address_state").trim().toUpperCase() : "",
      business_address_zip: isBusiness ? f("business_address_zip").trim() : "",
      // Contact
      mobile_phone: f("mobile_phone").trim(),
      business_phone: f("business_phone").trim(),
      email: f("email").trim(),
    };

    try {
      const response = await fetch("/api/kwong-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Submission failed (${response.status})`);
      }
      const data = await response.json();
      const url = data.signingUrl || "";
      setSigningUrl(url);
      if (url) {
        setSubmitting(false);
        window.location.href = url;
        return;
      }
      setSubmitted(true);
    } catch (err: any) {
      setSubmitError(err.message || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success Screen (fallback — normally auto-redirects to SignWell) ──
  if (submitted) {
    return (
      <div style={{ background: S.bg, minHeight: "100vh" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 18px 80px" }}>
          <div style={{ background: S.card, border: `1px solid ${S.line}`, borderRadius: S.radius, padding: 24, textAlign: "center" }}>
            <div style={{ width: 62, height: 62, borderRadius: "50%", background: S.ok, color: "#fff", fontSize: 34, lineHeight: "62px", textAlign: "center", margin: "0 auto 14px" }}>&#10003;</div>
            <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>Thank You!</h2>
            <p style={{ color: S.muted, margin: "0 0 22px" }}>
              Your intake form has been submitted successfully. Our team will follow up within 24 hours.
            </p>
            {signingUrl && (
              <a
                href={signingUrl}
                style={{
                  display: "inline-block", width: "100%", maxWidth: 400,
                  padding: "15px 20px", fontSize: 17, fontWeight: 700,
                  color: "#fff", background: S.accent, border: "none",
                  borderRadius: 10, cursor: "pointer", textDecoration: "none",
                  textAlign: "center",
                }}
              >
                Sign Data Sharing Agreement &rarr;
              </a>
            )}
            <p style={{ color: S.muted, fontSize: 13, marginTop: 16 }}>
              Nothing is filed with the IRS automatically. You will receive a confirmation email.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ──
  return (
    <div style={{ background: S.bg, minHeight: "100vh", color: S.ink, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif', fontSize: 17, lineHeight: 1.55 }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 18px 80px" }}>

        <header style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, margin: "0 0 6px" }}>Fintella Client Intake Form</h1>
          <p style={{ color: S.muted, margin: 0, fontSize: 15 }}>Please answer the questions below. It only takes a few minutes.</p>
        </header>

        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", color: S.muted, fontSize: 13, marginBottom: 22 }}>
          <span>&#128274;</span>
          <span>Your information is private. Only complete this form on a secure (https) connection.</span>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} noValidate autoComplete="off">

          {/* ── Step 1: Filer Type ── */}
          <Card>
            <StepTag>Step 1</StepTag>
            <h2 style={{ fontSize: 19, margin: "0 0 4px" }}>Are you a business or an individual?</h2>
            <p style={{ color: S.muted, fontSize: 14, margin: "0 0 18px" }}>This tells us which questions to ask. Pick one.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(["Business", "Individual"] as const).map((opt) => (
                <OptionCard key={opt} selected={filerType === opt} onClick={() => { setFilerType(opt); setErrors((p) => { const n = { ...p }; delete n.filer_type; return n; }); }}>
                  <span>{opt}</span>
                </OptionCard>
              ))}
            </div>
            <ErrMsg msg={errors.filer_type} />
          </Card>

          {/* ── Step 2: Individual Path ── */}
          {filerType === "Individual" && (
            <Card>
              <StepTag>Step 2</StepTag>
              <h2 style={{ fontSize: 19, margin: "0 0 4px" }}>About you</h2>
              <p style={{ color: S.muted, fontSize: 14, margin: "0 0 18px" }}>A few details so we can match you to your tax records.</p>

              <Field label="Your full legal name" required hint="Exactly as it appears on your most recent IRS filings.">
                <TextInput id="individual_legal_name" value={f("individual_legal_name")} onChange={(v) => setField("individual_legal_name", v)} error={!!errors.individual_legal_name} />
                <ErrMsg msg={errors.individual_legal_name} />
              </Field>

              <Field label="Your mailing address" required hint="The address the IRS has on file for you. Used on Form 2848 and Form 843.">
                <TextInput id="individual_address_street" value={f("individual_address_street")} onChange={(v) => setField("individual_address_street", v)} placeholder="Street address" error={!!errors.individual_address_street} />
                <ErrMsg msg={errors.individual_address_street} />
                <TextInput id="individual_address_city" value={f("individual_address_city")} onChange={(v) => setField("individual_address_city", v)} placeholder="City" error={!!errors.individual_address_city} style={{ marginTop: 8 }} />
                <ErrMsg msg={errors.individual_address_city} />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <div style={{ flex: "0 0 110px" }}>
                    <TextInput id="individual_address_state" value={f("individual_address_state")} onChange={(v) => setField("individual_address_state", v.toUpperCase())} placeholder="State" maxLength={2} error={!!errors.individual_address_state} style={{ textTransform: "uppercase" }} />
                    <ErrMsg msg={errors.individual_address_state} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <TextInput id="individual_address_zip" value={f("individual_address_zip")} onChange={(v) => setField("individual_address_zip", v)} placeholder="ZIP" maxLength={10} inputMode="numeric" error={!!errors.individual_address_zip} />
                    <ErrMsg msg={errors.individual_address_zip} />
                  </div>
                </div>
              </Field>

              <Field label="Your Social Security Number" required hint="Format: XXX-XX-XXXX">
                <SensitiveInput id="individual_ssn" value={f("individual_ssn")} onChange={(v) => setField("individual_ssn", fmtSSN(v))} placeholder="•••-••-••••" maxLength={11} error={!!errors.individual_ssn} visible={!!ssnVisible.individual_ssn} onToggle={() => setSsnVisible((p) => ({ ...p, individual_ssn: !p.individual_ssn }))} />
                <ErrMsg msg={errors.individual_ssn} />
              </Field>

              <Field label="Did you file jointly, or did you file as an individual?" required>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(["Filed jointly", "Filed as an individual"] as const).map((opt) => (
                    <OptionCard key={opt} selected={filingStatus === opt} onClick={() => { setFilingStatus(opt); setErrors((p) => { const n = { ...p }; delete n.filing_status; return n; }); }}>
                      <span>{opt}</span>
                    </OptionCard>
                  ))}
                </div>
                <ErrMsg msg={errors.filing_status} />
              </Field>

              {filingStatus === "Filed jointly" && (
                <>
                  <Field label="Spouse / joint filer's full legal name" required hint="Exactly as it appears to the IRS.">
                    <TextInput id="spouse_legal_name" value={f("spouse_legal_name")} onChange={(v) => setField("spouse_legal_name", v)} error={!!errors.spouse_legal_name} />
                    <ErrMsg msg={errors.spouse_legal_name} />
                  </Field>

                  <Field label="Spouse / joint filer's mailing address" required hint="The address the IRS has on file for your spouse. If it is the same as yours, please re-enter it here.">
                    <TextInput id="spouse_address_street" value={f("spouse_address_street")} onChange={(v) => setField("spouse_address_street", v)} placeholder="Street address" error={!!errors.spouse_address_street} />
                    <ErrMsg msg={errors.spouse_address_street} />
                    <TextInput id="spouse_address_city" value={f("spouse_address_city")} onChange={(v) => setField("spouse_address_city", v)} placeholder="City" error={!!errors.spouse_address_city} style={{ marginTop: 8 }} />
                    <ErrMsg msg={errors.spouse_address_city} />
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <div style={{ flex: "0 0 110px" }}>
                        <TextInput id="spouse_address_state" value={f("spouse_address_state")} onChange={(v) => setField("spouse_address_state", v.toUpperCase())} placeholder="State" maxLength={2} error={!!errors.spouse_address_state} style={{ textTransform: "uppercase" }} />
                        <ErrMsg msg={errors.spouse_address_state} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <TextInput id="spouse_address_zip" value={f("spouse_address_zip")} onChange={(v) => setField("spouse_address_zip", v)} placeholder="ZIP" maxLength={10} inputMode="numeric" error={!!errors.spouse_address_zip} />
                        <ErrMsg msg={errors.spouse_address_zip} />
                      </div>
                    </div>
                  </Field>

                  <Field label="Spouse / joint filer's Social Security Number" required hint="Format: XXX-XX-XXXX">
                    <SensitiveInput id="spouse_ssn" value={f("spouse_ssn")} onChange={(v) => setField("spouse_ssn", fmtSSN(v))} placeholder="•••-••-••••" maxLength={11} error={!!errors.spouse_ssn} visible={!!ssnVisible.spouse_ssn} onToggle={() => setSsnVisible((p) => ({ ...p, spouse_ssn: !p.spouse_ssn }))} />
                    <ErrMsg msg={errors.spouse_ssn} />
                  </Field>
                </>
              )}
            </Card>
          )}

          {/* ── Step 2: Business Path ── */}
          {filerType === "Business" && (
            <Card>
              <StepTag>Step 2</StepTag>
              <h2 style={{ fontSize: 19, margin: "0 0 4px" }}>About the business</h2>
              <p style={{ color: S.muted, fontSize: 14, margin: "0 0 18px" }}>Tell us about the company and who is signing.</p>

              <Field label="Full legal business name" required hint="Exactly as it appears before the IRS, including any DBAs.">
                <textarea
                  id="business_legal_name"
                  value={f("business_legal_name")}
                  onChange={(e) => setField("business_legal_name", e.target.value)}
                  rows={2}
                  style={{ ...inputStyle, ...(errors.business_legal_name ? invalidStyle : {}), resize: "vertical", minHeight: 54 }}
                />
                <ErrMsg msg={errors.business_legal_name} />
              </Field>

              <Field label="Business mailing address" required hint="The address the IRS has on file for this entity. Used on Form 2848 and Form 843.">
                <TextInput id="business_address_street" value={f("business_address_street")} onChange={(v) => setField("business_address_street", v)} placeholder="Street address" error={!!errors.business_address_street} />
                <ErrMsg msg={errors.business_address_street} />
                <TextInput id="business_address_city" value={f("business_address_city")} onChange={(v) => setField("business_address_city", v)} placeholder="City" error={!!errors.business_address_city} style={{ marginTop: 8 }} />
                <ErrMsg msg={errors.business_address_city} />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <div style={{ flex: "0 0 110px" }}>
                    <TextInput id="business_address_state" value={f("business_address_state")} onChange={(v) => setField("business_address_state", v.toUpperCase())} placeholder="State" maxLength={2} error={!!errors.business_address_state} style={{ textTransform: "uppercase" }} />
                    <ErrMsg msg={errors.business_address_state} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <TextInput id="business_address_zip" value={f("business_address_zip")} onChange={(v) => setField("business_address_zip", v)} placeholder="ZIP" maxLength={10} inputMode="numeric" error={!!errors.business_address_zip} />
                    <ErrMsg msg={errors.business_address_zip} />
                  </div>
                </div>
              </Field>

              <Field label="EIN of the business" required hint="Format: XX-XXXXXXX">
                <SensitiveInput id="business_ein" value={f("business_ein")} onChange={(v) => setField("business_ein", fmtEIN(v))} placeholder="••-•••••••" maxLength={10} error={!!errors.business_ein} visible={!!ssnVisible.business_ein} onToggle={() => setSsnVisible((p) => ({ ...p, business_ein: !p.business_ein }))} />
                <ErrMsg msg={errors.business_ein} />
              </Field>

              <Field label="Full name of the individual who owns the company" required>
                <TextInput id="owner_name" value={f("owner_name")} onChange={(v) => setField("owner_name", v)} error={!!errors.owner_name} />
                <ErrMsg msg={errors.owner_name} />
              </Field>

              <Field label="What type of entity is the business?" required hint="Choose one.">
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {ENTITY_TYPES.map((et) => (
                    <OptionCard key={et} selected={entityType === et} onClick={() => { setEntityType(et); setSignerTitle(""); setErrors((p) => { const n = { ...p }; delete n.entity_type; return n; }); }}>
                      <span>{et}</span>
                    </OptionCard>
                  ))}
                </div>
                <ErrMsg msg={errors.entity_type} />
              </Field>

              {entityType && TITLE_MAP[entityType] && (
                <Field label="Title" required hint="Your role for signing on the entity's behalf.">
                  <select
                    id="signer_title"
                    value={signerTitle}
                    onChange={(e) => { setSignerTitle(e.target.value); setErrors((p) => { const n = { ...p }; delete n.signer_title; return n; }); }}
                    style={{ ...inputStyle, ...(errors.signer_title ? invalidStyle : {}) }}
                  >
                    <option value="">Select a title…</option>
                    {TITLE_MAP[entityType].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <ErrMsg msg={errors.signer_title} />
                </Field>
              )}
            </Card>
          )}

          {/* ── Step 3: Contact ── */}
          {filerType && (
            <Card>
              <StepTag>Step 3</StepTag>
              <h2 style={{ fontSize: 19, margin: "0 0 4px" }}>How can we reach you?</h2>
              <p style={{ color: S.muted, fontSize: 14, margin: "0 0 18px" }}>Enter at least one phone number, plus your email.</p>

              <div style={{ marginBottom: 20 }}>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Mobile number</label>
                  <TextInput id="mobile_phone" value={f("mobile_phone")} onChange={(v) => setField("mobile_phone", fmtPhone(v))} placeholder="(555) 555-5555" maxLength={14} inputMode="tel" error={false} />
                </div>
                <div>
                  <label style={labelStyle}>Business number</label>
                  <TextInput id="business_phone" value={f("business_phone")} onChange={(v) => setField("business_phone", fmtPhone(v))} placeholder="(555) 555-5555" maxLength={14} inputMode="tel" error={false} />
                </div>
                <ErrMsg msg={errors.phone} />
              </div>

              <Field label="Email address" required>
                <TextInput id="email" value={f("email")} onChange={(v) => setField("email", v)} placeholder="you@example.com" error={!!errors.email} />
                <ErrMsg msg={errors.email} />
              </Field>
            </Card>
          )}

          {/* ── Submit ── */}
          {filerType && (
            <Card>
              <p style={{ color: S.muted, fontSize: 14, margin: "0 0 18px" }}>
                When you&apos;re ready, click below to finish your intake. Your responses will be securely transmitted,
                and you&apos;ll be taken to electronically sign the Fintella Data Sharing Agreement.
              </p>
              {submitError && (
                <div style={{ color: S.err, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{submitError}</div>
              )}
              <button
                type="submit"
                disabled={submitting}
                style={{
                  display: "inline-block", width: "100%",
                  padding: "15px 20px", fontSize: 17, fontWeight: 700,
                  color: "#fff", background: submitting ? "#a9b6c6" : S.accent,
                  border: "none", borderRadius: 10, cursor: submitting ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {submitting ? "Submitting — please wait..." : "Finish Intake"}
              </button>
              <p style={{ textAlign: "center", color: S.muted, fontSize: 13, marginTop: 10 }}>
                Nothing is filed with the IRS automatically — you&apos;ll get a copy of your responses.
              </p>
            </Card>
          )}
        </form>
      </div>
    </div>
  );
}

/* =====================================================================
   SUB-COMPONENTS
   ===================================================================== */
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "12px 14px", fontSize: 16,
  fontFamily: "inherit", color: "#1d2733", background: "#fff",
  border: "1.5px solid #d8dee6", borderRadius: 9,
  outline: "none", boxSizing: "border-box",
};
const invalidStyle: React.CSSProperties = {
  borderColor: "#c8362f", background: "#fdecea",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontWeight: 600, marginBottom: 8, fontSize: 16,
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "#ffffff", border: "1px solid #d8dee6", borderRadius: 12,
      padding: 24, marginBottom: 20, boxShadow: "0 1px 3px rgba(20,30,45,.05)",
    }}>
      {children}
    </div>
  );
}

function StepTag({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "inline-block", fontSize: 12, fontWeight: 700, letterSpacing: ".06em",
      textTransform: "uppercase", color: "#01696f", background: "#e3f0f0",
      borderRadius: 999, padding: "4px 12px", marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={labelStyle}>
        {label}{required && <span style={{ color: "#c8362f", fontWeight: 700, marginLeft: 3 }}>*</span>}
        {hint && <span style={{ display: "block", color: "#5b6876", fontSize: 13, fontWeight: 400, marginTop: 2 }}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function OptionCard({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        border: `1.5px solid ${selected ? "#01696f" : "#d8dee6"}`,
        borderRadius: 9, padding: "13px 14px", cursor: "pointer",
        background: selected ? "#e3f0f0" : "transparent",
        transition: "border-color .12s, background .12s",
        fontSize: 16,
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: "50%",
        border: `2px solid ${selected ? "#01696f" : "#d8dee6"}`,
        background: selected ? "#01696f" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        {selected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
      </div>
      {children}
    </div>
  );
}

function TextInput({ id, value, onChange, placeholder, maxLength, inputMode, error, style }: {
  id: string; value: string; onChange: (v: string) => void; placeholder?: string;
  maxLength?: number; inputMode?: string; error: boolean; style?: React.CSSProperties;
}) {
  return (
    <input
      type="text"
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      inputMode={inputMode as any}
      autoComplete="off"
      style={{ ...inputStyle, ...(error ? invalidStyle : {}), ...style }}
    />
  );
}

function SensitiveInput({ id, value, onChange, placeholder, maxLength, error, visible, onToggle }: {
  id: string; value: string; onChange: (v: string) => void; placeholder?: string;
  maxLength?: number; error: boolean; visible: boolean; onToggle: () => void;
}) {
  return (
    <div>
      <input
        type={visible ? "text" : "password"}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode="numeric"
        autoComplete="off"
        style={{ ...inputStyle, ...(error ? invalidStyle : {}) }}
      />
      <button
        type="button"
        onClick={onToggle}
        style={{
          background: "none", border: "none", color: "#01696f", fontSize: 13,
          fontWeight: 600, cursor: "pointer", padding: 0, marginTop: 6,
        }}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}

function ErrMsg({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <div style={{ color: "#c8362f", fontSize: 13.5, fontWeight: 600, marginTop: 7 }}>{msg}</div>;
}
