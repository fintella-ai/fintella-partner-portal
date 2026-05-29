# Knowledge: Webhook Workflow Variables & OpCenter Field Map

Durable reference for the portal AI (Finn/Stella/Tara/Ollie) and the knowledge graph. Factual; update when variables change.

## How workflow tokens resolve
- Outgoing webhook / email / notification bodies are interpolated with **single-brace** `{deal.field}` tokens via `interpolate()` → `getNestedValue()` in `src/lib/workflow-engine.ts`. (The `{{snake_case}}` shown in some doc tables is display-only and does NOT resolve in bodies.)
- Before a deal trigger fires, the payload is enriched: `{ ...deal, ...deriveDealWorkflowFields(deal), referralPartnerName, dealUrl }`.
- `deriveDealWorkflowFields(deal)` reads `deal.serviceFields` + address columns and exposes flat keys: `entityType`, `filerType`, `filingStatus`, `businessAddress`, `signedPdfUrl`, `signedPdfMirrorUrl`, `agreementStatus`, `signwellDocumentId`.

## Available deal tokens
`{deal.id}`, `{deal.createdAt}`, `{deal.updatedAt}`, `{deal.dealName}`, `{deal.partnerCode}`, `{deal.referralPartnerName}`, `{deal.dealUrl}`, `{deal.externalDealId}`, `{deal.idempotencyKey}`, `{deal.internalRawCode}`, `{deal.clientName}`, `{deal.clientFirstName}`, `{deal.clientLastName}`, `{deal.clientEmail}`, `{deal.clientPhone}`, `{deal.clientTitle}`, `{deal.legalEntityName}`, `{deal.companyEin}`, `{deal.entityType}`, `{deal.filerType}`, `{deal.filingStatus}`, `{deal.serviceOfInterest}`, `{deal.businessStreetAddress}`, `{deal.businessStreetAddress2}`, `{deal.businessCity}`, `{deal.businessState}`, `{deal.businessZip}`, `{deal.businessAddress}` (composed), `{deal.stage}`, `{deal.consultBookedDate}`, `{deal.consultBookedTime}`, `{deal.estimatedRefundAmount}`, `{deal.affiliateNotes}`, `{deal.signedPdfUrl}`, `{deal.signedPdfMirrorUrl}` (persistent Blob), `{deal.agreementStatus}`, `{deal.signwellDocumentId}`.

## Fintella token → OpCenter inbound field
| Fintella token | OpCenter field |
|---|---|
| `{deal.id}` | external_deal_id |
| `{deal.entityType}` | entity_type |
| `{deal.companyEin}` | ein |
| `{deal.filerType}` | filer_type |
| `{deal.filingStatus}` | filing_status |
| `{deal.signedPdfMirrorUrl}` (or signedPdfUrl) | agreement_pdf_url |
| `{deal.agreementStatus}` | agreement_status |
| `{deal.signwellDocumentId}` | signwell_document_id |
| `{deal.createdAt}` / `{deal.updatedAt}` | created_at / updated_at |
| `{deal.clientName}` / `{deal.clientEmail}` / `{deal.clientPhone}` | contact_name / contact_email / contact_phone |
| `{deal.legalEntityName}` | contact_company |
| `{deal.referralPartnerName}` | referral_partner |
| `{deal.partnerCode}` | partner_code |
| `{deal.dealName}` | title |
| `{deal.serviceOfInterest}` | service_id |
| `{deal.businessAddress}` / City / State / Zip | address / city / state / postal_code |
| `{deal.consultBookedDate}` / `{deal.consultBookedTime}` | meeting_date / meeting_time |

## Forwarding a signed agreement to OpCenter
- Trigger `deal.stage_changed`; filter `{deal.agreementStatus}` equals `completed`.
- SignWell completion (`document_completed`) downloads the PDF via the SignWell API and mirrors it to Vercel Blob → `serviceFields.signedPdfMirrorUrl` (permanent URL; falls back to the time-limited SignWell URL if `BLOB_READ_WRITE_TOKEN` is unset).
- OpCenter auth is a token IN the hook URL, so no auth header is needed on the outbound POST.

## Observability
- Outbound webhook posts are logged to `Deal.rawPayload` (event method `WEBHOOK_OUT`, visible in the deal's Raw Source Payloads dropdown) and to `WebhookRequestLog` (direction=outgoing) in the dev API log, with one-click resend at `/api/admin/dev/resend-webhook`.

## Empty-value safety
`deriveDealWorkflowFields` returns empty strings (never undefined) for unset fields, so OpCenter-side `.trim()` calls are safe before a deal is signed.
