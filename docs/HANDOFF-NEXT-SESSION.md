# Handoff — Next Session (Fintella Partner Portal)

_Last updated: 2026-05-29 (late). Resume from ANY machine: `git pull`, then read `.claude/session-state.md` (▶️ RESUME HERE)._

## Step 0 — startup
- `git pull` your tariff-partner-portal clone, `npm install` (new deps this session: `otplib`, `qrcode`, `@types/qrcode`), `npx prisma generate`.
- No tool restart required.

## State
- `main` has 13 PRs merged (#1068–#1079, #1081). Prod schema is in sync (Vercel build runs `prisma db push` on each deploy).
- Open: one docs/session-state PR (this branch) — merge it.

## Prioritized to-dos
1. **Verify prod schema in sync** (should already be):
   - `vercel env pull .env.production.local --environment=production`
   - Load it, map `STORAGE_DATABASE_URL_UNPOOLED` → `DATABASE_URL` by variable (never inline the credential), then `npx prisma db push`. Delete the env file after.
   - Expect "already in sync" (Deal cols, AiMemory, User 2FA cols).
2. **Test admin 2FA**: `/admin/account` → enable 2FA → scan QR → save backup codes → log out → log in with TOTP. Also test "Continue with Google" for an admin email.
3. **OpCenter webhook**: create a workflow on `deal.stage_changed`, filter `{deal.agreementStatus}` = `completed`, webhook body per `docs/knowledge/webhook-workflow-variables.md`; validate with the live token **Preview** button before saving.
4. Optional phase-2: enforce 2FA per role; webhook "golden payload" diff; admin passkeys.

## Reference
- Webhook/OpCenter field map + token list: `docs/knowledge/webhook-workflow-variables.md`
- Full session record: `terminal-logs/2026-05-29-session1-webhook-vars-and-admin-auth.md`
- CodeQL-safe patterns (SSRF/ReDoS/biased-random) documented in the terminal log.

## Gotchas
- OpCenter is a SEPARATE repo — never edit/push it from this terminal.
- Webhook body tokens are single-brace `{deal.x}`; `{{snake_case}}` is doc-display only.
- `.env.production.local` is gitignored — never commit the Neon credential.
