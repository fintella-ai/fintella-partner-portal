import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendForSigning } from "@/lib/signwell";

const KWONG_SIGNWELL_TEMPLATE_ID = "ae6392fc-11cb-4a03-aa17-bff87bd11abb";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      ref,
      filer_type,
      email,
      mobile_phone,
      business_phone,
      // Individual path
      individual_legal_name,
      individual_address_street,
      individual_address_city,
      individual_address_state,
      individual_address_zip,
      individual_ssn,
      filing_status,
      // Spouse / joint filer
      spouse_legal_name,
      spouse_address_street,
      spouse_address_city,
      spouse_address_state,
      spouse_address_zip,
      spouse_ssn,
      // Business path
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

    // Look up referring partner
    const partnerCode = ref || "";
    let partner: any = null;
    if (partnerCode) {
      partner = await prisma.partner.findFirst({
        where: { partnerCode: { equals: partnerCode, mode: "insensitive" } },
      });
    }

    // Map address fields based on filer type
    const street = isIndividual ? individual_address_street : isBusiness ? business_address_street : "";
    const city = isIndividual ? individual_address_city : isBusiness ? business_address_city : "";
    const state = isIndividual ? individual_address_state : isBusiness ? business_address_state : "";
    const zip = isIndividual ? individual_address_zip : isBusiness ? business_address_zip : "";

    // Create a deal record — all form fields mapped to Deal columns + serviceFields JSON
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
          // Individual
          individual_legal_name: isIndividual ? individual_legal_name : null,
          individual_address: isIndividual ? [individual_address_street, individual_address_city, individual_address_state, individual_address_zip].filter(Boolean).join(", ") : null,
          individual_ssn: isIndividual ? individual_ssn : null,
          // Spouse (joint filers)
          spouse_legal_name: isJoint ? spouse_legal_name : null,
          spouse_address: isJoint ? [spouse_address_street, spouse_address_city, spouse_address_state, spouse_address_zip].filter(Boolean).join(", ") : null,
          spouse_ssn: isJoint ? spouse_ssn : null,
          // Business
          business_legal_name: isBusiness ? business_legal_name : null,
          business_address: isBusiness ? [business_address_street, business_address_city, business_address_state, business_address_zip].filter(Boolean).join(", ") : null,
          business_ein: isBusiness ? business_ein : null,
          owner_name: isBusiness ? owner_name : null,
          entity_type: isBusiness ? entity_type : null,
          signer_title: isBusiness ? signer_title : null,
          // Contact
          mobile_phone: mobile_phone || null,
          business_phone: business_phone || null,
          // Full raw intake payload (backup)
          intake_data: body,
        },
      },
    });

    // Build SignWell template fields — pre-fill printed name and date
    const today = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const templateFields = [
      { api_id: "TextField_1", value: signerName },
      { api_id: "DateField_1", value: today },
    ];

    // Look up cosigner from portal settings
    let cosignerEmail = "admin@fintella.partners";
    let cosignerName = "Fintella";
    try {
      const settings = await prisma.portalSettings.findFirst();
      if (settings) {
        cosignerEmail = (settings as any).fintellaSigner || cosignerEmail;
        cosignerName = (settings as any).fintellaSignerName || cosignerName;
      }
    } catch {
      // Use defaults
    }

    // Send via SignWell — client is auto-redirected to signing URL after form submit
    const swResult = await sendForSigning({
      name: `Penalty Abatement (ERC) Agreement — ${signerName}`,
      subject: "Fintella Data Sharing Agreement — Please Sign",
      message:
        "Please review and sign the attached Data Sharing Agreement to complete your intake process.",
      recipients: [
        {
          id: "1",
          email,
          name: signerName,
          role: "Client",
        },
        {
          id: "2",
          email: cosignerEmail,
          name: cosignerName,
          role: "Fintella",
        },
      ],
      templateId: KWONG_SIGNWELL_TEMPLATE_ID,
      templateFields,
    });

    // Store SignWell document ID on the deal
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
    });
  } catch (err: any) {
    console.error("[kwong-intake] Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
