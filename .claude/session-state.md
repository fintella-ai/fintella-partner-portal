# Session State

## ▶️ RESUME HERE — NEXT STEPS
1. **Verify prod schema** (should be in sync — Vercel build runs `prisma db push` on every deploy): pull prod env via `vercel env pull`, map `STORAGE_DATABASE_URL_UNPOOLED`→`DATABASE_URL` (by var, never inline), `npx prisma db push`. Confirms Deal cols + AiMemory + User 2FA cols.
2. **Enroll in 2FA** at `/admin/account` (TwoFactorCard) → scan QR → save backup codes → test login with the code.
3. **Merge open docs PR** (this branch) if not already merged.
4. Wire an OpCenter-forwarding workflow (`deal.stage_changed`, filter `{deal.agreementStatus}`=`completed`); use the **live token preview** to validate the body before saving.
5. Optional: enforce 2FA per-role (phase 2); build the webhook "golden payload" diff; add admin passkeys.

🕒 Last updated: 2026-05-29 (late) — **Webhook vars + OpCenter + 5 follow-ups (AI chat, token preview, Blob mirror, outbound dashboard, admin 2FA)**

## 🌿 Git state

- **Branch**: `main` @ `8e773fa`
- **Working tree**: clean (only untracked `Kwong Client intake form/` — not ours)
- 13 PRs merged this session: #1068–#1079, #1081.

## ✅ Follow-ups merged (beast mode)
- **#1076** unified AI chat widget + per-user cloud memory (AiMemory model) — the held mobile-bottom-nav work, rebased
- **#1077** live token preview in workflow editor (previewInterpolate + /api/admin/workflows/preview)
- **#1078** persistent Blob PDF mirror — SignWell completion downloads via downloadCompletedPdf() (constant base, no SSRF) → Vercel Blob → serviceFields.signedPdfMirrorUrl
- **#1079** outbound webhook dashboard + one-click resend (/api/admin/dev/resend-webhook)
- **#1081** opt-in admin 2FA (TOTP, otplib) + Google OAuth for admins — User += totpSecret/totpEnabled/totpPendingSecret/totpBackupCodes. Opt-in, NO lockout. Enroll at /admin/account.

## ✅ What's done (this session)

| PR | What |
|----|------|
| #1068 | Webhook guide docs + Deal enrichment (external_deal_id, ido_key, partner_response, internal_raw_code) + base workflow vars |
| #1069 | Sticky left-nav sidebar on /docs/webhook-guide (OpCenter-style) — `WebhookGuideSidebar.tsx` |
| #1070 | Business address vars + signed-PDF forwarding + **filter-before-send guard** + created/updated timestamps |
| #1071 | Wire entity_type/filer_type into webhook API + `{deal.companyEin}` |
| #1072 | `{deal.filingStatus}` var + API wiring |
| #1073 | Log outbound webhook posts → Deal.rawPayload (WEBHOOK_OUT) + WebhookRequestLog (API logs) |
| #1074 | Resolve `{deal.signedPdfMirrorUrl}` alias (was empty) |

### Core pieces
- **`deriveDealWorkflowFields(deal)`** in `src/lib/workflow-engine.ts` — surfaces serviceFields-derived tokens as flat keys; spread onto deal before `fireWorkflowTrigger`.
- **Filter-before-send fix**: actions no longer execute when filters fail; filtered runs log "filtered out / Did not meet filter requirements" (amber), not "failed".
- **SignWell completion** now fires `deal.stage_changed` → signed PDF forwardable.
- **Outbound webhooks** append to Deal.rawPayload (green "→ OUT" badge w/ status + response) AND write WebhookRequestLog(direction=outgoing).

## 🔄 In flight / OPEN
1. **`prisma db push` STILL PENDING on prod** — now covers: #1068 Deal columns (external_deal_id, ido_key, partner_response, internal_raw_code) + #1076 AiMemory table + #1081 User 2FA columns (totpSecret, totpEnabled, totpPendingSecret, totpBackupCodes). ONE push lands all. Auto-classifier blocked Claude. Run manually with the prod (unpooled) Neon `DATABASE_URL` via `vercel env pull` — do NOT commit the credential.
2. **True Blob PDF mirror** — #1074 aliases signedPdfMirrorUrl to the *expiring* SignWell URL. Real fix: upload PDF to Vercel Blob on SignWell completion, store `serviceFields.signedPdfMirrorUrl`.
3. **2026-05-27 AI chat work** on `claude/mobile-bottom-nav` (`d7ac792`) still needs its own PR (unified widget + AiMemory).

## 🎯 What's next
1. Run the prod `prisma db push` — required before #1068 fields work in production
2. Configure the OpCenter-forwarding workflow in admin: trigger `deal.stage_changed`, filter `{deal.agreementStatus}` = `completed`, body = template in /docs/webhook-guide
3. Optionally build the persistent Blob PDF mirror

## 🧠 Variable cheat-sheet (Fintella token → OpCenter field)
- `{deal.entityType}`→entity_type · `{deal.companyEin}`→ein · `{deal.filerType}`→filer_type · `{deal.filingStatus}`→filing_status
- `{deal.signedPdfMirrorUrl}` (or signedPdfUrl)→agreement_pdf_url · `{deal.agreementStatus}`→agreement_status · `{deal.signwellDocumentId}`→signwell_document_id
- `{deal.createdAt}`/`{deal.updatedAt}`→created_at/updated_at (also echoed in POST/PATCH responses)
- `{deal.businessAddress}`, `{deal.referralPartnerName}`, `{deal.dealUrl}`, `{deal.partnerCode}`, `{deal.dealName}`, `{deal.serviceOfInterest}`, `{deal.clientName/clientEmail/clientPhone}`, `{deal.legalEntityName}`, `{deal.consultBookedDate/Time}`
- **Tokens use single-brace `{deal.x}`** in webhook bodies (not `{{snake_case}}` — those are doc-display only).

## 📂 Relevant files
- `src/lib/workflow-engine.ts` — deriveDealWorkflowFields, TRIGGER_VARIABLES, filter guard, webhook.post + outbound logging
- `src/app/api/webhook/referral/route.ts` — POST/PATCH capture entity/filer/filing, response echoes, deal.created/stage_changed enrichment
- `src/app/api/signwell/webhook/route.ts` — fires deal.stage_changed on signing completion
- `src/app/api/admin/deals/[id]/route.ts` — admin stage-change trigger enrichment
- `src/lib/appendDealPayload.ts` — WEBHOOK_OUT event type + outbound metadata
- `src/app/(admin)/admin/deals/page.tsx` — Raw Source Payloads dropdown (renders WEBHOOK_OUT)
- `src/app/docs/webhook-guide/page.tsx` + `WebhookGuideSidebar.tsx` — dev docs
