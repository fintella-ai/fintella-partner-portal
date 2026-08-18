# Session State

## ▶️ RESUME HERE — NEXT STEPS
1. **Review draft PR #1202** (`claude/tie-regulatory-update-2026-08-01`) — TIE regulatory monitor run for Aug 1, 2026. CI fully green (5/5 checks), no review comments. Three data changes + one code change. Full details in `docs/regulatory-monitor/2026-08-01.md`.
2. **Watch CAPE Phase 3 (Aug 4, 2026)** — CBP progress report due Aug 4. If Phase 3 opens to non-litigants, the `litigation` path in `checkEligibility()` may need a new `cape_phase3` filing method. Next regulatory monitor run will catch this.
3. **Section 301 per-country detail (follow-on PR)** — Seed data uses aggregate tier entries (S301-10PCT, S301-125PCT). Per-country breakdown requires parsing all 101 Chapter 99 headings from FR 2026-15181.
4. Optional: decide whether to re-enroll 2FA on `admin@fintella.partners` (John disabled it himself 2026-07-10 to test the embed; found codes shortly after but has not re-enrolled).
5. If Google sign-in inside the OpCenter embed becomes a real need, build the popup-window OAuth workaround (see `docs/knowledge/opcenter-iframe-embed-auth.md`) — deferred by John.
6. 82 remote branches remain from prior sessions (59 with open PRs, 23 with no PR record) — untouched pending individual review; not urgent. 11 open DRAFT PRs are daily `claude/tie-*` automation reports (#1157–#1165, #1171, #1202) — routine, not action items.

🕒 Last updated: 2026-08-01 (morning, automated regulatory monitor run)

## 🌿 Git state
- **Branch**: `main` @ `d46f8758` (#1174 "fix(pwa): use the F brand mark for the installed-app icon" — deployed to fintella.partners)
- **Feature branch**: `claude/tie-regulatory-update-2026-08-01` @ `786d9af` — draft PR #1202 open, CI green (5/5), no review comments
- **Working tree**: clean

## ✅ What's done (this session, 2026-07-10 evening — later)
- **#1174** — PWA installed-app icon reverted to the compact **F** brand mark. `/api/icon` (used by the manifest icons + `apple-touch-icon`) was preferring `logoUrl` (the full horizontal logo WITH text), which looks wrong cropped square on a home screen. Now it uses `faviconUrl` (the square F mark), falling back to the gold **F** SVG; `logoUrl` is no longer used for the app icon. Browser-tab favicon (`/api/favicon`) was already the F and is unchanged. One file: `src/app/api/icon/route.ts`. `./node_modules/.bin/next build` clean.

## ✅ What's done (this session, 2026-07-10 evening)
- **#1172** — OpCenter (`opcenter.app`) embeds this portal's `/login` in a cross-site iframe. Login was reloading the login page instead of authenticating.
  - Root cause: NextAuth's default `SameSite=Lax` session/csrf/callback cookies are evaluated against the top-level site (`opcenter.app`), so they never survived the redirect back from a successful login POST made inside the iframe.
  - Fix: `src/lib/auth.ts` — production-only cookie override to `SameSite=None; Secure; Partitioned` (CHIPS) for session/callback/csrf cookies.
  - Fix: `src/middleware.ts` — added `Content-Security-Policy: frame-ancestors 'self' https://opcenter.app` (there was previously no framing restriction at all; scoped it now that cookies are cross-site-deliverable).
  - Verified: `./node_modules/.bin/next build` clean (97/97 pages) + John confirmed live embed login works with email/password.
  - **Known limitation, not fixed**: "Continue with Google" still fails inside the embed — Google's OAuth authorization endpoint itself returns 403 when it detects `Sec-Fetch-Dest: iframe` (anti-clickjacking policy, not something we control). Real fix would be a popup-window OAuth flow; John deferred it since email/password already works.

## 🧠 Context that matters for resuming
- OpCenter is embedding Fintella (and likely other) product surfaces via iframe under a "Partner OS" tab — expect more cross-site embed requests; the SameSite=None+Partitioned+scoped-frame-ancestors pattern here is the template.
- The `useSecureCookies` cookie override in `src/lib/auth.ts` is gated on `NODE_ENV === "production"` — local `next dev` (http) intentionally keeps default Lax cookies since Secure cookies can't be set over http anyway.
- John disabled 2FA on his own `admin@fintella.partners` account directly in prod (not via Claude) to test the embed after losing his authenticator codes; found them shortly after. Not currently re-enrolled — his call.

## 📂 Relevant files for the next task
- `src/lib/auth.ts` — NextAuth config, cookie overrides, Google signIn callback (invite-only gate)
- `src/middleware.ts` — auth gate + `withFrameAncestors()` CSP helper
- `docs/knowledge/opcenter-iframe-embed-auth.md` — pattern doc for this fix (see step 4d of rainbow checklist)
