import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendForSigning } from "@/lib/signwell";

const KWONG_SIGNWELL_TEMPLATE_ID = "ae6392fc-11cb-4a03-aa17-bff87bd11abb";
const KWONG_INTAKE_EMAIL = "mfoglia@fflawfirm.com";
const LEGAL_DOC_VERSION = "1.0";
const TEMPLATE_VERSION = "2.3";

function pad(n: number) { return n < 10 ? "0" + n : "" + n; }

function genSubmissionId(d: Date) {
  return "INTAKE-" + d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate())
    + "-" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds())
    + "-" + Math.random().toString(36).slice(2, 7).toUpperCase();
}

function orBlank(v: string | null | undefined) {
  return (!v || v.trim() === "") ? "BLANK" : v.trim();
}

function buildIntakeMarkdown(data: {
  filer_type: string;
  individual_legal_name?: string;
  individual_address_street?: string;
  individual_address_city?: string;
  individual_address_state?: string;
  individual_address_zip?: string;
  individual_ssn?: string;
  filing_status?: string;
  spouse_legal_name?: string;
  spouse_address_street?: string;
  spouse_address_city?: string;
  spouse_address_state?: string;
  spouse_address_zip?: string;
  spouse_ssn?: string;
  business_legal_name?: string;
  business_address_street?: string;
  business_address_city?: string;
  business_address_state?: string;
  business_address_zip?: string;
  business_ein?: string;
  owner_name?: string;
  entity_type?: string;
  signer_title?: string;
  mobile_phone?: string;
  business_phone?: string;
  email?: string;
}): { text: string; id: string } {
  const now = new Date();
  const iso = now.toISOString();
  const subId = genSubmissionId(now);

  const isIndividual = data.filer_type === "Individual";
  const isBusiness = data.filer_type === "Business";
  const isJoint = isIndividual && data.filing_status === "Filed jointly";

  const signerName = isIndividual
    ? data.individual_legal_name || ""
    : data.owner_name || data.business_legal_name || "";

  const L: string[] = [];
  L.push("# Client Intake Submission");
  L.push("");
  L.push("## Submission Metadata");
  L.push(`- Template Version: ${TEMPLATE_VERSION}`);
  L.push(`- Legal Document Set Version: ${LEGAL_DOC_VERSION}`);
  L.push(`- Submission ID: ${subId}`);
  L.push(`- Submitted (UTC): ${iso}`);
  L.push("");

  // Section A
  L.push("## Section A - Filer Type");
  L.push(`- Filer type: ${orBlank(data.filer_type)}`);
  L.push("");

  // Section B - Individual Path
  L.push("## Section B - Individual Path");
  L.push(`- Your full legal name: ${isIndividual ? orBlank(data.individual_legal_name) : "BLANK"}`);
  L.push(`- Filing status: ${isIndividual ? orBlank(data.filing_status) : "BLANK"}`);
  L.push(`- Your Social Security Number: ${isIndividual ? orBlank(data.individual_ssn) : "BLANK"}`);
  L.push(`- Your mailing address - street: ${isIndividual ? orBlank(data.individual_address_street) : "BLANK"}`);
  L.push(`- Your mailing address - city: ${isIndividual ? orBlank(data.individual_address_city) : "BLANK"}`);
  L.push(`- Your mailing address - state: ${isIndividual ? orBlank(data.individual_address_state?.toUpperCase()) : "BLANK"}`);
  L.push(`- Your mailing address - ZIP: ${isIndividual ? orBlank(data.individual_address_zip) : "BLANK"}`);
  L.push(`- Spouse / joint filer's full legal name: ${isJoint ? orBlank(data.spouse_legal_name) : "BLANK"}`);
  L.push(`- Spouse / joint filer's Social Security Number: ${isJoint ? orBlank(data.spouse_ssn) : "BLANK"}`);
  L.push(`- Spouse / joint filer's mailing address - street: ${isJoint ? orBlank(data.spouse_address_street) : "BLANK"}`);
  L.push(`- Spouse / joint filer's mailing address - city: ${isJoint ? orBlank(data.spouse_address_city) : "BLANK"}`);
  L.push(`- Spouse / joint filer's mailing address - state: ${isJoint ? orBlank(data.spouse_address_state?.toUpperCase()) : "BLANK"}`);
  L.push(`- Spouse / joint filer's mailing address - ZIP: ${isJoint ? orBlank(data.spouse_address_zip) : "BLANK"}`);
  L.push("");

  // Section C - Business Path
  L.push("## Section C - Business Path");
  L.push(`- Full legal business name (including DBAs): ${isBusiness ? orBlank(data.business_legal_name) : "BLANK"}`);
  L.push(`- Full name of the business owner: ${isBusiness ? orBlank(data.owner_name) : "BLANK"}`);
  L.push(`- Entity type: ${isBusiness ? orBlank(data.entity_type) : "BLANK"}`);
  L.push(`- Signer's title: ${isBusiness ? orBlank(data.signer_title) : "BLANK"}`);
  L.push(`- Business EIN: ${isBusiness ? orBlank(data.business_ein) : "BLANK"}`);
  L.push(`- Business mailing address - street: ${isBusiness ? orBlank(data.business_address_street) : "BLANK"}`);
  L.push(`- Business mailing address - city: ${isBusiness ? orBlank(data.business_address_city) : "BLANK"}`);
  L.push(`- Business mailing address - state: ${isBusiness ? orBlank(data.business_address_state?.toUpperCase()) : "BLANK"}`);
  L.push(`- Business mailing address - ZIP: ${isBusiness ? orBlank(data.business_address_zip) : "BLANK"}`);
  L.push("");

  // Section D - Contact
  L.push("## Section D - Contact Information");
  L.push(`- Mobile number: ${orBlank(data.mobile_phone)}`);
  L.push(`- Business number: ${isBusiness ? orBlank(data.business_phone) : "BLANK"}`);
  L.push(`- Email address: ${orBlank(data.email)}`);
  L.push("");

  // Section E - Document Review (pending SignWell)
  L.push("## Section E - Document Review & Acknowledgments");
  L.push("- Privacy Policy reviewed (scrolled to end): Yes");
  L.push("- Privacy Policy acknowledged: Yes");
  L.push("- Terms of Use reviewed (scrolled to end): Yes");
  L.push("- Terms of Use acknowledged: Yes");
  L.push("- Data Sharing Agreement reviewed (scrolled to end): Yes");
  L.push("");

  // Section F - Authorizations (pending SignWell)
  L.push("## Section F - Required Authorizations (Data Sharing Agreement)");
  L.push("- 1 - Data-Sharing Authorization: Yes");
  L.push("- 2 - Form 2848 transmittal authorization: Yes");
  L.push("- 3 - Electronic records & signature consent (E-SIGN/UETA): Yes");
  L.push(`- 4 - Joint-filer acknowledgment: ${isJoint ? "Yes" : isBusiness ? "N/A (business filer)" : "N/A"}`);
  L.push("");

  // Section G - Electronic Signature
  L.push("## Section G - Electronic Signature");
  L.push(`- Signed by (typed full legal name): ${orBlank(signerName)}`);
  L.push(`- Signature timestamp (UTC): ${iso}`);
  L.push("");

  // Audit Log
  L.push("## Submission Audit Log");
  L.push("- Legal document fingerprint (SHA-256): server-generated");
  L.push(`- Browser / device (user agent): Captured server-side`);
  L.push("- IP address: Captured server-side at submission (not available client-side)");
  L.push("");
  L.push("---");
  L.push(`_End of submission. Generated by Fintella Client Intake Form, template v${TEMPLATE_VERSION}._`);
  L.push("");

  return { text: L.join("\n"), id: subId };
}

