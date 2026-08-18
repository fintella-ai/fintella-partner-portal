# OpCenter-matched theme tokens + backoffice rollout plan

Captured 2026-05-29. Source: live CSS bundle at `opcenter.app/_next/static/css/*.css`
(read-only fetch of the public site — the OpCenter **repo** is never read/edited
from this repo per the hard isolation rule).

## ✅ SHIPPED — public marketing OLED rollout (PR #1101, `8a71dfe`, 2026-05-29)
The PUBLIC marketing shell now wears this look in prod. **Reuse this exact mechanism for the backoffice rollout below.**

**The pattern that worked (low-risk, no global-token edits):**
- A scoped `.oc-launch` block in `src/app/globals.css` **re-points the `--app-*` and `--brand-gold` CSS custom properties locally**. Custom properties cascade from the nearest ancestor, so any element under an `.oc-launch` root reads OLED values while the global `:root` defs (the live backoffice) stay byte-for-byte untouched. Token-driven markup (`var(--app-*)`, `.card`, `.btn-gold`, `.stat-card`) re-skins automatically.
- Reusable kit: `src/components/marketing/` (MarketingShell, MarketingAtmosphere, Eyebrow, GradientText, GlassCard, StatCard, FeatureIcon). Utilities under `.oc-launch`: `.oc-gradient-text` (violet→sky→cyan), `.oc-eyebrow`, `.oc-glass`/`--hover`, `.oc-feature-icon`, `.oc-stat-value`, `.oc-cta`/`--violet`.
- Per-page recipe: add `oc-launch oc-grid relative overflow-hidden` to the root → `<MarketingAtmosphere/>` as first child → wrap content in `<div className="relative z-10">` → polish (GradientText hero key-phrase, Eyebrow kicker, white/violet pill CTAs, glass cards). landing-v2 used a `landing.css` OLED rewrite + `oc-launch` on `.landing-root`.
- Fonts already loaded via `@import` in globals.css (Syne/Geist) + `.oc-launch .font-display`→Syne — **did NOT need `next/font`** (avoided a risky global `layout.tsx` edit).
- Canonical accent: violet **#7c3aed** (NOT the earlier flat #8b5cf6). OLED surface **#050507**.

