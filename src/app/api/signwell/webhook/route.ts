import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAgreementSignedEmail } from "@/lib/sendgrid";
import { sendAgreementSignedSms } from "@/lib/twilio";
import { getCompletedPdfUrl, getCompletedDocumentFields, mapSignWellFieldsToPayoutData } from "@/lib/signwell";
import { put } from "@vercel/blob";
import crypto from "crypto";

// SSRF guard for server-side PDF fetches. Mirrors the private-IP/protocol
// validation used by /api/admin/dev/api-proxy — only HTTPS to a public host.
const PRIVATE_HOST_PATTERNS = [
  /^localhost$/,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
];

// SignWell sends webhooks when documents are signed, viewed, etc.
// Webhook events: document_completed, document_viewed, document_expired
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Verify webhook secret if configured (timing-safe comparison)
    const webhookSecret = process.env.SIGNWELL_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers.get("x-signwell-signature") || "";
      try {
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(webhookSecret))) {
          return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }
      } catch {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    // Store webhook payload for debugging
    await prisma.webhookRequestLog.create({
      data: {
        direction: "incoming",
        method: "POST",
        path: "/api/signwell/webhook",
        body: JSON.stringify(body).slice(0, 10000),
        responseStatus: 200,
      },
    }).catch(() => {});

    // SignWell sends: { event: { type: "document_completed", ... }, data: { object: { id: "..." } } }
    const eventType = typeof body.event === "string" ? body.event : body.event?.type;
    const docId = body.data?.object?.id || body.data?.document_id || body.data?.id || body.document_id;

    if (eventType === "document_completed") {
      // Find the agreement by SignWell document ID and mark as signed
      const agreement = await prisma.partnershipAgreement.findFirst({
        where: { signwellDocumentId: docId },
      });

      if (agreement) {
        // Pull the completed PDF URL from the webhook body when present;
        // otherwise call SignWell's /completed_pdf?url_only endpoint
        // (developers.signwell.com/reference/getcompletedpdf). Includes
        // the audit page so we have the legally-defensible trail.
        const bodyPdfUrl =
          body.data?.object?.completed_pdf_url ||
          body.data?.object?.original_file_url ||
          body.data?.document_url ||
          "";
        const completedPdfUrl =
          bodyPdfUrl ||
          (docId ? await getCompletedPdfUrl(docId).catch(() => null) : null) ||
          "";

        await prisma.partnershipAgreement.update({
          where: { id: agreement.id },
          data: {
            status: "signed",
            signedDate: new Date(),
            documentUrl: completedPdfUrl || agreement.documentUrl,
          },
        });

        // Store completed agreement as a Document so it shows up in the
        // partner's "My Documents" and the admin's documents log alongside
        // every other uploaded doc. Dedup via `uploadedBy = SignWell:<docId>`
        // so SignWell webhook retries don't create duplicates.
        const uploadedBy = `SignWell:${docId || agreement.id}`;
        const existingDoc = await prisma.document.findFirst({
          where: { partnerCode: agreement.partnerCode, uploadedBy },
          select: { id: true },
        });
        if (existingDoc) {
          await prisma.document.update({
            where: { id: existingDoc.id },
            data: { fileUrl: completedPdfUrl, status: "approved" },
          }).catch(() => {});
        } else {
          await prisma.document.create({
            data: {
              partnerCode: agreement.partnerCode,
              docType: "agreement",
              fileName: `Partnership Agreement v${agreement.version} — Signed ${new Date().toLocaleDateString("en-US")}`,
              fileUrl: completedPdfUrl,
              status: "approved",
              uploadedBy,
            },
          }).catch(() => {});
        }

        // Create a notification for the partner
        await prisma.notification.create({
          data: {
            recipientType: "partner",
            recipientId: agreement.partnerCode,
            type: "agreement_signed",
            title: "Partnership Agreement Signed",
            message: "Your partnership agreement has been signed and is now active. You can now submit deals.",
            link: "/dashboard/documents",
          },
        });

        // Fetch the partner so we can both (a) activate them if they were
        // still pending and (b) pass their contact info to the post-sign
        // notifications below.
        const partner = await prisma.partner.findUnique({
          where: { partnerCode: agreement.partnerCode },
          select: {
            partnerCode: true,
            email: true,
            firstName: true,
            lastName: true,
            mobilePhone: true,
            smsOptIn: true,
            status: true,
          },
        }).catch(() => null);

        if (!partner || partner.partnerCode !== agreement.partnerCode) {
          console.error(`[signwell] document ${docId} partner mismatch — agreement.partnerCode=${agreement.partnerCode}`);
          return NextResponse.json({ received: true, warning: "partner mismatch" });
        }

        // Activate the partner if they were pending. This is the
        // CLAUDE.md-documented "SignWell webhook marks agreement as
        // signed → partner becomes active" step. Without it, Partner.status
        // stays "pending" forever even after the agreement is signed,
        // which breaks every code path that filters on status==="active"
        // (admin views, chat routing, enterprise override calculations).
        // Deliberately NOT wrapped in try/catch — if this DB write fails,
        // we want the webhook to 500 so SignWell retries.
        if (partner && partner.status === "pending") {
          await prisma.partner.update({
            where: { partnerCode: agreement.partnerCode },
            data: { status: "active" },
          });
        }

        // Fire workflow trigger for partner.activated (fire-and-forget)
        if (partner && partner.status === "pending") {
          import("@/lib/workflow-engine").then(({ fireWorkflowTrigger }) =>
            fireWorkflowTrigger("partner.activated", { partner })
          ).catch(() => {});
        }

        // Extract payout fields from completed document and lock profile
        getCompletedDocumentFields(docId).then(async (fields) => {
          if (!fields || Object.keys(fields).length === 0) return;
          const { profileData, partnerData } = mapSignWellFieldsToPayoutData(fields);
          if (Object.keys(partnerData).length > 0) {
            await prisma.partner.update({
              where: { partnerCode: agreement.partnerCode },
              data: partnerData,
            }).catch(() => {});
          }
          if (Object.keys(profileData).length > 0) {
            profileData.payoutLockedAt = new Date();
            profileData.payoutLockedBy = "agreement";
            await prisma.partnerProfile.upsert({
              where: { partnerCode: agreement.partnerCode },
              update: profileData,
              create: { partnerCode: agreement.partnerCode, ...profileData },
            }).catch((err) => console.error("[signwell] payout profile save failed:", err));
          }
        }).catch(() => {});

        // Phase 15a + 15b — fire transactional "account active" email + SMS.
        // Best-effort; webhook should still 200 even if SendGrid/Twilio is down.
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
      } else {
        // No partnership agreement found — check if this is a Kwong Penalty Abatement (ERC) deal.
        // Primary lookup: metadata.dealId passed to SignWell at send time.
        // Fallback: search serviceFields JSON for signwellDocumentId.
        const metaDealId = body.data?.object?.metadata?.dealId;
        let kwongDeal: any = null;
        if (metaDealId) {
          kwongDeal = await prisma.deal.findUnique({ where: { id: metaDealId } });
        }
        if (!kwongDeal) {
          kwongDeal = await prisma.deal.findFirst({
            where: {
              serviceOfInterest: "Kwong Penalty Abatement (ERC)",
              serviceFields: { path: ["signwellDocumentId"], equals: docId },
            },
          });
        }

        if (kwongDeal && kwongDeal.stage === "lead_submitted") {
          // Transition from lead_submitted → engaged (idempotent — skip if already past lead_submitted)
          const pdfUrl = body.data?.object?.completed_pdf?.url || "";
          let finalPdfUrl = pdfUrl;
          if (!finalPdfUrl && docId) {
            try {
              finalPdfUrl = await getCompletedPdfUrl(docId) || "";
            } catch {}
          }

          // Fetch the signed PDF ONCE. The buffer is reused for (a) the Vercel
          // Blob mirror — a permanent URL that never expires, unlike SignWell's
          // time-limited completed_pdf URL — and (b) the intake email attachment
          // below. Keeping a single fetch avoids adding a second SSRF surface.
          // The URL comes from the SignWell webhook/API; we still validate it is
          // HTTPS to a non-private host before fetching (SSRF guard).
          let pdfBuf: Buffer | null = null;
          if (finalPdfUrl) {
            // Inline SSRF validation (CodeQL recognizes this as a barrier; a
            // boolean helper does not). Parse, require HTTPS, reject private
            // hosts, then fetch the validated URL object.
            let safeUrl: URL | null = null;
            try {
              const u = new URL(finalPdfUrl);
              const host = u.hostname.toLowerCase();
              if (u.protocol === "https:" && !PRIVATE_HOST_PATTERNS.some((p) => p.test(host))) {
                safeUrl = u;
              }
            } catch {
              safeUrl = null;
            }
            if (safeUrl) {
              try {
                const pdfRes = await fetch(safeUrl);
                if (pdfRes.ok) pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
              } catch (pdfErr) {
                console.warn("[SignWellWebhook] Could not fetch signed PDF:", pdfErr);
              }
            }
          }

          // Mirror to Vercel Blob so OpCenter (and others) get a stable URL.
          let signedPdfMirrorUrl: string | null = null;
          if (pdfBuf && process.env.BLOB_READ_WRITE_TOKEN) {
            try {
              const blob = await put(
                `signed-agreements/${kwongDeal.id}-signed-agreement.pdf`,
                pdfBuf,
                { access: "public", contentType: "application/pdf", addRandomSuffix: true }
              );
              signedPdfMirrorUrl = blob.url;
              console.log(`[SignWellWebhook] Mirrored signed PDF to Blob: ${signedPdfMirrorUrl}`);
            } catch (blobErr) {
              console.warn("[SignWellWebhook] Blob mirror failed:", blobErr);
            }
          }

          await prisma.deal.update({
            where: { id: kwongDeal.id },
            data: {
              stage: "engaged",
              serviceFields: {
                ...(kwongDeal.serviceFields as any),
                signwellStatus: "completed",
                signwellCompletedAt: new Date().toISOString(),
                signwellPdfUrl: finalPdfUrl || null,
                signedPdfMirrorUrl: signedPdfMirrorUrl || null,
              },
            },
          });
          console.log(`[SignWellWebhook] Kwong deal ${kwongDeal.id} → engaged (doc ${docId})`);

          // Send intake .md + signed PDF to firm now that client has signed
          const sf = kwongDeal.serviceFields as any;
          const intakeMarkdown = sf?.intakeMarkdown;
          const intakeId = sf?.intakeMarkdownId || kwongDeal.id;
          if (intakeMarkdown) {
            const RESEND_KEY = process.env.RESEND_API_KEY || "";
            if (RESEND_KEY) {
              const clientName = kwongDeal.clientName || "Client";
              const mdFilename = `${intakeId}.md`;
              const attachments: Array<{ filename: string; content: string }> = [
                { filename: mdFilename, content: Buffer.from(intakeMarkdown, "utf-8").toString("base64") },
              ];

              // Attach the signed PDF — reuse the buffer fetched above (no
              // second network round-trip, no extra SSRF surface).
              if (pdfBuf) {
                attachments.push({
                  filename: `${intakeId}-signed-agreement.pdf`,
                  content: pdfBuf.toString("base64"),
                });
              }

              fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_KEY}` },
                body: JSON.stringify({
                  from: "Fintella <noreply@fintella.partners>",
                  to: ["mvfoglia@fflawfirm.com"],
                  cc: ["admin@fintella.partners"],
                  subject: `New Client Intake — ${clientName} — ${intakeId}`,
                  text: `A new Kwong Penalty Abatement (ERC) client intake has been submitted and signed.\n\nClient: ${clientName}\nSubmission ID: ${intakeId}\nDeal ID: ${kwongDeal.id}\n\nAttached:\n1. ${mdFilename} — full intake data\n2. Signed Data Sharing Agreement (PDF)`,
                  html: `<p>A new <strong>Kwong Penalty Abatement (ERC)</strong> client intake has been submitted and signed.</p><p><strong>Client:</strong> ${clientName}<br><strong>Submission ID:</strong> ${intakeId}<br><strong>Deal ID:</strong> ${kwongDeal.id}</p><p><strong>Attachments:</strong></p><ol><li><code>${mdFilename}</code> — full intake data</li><li>Signed Data Sharing Agreement (PDF)</li></ol>`,
                  attachments,
                }),
              }).then((r) => {
                if (!r.ok) r.text().then((t) => console.error("[SignWellWebhook] Intake email error:", t));
                else console.log("[SignWellWebhook] Intake .md + PDF emailed to mvfoglia@fflawfirm.com");
              }).catch((e) => console.error("[SignWellWebhook] Intake email failed:", e));
            }
          }

          // Fire deal.stage_changed so workflows can forward the signed
          // agreement (and intake data) to external systems like OpCenter.
          // The signed PDF URL is now available on serviceFields.signwellPdfUrl,
          // surfaced as {deal.signedPdfUrl} via deriveDealWorkflowFields().
          import("@/lib/workflow-engine").then(async ({ fireWorkflowTrigger, deriveDealWorkflowFields }) => {
            const refreshed = await prisma.deal.findUnique({ where: { id: kwongDeal.id } }).catch(() => null);
            const base = refreshed || { ...kwongDeal, stage: "engaged" };
            let referralPartnerName = "";
            if (base.partnerCode && base.partnerCode !== "UNATTRIBUTED" && base.partnerCode !== "DIRECT") {
              const p = await prisma.partner.findUnique({
                where: { partnerCode: base.partnerCode },
                select: { firstName: true, lastName: true },
              }).catch(() => null);
              if (p) referralPartnerName = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
            }
            const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fintella.partners";
            const enrichedDeal = {
              ...base,
              ...deriveDealWorkflowFields(base),
              referralPartnerName,
              dealUrl: `${PORTAL_URL}/admin/deals#${base.id}`,
            };
            fireWorkflowTrigger("deal.stage_changed", {
              deal: enrichedDeal,
              previousStage: "lead_submitted",
              newStage: "engaged",
            });
          }).catch((e) => console.error("[SignWellWebhook] workflow trigger failed:", e));
        }
      }
    }

    // With auto-signing enabled, recipient_completed events are IGNORED.
    // The co-signer auto-signs instantly after the partner, so there's no
    // "partner_signed" intermediate state. We only care about document_completed
    // (both signed) which is handled above.

    if (eventType === "document_viewed") {
      // HARD RULE: Only set "viewed" if the PARTNER viewed, not the co-signer
      const viewerEmail = body.data?.object?.email || body.data?.recipient?.email || "";
      const viewSettings = await prisma.portalSettings.findUnique({ where: { id: "global" }, select: { fintellaSignerEmail: true } });
      const isCosignerView = viewSettings?.fintellaSignerEmail && viewerEmail.toLowerCase() === viewSettings.fintellaSignerEmail.toLowerCase();

      const agreement = await prisma.partnershipAgreement.findFirst({
        where: { signwellDocumentId: docId },
      });

      if (agreement && agreement.status === "pending" && !isCosignerView) {
        await prisma.partnershipAgreement.update({
          where: { id: agreement.id },
          data: { status: "viewed", viewedAt: new Date() },
        });
      }
    }

    if (eventType === "document_expired") {
      const agreement = await prisma.partnershipAgreement.findFirst({
        where: { signwellDocumentId: docId },
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
