# Terminal Log — 2026-05-29 — Webhook variables, OpCenter integration & admin auth

**Repo:** tariff-partner-portal · **Branch end state:** `main` (post-merge) · **Mode:** Beast Mode

## Shipped (13 PRs merged, squashed to main)
| PR | Feature |
|----|---------|
| #1068 | Webhook guide docs + Deal enrichment (external_deal_id, ido_key, partner_response, internal_raw_code) |
| #1069 | Sticky left-nav sidebar on /docs/webhook-guide (`WebhookGuideSidebar.tsx`) |
| #1070 | Business address vars + signed-PDF forwarding + **filter-before-send guard** + created/updated timestamps |
| #1071 | Wire entity_type/filer_type into webhook API + `{deal.companyEin}` |
| #1072 | `{deal.filingStatus}` var + API wiring |
| #1073 | Log outbound webhook posts → Deal.rawPayload (WEBHOOK_OUT) + WebhookRequestLog |
| #1074 | Resolve `{deal.signedPdfMirrorUrl}` alias |
| #1075 | Session-state checkpoint |
| #1076 | Unified AI chat widget + per-user cloud memory (AiMemory model) |
| #1077 | Live token preview in workflow editor (previewInterpolate + /api/admin/workflows/preview) |
| #1078 | Persistent Blob PDF mirror (downloadCompletedPdf → Vercel Blob → serviceFields.signedPdfMirrorUrl) |
| #1079 | Outbound webhook dashboard + one-click resend (/api/admin/dev/resend-webhook) |
| #1081 | Opt-in admin 2FA (TOTP via otplib) + Google OAuth for admins |

## Schema changes (additive; prod synced via Vercel build `prisma db push`)
- Deal: `external_deal_id`, `ido_key` (@unique), `partner_response` (Json), `internal_raw_code`
- New model `AiMemory` (per-user cloud memory)
- User: `totpSecret`, `totpEnabled` (default false), `totpPendingSecret`, `totpBackupCodes`

## Key architecture
- `deriveDealWorkflowFields(deal)` in `src/lib/workflow-engine.ts` surfaces serviceFields-derived tokens (entityType, filerType, filingStatus, businessAddress, signedPdfUrl, signedPdfMirrorUrl, agreementStatus, signwellDocumentId) as flat keys — spread onto deal before `fireWorkflowTrigger`.
- Webhook body tokens are **single-brace** `{deal.x}` (interpolate/getNestedValue). The `{{snake_case}}` tokens in doc tables are display-only.
- Filter-before-send: actions only run when filters pass; filtered runs log "filtered out" (amber), not "failed".
- SignWell completion fires `deal.stage_changed` and mirrors the signed PDF to Vercel Blob.

## CodeQL gotchas hit + fixed (this repo is strict)
- **request-forgery (SSRF):** boolean-helper guards are NOT recognized as barriers. Fix = fetch from a CONSTANT base URL (e.g. `downloadCompletedPdf` against `SIGNWELL_API_BASE`), or inline parse + private-IP block then fetch the URL object (api-proxy pattern). Reused api-proxy guard for the resend route.
- **polynomial-redos:** `[^}]+` token regex → use `[^{}]+` (linear).
- **biased-cryptographic-random:** `randomBytes()[i] % n` → use `crypto.randomInt(n)`.

## Open / next session
- Verify prod `prisma db push` in sync (build pipeline applies it); enroll in 2FA at /admin/account.
- OpCenter field map: see `docs/knowledge/webhook-workflow-variables.md`.
- 2026-05-27 AI chat held-branch (`claude/mobile-bottom-nav`) work was shipped via #1076.

## Notable
- OpCenter repo NOT touched — Fintella only emits the field names OpCenter reads.
- `vercel env pull` credential file (`.env.production.local`) is gitignored; removed after use.
