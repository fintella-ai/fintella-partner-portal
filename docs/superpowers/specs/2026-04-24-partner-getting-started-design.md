# Partner Getting Started Flow — Design

**Date:** 2026-04-24
**Author:** Claude Opus 4.7 (goku+beast mode, authorized by John)
**Status:** Proposed

## Problem

New partners land in the portal with no guidance on what to do first. The sidebar has 11+ items, the home page has drag-reorderable content modules, and there are several core flows (agreement, profile, payouts, referrals, downline, training, Live Weekly calls) that every partner should touch in their first week. Today a new partner has to figure out that order themselves — many never sign up for Stripe, never join a Live Weekly call, never submit a client. We need a lightweight, data-driven checklist that meets partners at the top of home, pushes them toward each critical first action, and reinforces what we expect of them as a Fintella referral partner.

## Goals

1. **Clear "do this next" guidance** on the partner home page — the first thing they see.
2. **Progressive checklist** that derives state from real DB signals (so completion can't be faked or lost) with small supplementary JSON state for actions the DB doesn't track (e.g., "watched welcome video").
3. **Push hard to Live Weekly calls** — calls are where partners actually learn the product and build rapport with Fintella ops.
4. **Set explicit expectations** — what it means to be a Fintella referral partner (cadence, conduct, responsiveness).
5. **Auto-hide on completion**, toggle back on if a partner wants to revisit.

## Non-goals

- Not a full product tour / overlay tour. That's a future enhancement.
- Not gamified with points/streaks. That's a future enhancement.
- Not editable by admins in this first cut (beyond the existing home-page content controls and the new `gettingStartedExpectations` markdown field). Full admin CMS for the checklist can follow if valuable.

## UX

### A. Home-page checklist module

- New home-page module with id `getting_started`, default-inserted at position 0 in `homeModuleOrder`.
- Renders only when `progressPercent < 100` AND `onboardingState.dismissed !== true`.
- Card with:
  - Gold-accented header: "Getting Started — X of 9 complete" + thin gold progress bar
  - 9 rows (see "Checklist steps" below). Each row:
    - Status icon: filled gold check (done), hollow gold circle (ready), gray lock with tooltip (locked by prereq)
    - Title + one-sentence description
    - Primary CTA button on the right: "Start", "Continue", or "View" — routes to the relevant feature or opens the agreement signing URL in a new tab
    - Done rows render collapsed (just title + gold check) to reduce visual noise
  - Footer link: "Hide this until I'm ready" → PATCH `onboardingState.dismissed=true`
  - Celebration state (temporary, 3 seconds) on final completion: "You're all set 🎉" → then the module auto-hides.

### B. Dedicated `/dashboard/getting-started` route

- Hero: "Welcome, {firstName} — here's how to get the most out of Fintella" + progress ring (`{completed}/9`)
- Full-width checklist (same component as home module, but expanded-by-default)
- **"What we expect of you as a Fintella partner"** section — long-form markdown (rendered from `PortalSettings.gettingStartedExpectations`, with a hardcoded default below). Covers:
  - Activity cadence (aim for at least one referral per month)
  - Live Weekly attendance (join at least one a month, ideally weekly)
  - Responsiveness to clients (respond within 24 hours)
  - Referral ethics (don't misrepresent Fintella services or partner firms)
  - Keep profile + payout info current
  - Keep SMS/email opt-ins aligned with how you want to be reached
- **"Jump on a Live Weekly call"** prominent CTA banner at the bottom — always shown, wired to `/dashboard/conference`.

### C. Sidebar nav

- New `getting-started` entry in `MAIN_NAV` (partner layout) and `ALL_NAV_ITEMS` (admin settings registry, per the "update registry too" feedback rule).
- Icon: ⭐ (gold star — stands out, reinforces "the important starter"). Label: "Getting Started". Short label: "Start".
- Default position: second item (after Home).
- Admin can reorder/hide in the navigation editor like any other item.
- Show-to-partner logic: always render the nav entry; the route itself renders a "You're all set — here's what's next" state when the partner is 100% complete (with quick links back to the core features + Live Weekly).

## Data

### Schema change

```prisma
model Partner {
  // ... existing fields
  onboardingState String @default("{}") // JSON: { dismissed, watchedWelcomeVideoAt, firstCallJoinedAt, firstTrainingCompletedAt, referralLinkSharedAt, completedAt }
}

model PortalSettings {
  // ... existing fields
  gettingStartedExpectations String? // markdown shown on the /dashboard/getting-started page
}
```

Both are strictly additive (safe for `prisma db push`, no data migration needed).

### Checklist steps

Each step resolves to `{ id, title, description, ctaLabel, ctaUrl, status: "done" | "ready" | "locked", done: boolean }`. Computation happens in `src/lib/getting-started.ts::computeGettingStarted(partnerCode)`:

| # | Step | id | Signal | Lock |
|---|------|----|--------|------|
| 1 | Sign your Partnership Agreement | `sign_agreement` | `PartnershipAgreement.status in ("signed","amended")` OR `Partner.status === "active"` | — |
| 2 | Complete your profile | `complete_profile` | `PartnerProfile` exists with non-empty address fields (street, city, state, zip) | Agreement signed |
| 3 | Add your payout info | `add_payout` | `PartnerProfile.payoutMethod` set AND required fields for that method are filled, OR `StripeAccount.status === "active"` | Profile done |
| 4 | Watch the welcome video | `watch_video` | `onboardingState.watchedWelcomeVideoAt` is set (fired by client on `<iframe>` play or explicit "Mark as watched" button) | Agreement signed |
| 5 | Join a Live Weekly call | `join_call` | `onboardingState.firstCallJoinedAt` is set (fired server-side on first visit to `/dashboard/conference` with an active call, or manual "I attended" toggle) | Agreement signed |
| 6 | Complete a training module | `complete_training` | `onboardingState.firstTrainingCompletedAt` is set (fired when partner marks any training module as complete) | Agreement signed |
| 7 | Share your referral link | `share_link` | `onboardingState.referralLinkSharedAt` is set (fired on first copy/share from `/dashboard/referral-links`) | Agreement signed |
| 8 | Submit your first client | `submit_client` | `prisma.deal.count({ where: { partnerCode } }) > 0` | Agreement signed |
| 9 | Invite your first downline partner | `invite_downline` | `prisma.partner.count({ where: { referredByPartnerCode: partnerCode } }) > 0` OR `prisma.recruitmentInvite.count({ where: { inviterCode: partnerCode } }) > 0` | Agreement signed |

Lock rule: steps 2–9 are soft-locked (visible but CTA disabled with tooltip "Sign your agreement first") until step 1 is done. This mirrors the existing agreement-gate on `submit-client` / `referral-links`.

Progress = count(done) / 9. `completedAt` fires when it hits 9 and stays set (re-opening later doesn't reset).

### API

- `GET /api/partner/getting-started` — returns `{ steps, progressPercent, completedCount, totalCount, dismissed, expectationsMarkdown }`. Computed on every read; cheap enough not to cache (handful of counts + a JSON parse).
- `PATCH /api/partner/getting-started` — body: `{ action: "dismiss" | "undismiss" | "mark_video_watched" | "mark_call_joined" | "mark_training_completed" | "mark_link_shared" }`. Updates `Partner.onboardingState`.

Both routes require session auth with a partnerCode (reuse the `/api/partner/settings` pattern).

## Components

- `src/lib/getting-started.ts` — `computeGettingStarted(partnerCode)`, `updateOnboardingState(partnerCode, patch)`, step definitions.
- `src/components/partner/GettingStartedChecklist.tsx` — shared checklist component (variant: `"home"` = compact, `"page"` = expanded).
- `src/components/partner/GettingStartedProgress.tsx` — progress bar + ring.
- `src/components/partner/PartnerExpectations.tsx` — renders `gettingStartedExpectations` markdown with a hardcoded default fallback (identical pattern to the existing sendgrid.ts template fallback).
- Home integration: add `case "getting_started": return renderGettingStarted();` to the home dispatcher; insert `"getting_started"` at the head of `DEFAULT_ORDER` in both `home/page.tsx` and `admin/settings/page.tsx`.
- Sidebar: add `{ id: "getting-started", href: "/dashboard/getting-started", icon: "⭐", label: "Getting Started", shortLabel: "Start" }` to `MAIN_NAV` (second position, after Home). Add `{ id: "getting-started", label: "Getting Started", icon: "⭐" }` to `ALL_NAV_ITEMS` in admin settings.

## Expectations (default markdown)

```md
## What it means to be a Fintella partner

As a Fintella referral partner, we ask a few things of you so we can earn together:

- **Aim for at least one qualified referral a month.** Steady activity beats sporadic bursts — consistent partners close more deals.
- **Join our Live Weekly calls.** Once a week is ideal. This is where you hear about new offers, ask questions, and learn what's working for other partners.
- **Respond to your clients within 24 hours.** They chose you because they trust you. Keep the trust by being responsive.
- **Represent Fintella and our partner firms honestly.** Don't overpromise outcomes; let our partner providers close the loop with the legal and procedural detail.
- **Keep your profile and payout info current.** We pay you fast when we have accurate information on file.
- **Stay in touch.** Respond to our emails and SMS so commissions, approvals, and new opportunities never get stuck.

You bring the relationships. We bring the platform, the partner firms, the workflow, and the payout. Let's build.
```

## Error handling

- API failures in `computeGettingStarted` (e.g., transient DB): fall back to a minimal "agreement signed? yes/no" step-list so the checklist never fully disappears.
- Missing PortalSettings: use the hardcoded default expectations markdown.
- Malformed `onboardingState` JSON: treat as `{}` (reset, don't error).

## Testing

- Manual: create a pending partner → load /dashboard/home → see 9-step checklist with only "Sign agreement" ready. Sign → see 8 steps unlock.
- Manual: dismiss from home → reload → checklist hidden on home but /dashboard/getting-started route still works.
- Manual: 100% complete → see celebration → auto-hide on home.
- Build: `./node_modules/.bin/next build` must still be 97/97 pages (plus 1 new route = 98).

## Rollout

- Single PR. Strictly additive schema. No flags — ship to prod when merged.
- Existing active partners see the checklist with most steps pre-filled (they've already signed, probably have deals). Those fully complete already → auto-hide on home.
- PortalSettings.gettingStartedExpectations left null; fallback markdown renders; admin can edit later via a future PR (not blocking).

## Deferred / future enhancements

- Admin CMS for the checklist (reorder, toggle steps, edit CTAs per portal).
- Per-step completion analytics (which steps stall partners the most).
- Gamification (streaks, badges, leaderboard tie-in).
- Automatic "please complete your getting-started checklist" email/SMS reminders via workflows (natural next step once this ships — the reminder engine already exists).
