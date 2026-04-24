/**
 * Client-side helpers that nudge the Getting-Started checklist forward when
 * a partner performs a real action that doesn't otherwise write to the DB
 * (watching the home video, joining a Live Weekly call via the Jitsi modal,
 * copying a referral link). Each helper fires PATCH /api/partner/getting-started
 * with the matching action. Fire-and-forget — if the checklist endpoint is
 * down or the partner is an admin impersonator, nothing user-visible breaks.
 *
 * Server-side marks (training completion) live in the respective API routes.
 */

type Action = "mark_video_watched" | "mark_call_joined" | "mark_training_completed" | "mark_link_shared";

function fire(action: Action): void {
  if (typeof window === "undefined") return;
  fetch("/api/partner/getting-started", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
    keepalive: true,
  }).catch(() => {});
}

export function markGettingStartedVideoWatched(): void { fire("mark_video_watched"); }
export function markGettingStartedCallJoined(): void { fire("mark_call_joined"); }
export function markGettingStartedTrainingCompleted(): void { fire("mark_training_completed"); }
export function markGettingStartedLinkShared(): void { fire("mark_link_shared"); }
