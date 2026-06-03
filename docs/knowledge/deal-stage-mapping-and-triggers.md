# Deal Stage Mapping (HubSpot ↔ internal) + Stage-Change Triggers

Durable reference for how Frost Law's HubSpot pipeline stages map to our internal
`Deal.stage` enum, how incoming webhooks resolve them, and which workflow triggers
fire. Last updated 2026-06-03 (PRs #1126–#1129).

## HubSpot pipeline stage IDs → internal stage

`HUBSPOT_STAGE_MAP` in `src/app/api/webhook/referral/route.ts`:

| HubSpot stage (numeric ID) | Internal `Deal.stage` | Label (`STAGE_LABELS`) |
|---|---|---|
| Lead Submitted `3468521171` | `lead_submitted` | Lead Submitted |
| Meeting Booked `3468521172` | `meeting_booked` | Meeting Booked |
| Meeting Missed `3467318997` | `meeting_missed` | Meeting Missed |
| Qualified `3468521174` | `qualified` | Qualified |
| Disqualified `3468521175` | `disqualified` | Disqualified |
| Meeting Completed `3381784253` | `meeting_completed` | Meeting Completed |
| Gathering Information `3381784254` | `gathering_info` | Gathering Information |
| Contract Sent `3381784255` | `agreement_sent` | Agreement Sent |
| **Onboarding `3381784256`** | **`onboarding`** | Onboarding |
| Closed Won `3381784257` | `client_engaged` | Agreement Signed |
| **Closed Lost `3381784258`** | **`closedlost`** | Closed Lost |

### Key semantics (do not "fix" without product sign-off)
- **HubSpot "Closed Won" → `client_engaged`** (NOT our internal `closedwon`). Their
  front-end sales "Closed Won" means the client engaged/signed. Our true
  refund-received `closedwon` (the stage that auto-creates the commission ledger)
  is a separate, later, internal-only milestone — deferred. Confirmed by John 2026-06-03.
- **`closedlost`** (no underscore) is the canonical "Closed Lost" value. It was
  previously labeled "Disqualified"; relabeled to "Closed Lost" 2026-06-03. Synonyms
  `lost` / `closedlost` / `closed_lost` all normalize to `closedlost`.
- `onboarding` was previously collapsed into `client_engaged`; it is now its own stage.
- `unresponsive` was removed from the tariff stage picker (kept in `STAGE_LABELS`
  only so any legacy rows still render).

## How a webhook stage value resolves
`resolveInternalStage(external)` in the same file:
1. Try `HUBSPOT_STAGE_MAP[trimmed]` (numeric IDs).
2. Else normalize (`lowercase`, strip spaces/hyphens/underscores) and look up `STAGE_MAP`
   (built from `INTERNAL_STAGES` + a synonym table).
3. Else pass through lowercased.

### CRITICAL: PATCH must read `hs_pipeline_stage`
Frost Law's HubSpot sends the numeric stage as **`hs_pipeline_stage`** on PATCH
updates. The PATCH stage-extraction OR-chain must include `hs_pipeline_stage`
(+ `hsPipelineStage`, `pipeline_stage`, `dealstage`, `deal_stage`, `dealStage`,
`stage`, `Stage`, `pipelineStage`, `status`, `Status`). Omitting it silently
drops every stage update (the original "stage not updating" bug, fixed in #1127).
The POST/create path already covers these via its `get()` helper.

## Commission status by stage
`resolveCommissionStatus()` in `src/lib/commission.ts`:
- `disqualified` / `closedlost` → `lost`
- `closedwon` → `due` (if paymentReceivedAt) else `pending_payment`
- `gathering_info` / `agreement_sent` / `onboarding` / `client_engaged` / `in_process` → `projected`
- everything else → `null`

## Workflow triggers (`src/lib/workflow-engine.ts` → `TRIGGER_KEYS`)
Fired from BOTH the webhook PATCH and the admin deal-edit route on a stage change:
- `deal.stage_changed` — every stage move.
- `deal.onboarding` — when stage flips to `onboarding` (added #1129). First-class
  milestone trigger for client-onboarding sequences.
- `deal.closed_won` — when stage flips to `closedwon` (admin also fires on `completed`).
- `deal.closed_lost` — when stage flips to `closedlost` (also `disqualified`; admin also `denied`).

A new trigger must be added to all four maps (`TRIGGER_KEYS`, `TRIGGER_LABELS`,
`TRIGGER_DESCRIPTIONS`, `TRIGGER_VARIABLES`) — they are `Record<TriggerKey, …>` so
`tsc` enforces exhaustiveness. The admin Automations builder (`WorkflowsPanel.tsx`)
reads the registry directly, so new triggers surface automatically.

## Partner status email
`sendDealStatusUpdateEmail()` in `src/lib/sendgrid.ts` renders the FRIENDLY
`STAGE_LABELS[newStage].label` (e.g. "Onboarding", "Closed Lost"), not the raw key.

## Deal name follows legal entity name
When `legalEntityName` is set (admin PUT `/api/admin/deals/[id]` expanded view, OR a
webhook PATCH), `dealName` is forced to equal it — the table label tracks the legal
entity everywhere. At creation, `dealName = legalEntityName || "First Last" || email`.

## Stage picker surfaces (keep in sync when stages change)
- `STAGE_LABELS` + `INTERNAL_STAGES` (webhook) — canonical enum + labels.
- Admin `src/app/(admin)/admin/deals/page.tsx` `STAGES` array (tariff vs ERC split by
  exclusion list) — drives pills, stage tabs, filter dropdown, expanded-edit dropdown.
- Partner `src/app/(partner)/dashboard/deals/page.tsx` `PIPELINE_STAGES` / `KWONG_PIPELINE`.
