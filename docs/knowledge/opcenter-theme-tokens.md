# OpCenter-matched theme tokens + backoffice rollout plan

Captured 2026-05-29. Source: live CSS bundle at `opcenter.app/_next/static/css/*.css`
(read-only fetch of the public site — the OpCenter **repo** is never read/edited
from this repo per the hard isolation rule).

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
