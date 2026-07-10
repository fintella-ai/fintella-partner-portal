# Session State

## ▶️ RESUME HERE — NEXT STEPS
1. Nothing blocking — #1172 is merged and confirmed working live. Optional: decide whether to re-enroll 2FA on `admin@fintella.partners` (John disabled it himself 2026-07-10 to test the embed after losing his codes; found them shortly after but has not re-enabled).
2. If Google sign-in inside the OpCenter embed becomes a real need, build the popup-window OAuth workaround (see `docs/knowledge/opcenter-iframe-embed-auth.md`) — deferred by John since email/password already covers the embed use case.
3. 82 remote branches remain from prior sessions (59 with open PRs, 23 with no PR record) — still untouched pending individual review; not urgent. 10 open DRAFT PRs are daily `claude/tie-*` regulatory/competitive-intel automation reports (#1157–#1165, #1171) — routine, not action items.

🕒 Last updated: 2026-07-10 (evening) — OpCenter iframe-embed login fix shipped + verified live

## 🌿 Git state
- **Branch**: `main` @ `353d343d` (#1172 "fix(auth): allow login to persist when embedded cross-site in OpCenter's iframe" — LIVE at fintella.partners)
- **Working tree**: clean
- Pruned 7 stale merged local branches this session (no worktrees referenced them)

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