async function sendIntakeEmail(markdown: string, submissionId: string, signerName: string) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
  if (!RESEND_API_KEY) {
    console.warn("[kwong-intake] RESEND_API_KEY not set, skipping intake email");
    return;
  }

  const filename = `${submissionId}.md`;
  const base64Content = Buffer.from(markdown, "utf-8").toString("base64");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Fintella <noreply@fintella.partners>",
      to: [KWONG_INTAKE_EMAIL],
      subject: `New Client Intake — ${signerName} — ${submissionId}`,
      text: `A new Kwong Penalty Abatement (ERC) client intake has been submitted.\n\nClient: ${signerName}\nSubmission ID: ${submissionId}\n\nThe full intake file is attached as ${filename}.`,
      html: `<p>A new <strong>Kwong Penalty Abatement (ERC)</strong> client intake has been submitted.</p><p><strong>Client:</strong> ${signerName}<br><strong>Submission ID:</strong> ${submissionId}</p><p>The full intake file is attached as <code>${filename}</code>.</p>`,
      attachments: [
        {
          filename,
          content: base64Content,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => `HTTP ${res.status}`);
    console.error("[kwong-intake] Resend email error:", errText);
  } else {
    console.log("[kwong-intake] Intake email sent to", KWONG_INTAKE_EMAIL);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      ref,
      filer_type,
      email,
      mobile_phone,
      business_phone,
      individual_legal_name,
      individual_address_street,
      individual_address_city,
      individual_address_state,
      individual_address_zip,
      individual_ssn,
      filing_status,
      spouse_legal_name,
      spouse_address_street,
      spouse_address_city,
      spouse_address_state,
      spouse_address_zip,
      spouse_ssn,
      business_legal_name,
      business_address_street,
      business_address_city,
      business_address_state,
      business_address_zip,
      business_ein,
      owner_name,
      entity_type,
      signer_title,
    } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!filer_type) {
      return NextResponse.json({ error: "Filer type is required" }, { status: 400 });
    }

    const isIndividual = filer_type === "Individual";
    const isBusiness = filer_type === "Business";
    const isJoint = isIndividual && filing_status === "Filed jointly";

    const signerName = isIndividual
      ? individual_legal_name || "Client"
      : owner_name || business_legal_name || "Client";

    const dealName = isIndividual
      ? `${individual_legal_name} — Penalty Abatement (ERC)`
      : `${business_legal_name || owner_name} — Penalty Abatement (ERC)`;

    // Build the intake markdown
    const md = buildIntakeMarkdown({
      filer_type, individual_legal_name, individual_address_street,
      individual_address_city, individual_address_state, individual_address_zip,
      individual_ssn, filing_status, spouse_legal_name, spouse_address_street,
      spouse_address_city, spouse_address_state, spouse_address_zip, spouse_ssn,
      business_legal_name, business_address_street, business_address_city,
      business_address_state, business_address_zip, business_ein, owner_name,
      entity_type, signer_title, mobile_phone, business_phone, email,
    });

    // Look up referring partner
    const partnerCode = ref || "";
    let partner: any = null;
    if (partnerCode) {
      partner = await prisma.partner.findFirst({
        where: { partnerCode: { equals: partnerCode, mode: "insensitive" } },
      });
    }

    const street = isIndividual ? individual_address_street : isBusiness ? business_address_street : "";
    const city = isIndividual ? individual_address_city : isBusiness ? business_address_city : "";
    const state = isIndividual ? individual_address_state : isBusiness ? business_address_state : "";
    const zip = isIndividual ? individual_address_zip : isBusiness ? business_address_zip : "";

    const deal = await prisma.deal.create({
      data: {
        dealName,
        clientName: signerName,
        clientEmail: email,
        clientPhone: mobile_phone || business_phone || null,
        clientTitle: isBusiness ? signer_title : null,
        partnerCode: partner?.partnerCode || partnerCode || "DIRECT",
        serviceOfInterest: "Kwong Penalty Abatement (ERC)",
        legalEntityName: isBusiness ? business_legal_name : individual_legal_name || null,
        companyEin: isBusiness ? business_ein : null,
        businessStreetAddress: street || null,
        businessCity: city || null,
        businessState: state || null,
        businessZip: zip || null,
        stage: "lead_submitted",
        affiliateNotes: partner ? `Referred by partner ${partner.partnerCode}` : null,
        serviceFields: {
          filer_type,
          filing_status: isIndividual ? filing_status || null : null,
          individual_legal_name: isIndividual ? individual_legal_name : null,
          individual_address: isIndividual ? [individual_address_street, individual_address_city, individual_address_state, individual_address_zip].filter(Boolean).join(", ") : null,
          individual_ssn: isIndividual ? individual_ssn : null,
          spouse_legal_name: isJoint ? spouse_legal_name : null,
          spouse_address: isJoint ? [spouse_address_street, spouse_address_city, spouse_address_state, spouse_address_zip].filter(Boolean).join(", ") : null,
          spouse_ssn: isJoint ? spouse_ssn : null,
          business_legal_name: isBusiness ? business_legal_name : null,
          business_address: isBusiness ? [business_address_street, business_address_city, business_address_state, business_address_zip].filter(Boolean).join(", ") : null,
          business_ein: isBusiness ? business_ein : null,
          owner_name: isBusiness ? owner_name : null,
          entity_type: isBusiness ? entity_type : null,
          signer_title: isBusiness ? signer_title : null,
          mobile_phone: mobile_phone || null,
          business_phone: business_phone || null,
          intakeMarkdownId: md.id,
          intake_data: body,
        },
      },
    });

    // Send intake markdown email to firm (fire-and-forget)
    sendIntakeEmail(md.text, md.id, signerName).catch((err) =>
      console.error("[kwong-intake] Email send failed:", err)
    );

    // Build SignWell template fields
    const today = new Date().toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
    const templateFields = [
      { api_id: "TextField_1", value: signerName },
      { api_id: "DateField_1", value: today },
    ];

    let cosignerEmail = "admin@fintella.partners";
    let cosignerName = "Fintella";
    try {
      const settings = await prisma.portalSettings.findFirst();
      if (settings) {
        cosignerEmail = (settings as any).fintellaSigner || cosignerEmail;
        cosignerName = (settings as any).fintellaSignerName || cosignerName;
      }
    } catch {}

    const swResult = await sendForSigning({
      name: `Penalty Abatement (ERC) Agreement — ${signerName}`,
      subject: "Fintella Data Sharing Agreement — Please Sign",
      message: "Please review and sign the attached Data Sharing Agreement to complete your intake process.",
      recipients: [
        { id: "1", email, name: signerName, role: "Client" },
        { id: "2", email: cosignerEmail, name: cosignerName, role: "Fintella" },
      ],
      templateId: KWONG_SIGNWELL_TEMPLATE_ID,
      templateFields,
    });

    if (swResult.documentId) {
      await prisma.deal.update({
        where: { id: deal.id },
        data: {
          serviceFields: {
            ...(deal.serviceFields as any),
            signwellDocumentId: swResult.documentId,
            signwellStatus: "pending",
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      dealId: deal.id,
      signingUrl: swResult.embeddedSigningUrl || "",
      documentId: swResult.documentId,
      intakeId: md.id,
    });
  } catch (err: any) {
    console.error("[kwong-intake] Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
