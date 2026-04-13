import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAgreementSignedEmail } from "@/lib/sendgrid";
import { sendAgreementSignedSms } from "@/lib/twilio";

// SignWell sends webhooks when documents are signed, viewed, etc.
// Webhook events: document_completed, document_viewed, document_expired
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Verify webhook secret if configured
    const webhookSecret = process.env.SIGNWELL_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers.get("x-signwell-signature");
      if (signature !== webhookSecret) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const { event, data } = body;

    if (event === "document_completed") {
      // Find the agreement by SignWell document ID and mark as signed
      const agreement = await prisma.partnershipAgreement.findFirst({
        where: { signwellDocumentId: data.document_id },
      });

      if (agreement) {
        await prisma.partnershipAgreement.update({
          where: { id: agreement.id },
          data: {
            status: "signed",
            signedDate: new Date(),
            documentUrl: data.document_url || agreement.documentUrl,
          },
        });

        // Create a notification for the partner
        await prisma.notification.create({
          data: {
            recipientType: "partner",
            recipientId: agreement.partnerCode,
            type: "agreement_signed",
            title: "Partnership Agreement Signed",
            message: "Your partnership agreement has been signed and is now active. You can now submit deals.",
          },
        });

        // Phase 15a + 15b — fire transactional "account active" email + SMS.
        // Best-effort; webhook should still 200 even if SendGrid/Twilio is down.
        const partner = await prisma.partner.findUnique({
          where: { partnerCode: agreement.partnerCode },
          select: {
            partnerCode: true,
            email: true,
            firstName: true,
            lastName: true,
            mobilePhone: true,
            smsOptIn: true,
          },
        }).catch(() => null);
        if (partner?.email) {
          sendAgreementSignedEmail({
            partnerCode: partner.partnerCode,
            email: partner.email,
            firstName: partner.firstName,
            lastName: partner.lastName,
          }).catch((err) =>
            console.error("[SignWellWebhook] agreement-signed email failed:", err)
          );
        }
        if (partner) {
          sendAgreementSignedSms({
            partnerCode: partner.partnerCode,
            mobilePhone: partner.mobilePhone,
            smsOptIn: partner.smsOptIn,
            firstName: partner.firstName,
            lastName: partner.lastName,
          }).catch((err) =>
            console.error("[SignWellWebhook] agreement-signed SMS failed:", err)
          );
        }
      }
    }

    if (event === "document_viewed") {
      // Track that the partner has viewed the document (no status change needed,
      // but useful for admin visibility)
      const agreement = await prisma.partnershipAgreement.findFirst({
        where: { signwellDocumentId: data.document_id },
      });

      if (agreement && agreement.status === "pending") {
        // Still pending — partner has seen it but not signed yet
        // Could add a "viewed" timestamp in the future
      }
    }

    if (event === "document_expired") {
      const agreement = await prisma.partnershipAgreement.findFirst({
        where: { signwellDocumentId: data.document_id },
      });

      if (agreement) {
        await prisma.partnershipAgreement.update({
          where: { id: agreement.id },
          data: { status: "not_sent" },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
