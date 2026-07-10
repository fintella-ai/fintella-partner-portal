# OpCenter iframe embed — cross-site auth pattern

OpCenter (`opcenter.app`) embeds this portal in an iframe (its "Partner OS" tab, URL pattern `opcenter.app/embedded/<uuid>`, pointing at `https://fintella.partners/login` or deep links into the dashboard/admin). This makes every request from inside the embed a **cross-site** request from the browser's point of view — the top-level site is `opcenter.app`, not `fintella.partners`, even though the frame itself is same-origin with the rest of this app.

## Cookies must be SameSite=None to survive the embed

Browsers evaluate `SameSite` against the top-level site, not the immediate iframe. Auth.js/NextAuth's defaults (`SameSite=Lax`) are silently dropped on any request made from inside the OpCenter iframe — the cookie gets set, but never sent back on the next navigation. This looked like "login just reloads the login page" (see PR #1172, 2026-07-10): the POST to `/api/auth/callback/*` succeeded and set the session cookie, but the browser didn't attach it to the subsequent request, so `src/middleware.ts`'s auth check saw no session and bounced back to `/login`.

**Fix, in `src/lib/auth.ts`**: production-only cookie override (`useSecureCookies = NODE_ENV === "production"`) setting `sessionToken`, `callbackUrl`, and `csrfToken` cookies to:
```
sameSite: "none", secure: true, partitioned: true
```
`partitioned: true` adds the `Partitioned` attribute (CHIPS) so the cookie isn't treated as a third-party tracking cookie even under stricter browser cookie-blocking modes — it's scoped per top-level site, which is exactly what a legitimate iframe-embed session needs. Left untouched in local `next dev` since `Secure` cookies require HTTPS and dev runs over http.

**If you add a new NextAuth cookie type** (e.g. `pkceCodeVerifier`, `state`, `nonce` for a new OAuth provider) that also needs to work inside the embed, it needs the same `sameSite: "none", secure: true, partitioned: true` override — the `CookiesOptions` interface in `@auth/core` has one entry per cookie type, and unlisted ones fall back to Lax defaults (which will break the same way inside the iframe).

## Framing is now scoped, not wide open

Before this fix there was **no** `X-Frame-Options` or `Content-Security-Policy: frame-ancestors` at all — any site could iframe `/login`. Since SameSite=None widens the cross-site cookie surface, `src/middleware.ts` now sets `Content-Security-Policy: frame-ancestors 'self' https://opcenter.app` on every response via the `withFrameAncestors()` helper. If another trusted embedder needs to iframe this portal, add its origin to that header rather than removing the restriction.

## Google OAuth cannot be fixed the same way — it's blocked by Google, not us

"Continue with Google" still fails inside the OpCenter embed with a 403 ("don't have access"). This is **Google's own** anti-clickjacking policy on the OAuth authorization endpoint: Google inspects the `Sec-Fetch-Dest` header and refuses to render its sign-in/consent screen when it detects it's being loaded inside an iframe (`Sec-Fetch-Dest: iframe`), regardless of our CSP or cookie config. There is no server-side config on our end that changes this.

The only real fix is a **popup-window OAuth flow**: detect iframe context client-side (`window.top !== window.self`), have the Google button open a real popup/new tab that runs the full Google OAuth flow at the top level (Google only blocks *iframe* contexts, not popups), then sync the resulting session back into the iframe once the popup completes (`postMessage` from the popup to the iframe — same-origin, since both are `fintella.partners` — or the iframe polling `/api/auth/session`). **Not built as of 2026-07-10** — deferred since email/password login already works inside the embed and covers the immediate need.