**Gotchas learned (don't repeat):**
1. Never put `*/` inside a CSS comment (e.g. writing `--app-*/--brand-gold`) — it closes the comment early and breaks the **app-wide** compile. CI "Vercel SUCCESS" did NOT catch it because this project **cancels all preview deployments**; only a local `next dev` + screenshot caught it.
2. No reachable Vercel preview here → verify visually with `./node_modules/.bin/next dev` + Playwright, never assume the green check means it renders.
3. NEVER `npm run build` to verify (it `prisma db push`-es the live DB) — use `next dev`/`next build` directly. Worktrees need `ln -sfn ../tariff-partner-portal/node_modules node_modules`.

For the BACKOFFICE rollout, apply the SAME scoped approach but behind `data-portal-theme="opcenter"` (opt-in, reversible) per the plan below — do not overwrite the `default` theme tokens.

## Real OpCenter design tokens

| Token | Value | Notes |
|---|---|---|
| Display / heading font | **Syne** (700) | `var(--font-display)` → `"Syne", ...` |
| Body / UI font | **Geist Sans** | `var(--font-sans)` |
| Mono font | **Geist Mono** | `var(--font-mono)` |
| Page background | **`#09090b`** (zinc-950) | also `#0c0c10` for near-black surfaces |
| Card surface | **`#0c0c10`** | subtle border `rgba(255,255,255,0.10)` |
| Primary accent / CTA | **`#8b5cf6`** (violet-500) | most-used hex in the bundle |
| Secondary palette | pink `#ec4899` · sky `#38bdf8` · emerald `#34d399` · amber `#fbbf24` | vibrant multi-hue |
| Muted text | `#9ca3af` (gray-400) | |
| Button text on accent | white | (not dark) |

Fintella's *previous* landing tokens were navy `#060a14` + gold `#c4a050` +
DM Serif Display / Inter. The match swaps: bg→`#09090b`, accent→`#8b5cf6`,
display→Syne, body→Geist.

## What shipped (landing only)

The public tariff funnel landing (`/recover/tariff-diy` + `EngageFlow`,
`TariffDemoShowcase`, `SavingsCalculator`) is OpCenter-matched. Implementation:

- Fonts added **additively** to the Google Fonts `@import` in `globals.css`
  (Syne + Geist + Geist Mono) — adding families changes nothing that doesn't
  reference them.
- A **scoped** `.oc-launch` block in `globals.css` sets Geist body + Syne
  `.font-display` + Geist Mono, so the cascade only affects elements under the
  landing's `<main class="oc-launch">`.
- The landing components use violet `#8b5cf6` + zinc `#09090b`/`#0c0c10`
  inline; semantic state colors (emerald/amber/red) were already on-palette.

## ⚠️ Backoffice rollout (admin + partner) — DELIBERATE, NOT YET DONE

John asked to refine the **backoffice (admin + partner)** themes toward
opcenter.app too. This is intentionally **deferred** as its own task because:

- The backoffice theme is driven by the global token system (`var(--app-*)`,
  `var(--brand-gold)`, `data-theme` light/dark, `data-portal-theme`) in
  `globals.css` + `ThemeProvider`. Those tokens style the **entire LIVE prod
  app** — changing them blindly risks regressing every admin/partner screen.
- Correct approach when picked up:
  1. Introduce OpCenter values as a **new selectable portal theme**
     (`data-portal-theme="opcenter"`) rather than overwriting `default`, so it's
     opt-in and reversible.
  2. Map the global semantic tokens (`--app-bg`, `--app-surface`,
     `--brand-gold` → accent, etc.) to the table above.
  3. Swap display/body fonts behind the same `data-portal-theme` guard so the
     default theme keeps DM Serif/Inter until John flips it.
  4. Audit admin + partner screens (light + dark) before making it default.
- Do **not** change `--brand-gold` or the default theme tokens directly on a
  live-prod commit without John's explicit go-ahead + a visual pass.

## ▶️ PLANNED — public-marketing OLED rollout (next session, Opus agents)

John wants the opcenter.app/launch look on the **public marketing shell**
(authenticated portal untouched). Run with Opus subagents, **screenshot-gated**
before every push. Adapt the spec to Fintella's stack — do NOT copy shadcn
`dark`/`text-foreground` verbatim (no `foreground` token; tailwind is
`darkMode:"media"`); use explicit `text-white`/`bg-[#050507]`; never change
global `darkMode` or `--app-*`/`--brand-gold`.

### Canonical pattern (from the OpCenter builder terminal)
- Root: `relative min-h-dvh bg-[#050507] text-white overflow-hidden`
- Glow blob: `absolute … w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none`
- Eyebrow: `text-xs uppercase tracking-[0.2em] text-violet-400/80 font-semibold`
- Body: `text-white/60 text-lg leading-relaxed`
- Stat card: `bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 text-center` (`text-4xl font-bold text-white` + `text-sm text-white/50`)
- Feature icon: `w-12 h-12 rounded-xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center`
- Glass card: `bg-white/[0.025] border border-white/[0.06]`
- Accent **#7c3aed** (violet-600); gradient text **violet→sky→cyan** L-to-R
- Fonts: **Syne 700/800** via `next/font/google` → `--font-display` + tailwind `fontFamily.display`; body **Geist Sans**. Apply headlines via `className="font-[family-name:var(--font-display)]"` (NOT the `font-display` utility — collides with the `.font-display{…DM Serif…!important}` rule).

### Steps
1. **Foundation first (shared files):** next/font in `layout.tsx`; tailwind `display` token; reusable `src/components/marketing/` (`MarketingShell`, `Eyebrow`, `GlassCard`, `StatCard`, `FeatureIcon`, `GradientText`). Keep scoped.
2. **Fan out (parallel Opus agents, one per page):** wrap existing content in `MarketingShell`, swap classes, **preserve all logic/DB/forms**. Screenshot each.

### Pages (public marketing only)
- `src/app/landing-v2/page.tsx` — FLAGSHIP (`/` redirects here). ⚠️ admin-editable + DB-driven; built on SHARED theme (`landing.css`, `var(--app-*)`, `var(--brand-gold)`, global `card`/`btn-gold`). Re-theme via a SCOPED wrapper overriding those classes only inside `.landing-root`; read `landing.css` first; never touch global token defs.
- `src/app/apply/page.tsx`, `pricing/page.tsx`, `partners/brokers/page.tsx`, `webinar/page.tsx`, `calculator/page.tsx`.
- `/recover/tariff-diy` already overhauled (#1097/#1098 merged). **PR #1099** (open) = the good gradient-glow look for it — merge early to fix the live flat-violet page, then align tariff-diy to #7c3aed + next/font during the rollout.
