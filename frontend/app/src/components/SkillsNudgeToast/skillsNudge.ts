/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Client-side helpers for the in-app "install skills" nudge.
 *
 * The nudge's *visibility* is owned by ``App`` (it depends on the per-session
 * ``recommendSkillsInstall`` flag and React state), but everything here is pure —
 * the ``localStorage`` snooze/dismiss flags, the dropped-connection
 * classification, and the telemetry labels an install outcome maps to — so it can
 * be unit tested in isolation and kept out of the already-large ``App`` component.
 *
 * Keeping the label functions here also keeps the whole emitted vocabulary in one
 * file, including the ``refused:`` marker the server namespaces gate refusals
 * with, which no other module needs to know about.
 */

import {
  CONNECTION_CLOSED_MESSAGE,
  getBackendOperationReason,
  REQUEST_TIMED_OUT_MESSAGE,
} from "@streamlit/lib"
import { localStorageAvailable } from "@streamlit/utils"

/**
 * localStorage key recording that the user permanently dismissed the
 * skills-install nudge in this browser ("Don't show again"). The nudge is
 * suppressed if this flag OR the server-side marker file is set; both are
 * written when the user picks "Don't show again".
 */
export const SKILLS_NUDGE_DISMISSED_KEY = "stSkillsNudgeDismissed"

/**
 * localStorage key recording the timestamp (ms) when the user snoozed the
 * nudge via the close (✕) button. While within the snooze window the nudge
 * stays hidden; it reappears on the next server start after the window lapses.
 */
export const SKILLS_NUDGE_SNOOZED_AT_KEY = "stSkillsNudgeSnoozedAt"

/** How long the close (✕) button snoozes the nudge for: 24 hours. */
export const SKILLS_NUDGE_SNOOZE_MS = 24 * 60 * 60 * 1000

/**
 * User-facing message shown when an install request is rejected by a dropped or
 * timed-out connection. The server install may well have completed, so the
 * copy reassures the user and points them to a safe, idempotent retry.
 */
export const SKILLS_NUDGE_DROPPED_MESSAGE =
  "Lost connection during install — it may have finished. Reconnect or try again."

/**
 * Whether the skills nudge has been permanently dismissed in this browser
 * ("Don't show again"). The nudge is suppressed if EITHER this localStorage
 * flag OR the server-side marker is set (the marker gates
 * ``recommendSkillsInstall`` on the backend).
 */
export function isSkillsNudgeDismissed(): boolean {
  return (
    localStorageAvailable() &&
    window.localStorage.getItem(SKILLS_NUDGE_DISMISSED_KEY) === "true"
  )
}

/**
 * Whether the nudge was snoozed (closed via ✕) within the last 24h. Once the
 * window lapses it shows again on the next server start.
 */
export function isSkillsNudgeSnoozed(): boolean {
  if (!localStorageAvailable()) {
    return false
  }
  const snoozedAt = Number(
    window.localStorage.getItem(SKILLS_NUDGE_SNOOZED_AT_KEY)
  )
  const elapsed = Date.now() - snoozedAt
  return (
    Number.isFinite(snoozedAt) &&
    snoozedAt > 0 &&
    // Guard against a future timestamp (e.g. clock skew / a clock set back): a
    // negative elapsed would otherwise read as "still snoozed" and suppress the
    // nudge until real time catches up to snoozedAt + window.
    elapsed >= 0 &&
    elapsed < SKILLS_NUDGE_SNOOZE_MS
  )
}

/** Persist the permanent browser-side "don't show the nudge again" flag. */
export function setSkillsNudgeDismissed(): void {
  if (localStorageAvailable()) {
    window.localStorage.setItem(SKILLS_NUDGE_DISMISSED_KEY, "true")
  }
}

/** Persist the ✕ snooze timestamp so the nudge stays hidden for the window. */
export function setSkillsNudgeSnoozed(): void {
  if (localStorageAvailable()) {
    window.localStorage.setItem(
      SKILLS_NUDGE_SNOOZED_AT_KEY,
      String(Date.now())
    )
  }
}

/**
 * Whether a rejected install was caused by a dropped or timed-out connection
 * rather than a genuine install failure. In that case the server install may
 * have completed, so callers should count it separately in telemetry and show
 * the reassuring {@link SKILLS_NUDGE_DROPPED_MESSAGE} instead of a hard error.
 */
export function isSkillsNudgeDroppedConnection(error: unknown): boolean {
  const message = error instanceof Error ? error.message : ""
  return (
    message === CONNECTION_CLOSED_MESSAGE ||
    message === REQUEST_TIMED_OUT_MESSAGE
  )
}

/**
 * Prefix of the server's non-loopback suppression reasons, e.g.
 * ``non_loopback_private``. Stripped when building the legacy label below.
 */
const NON_LOOPBACK_REASON_PREFIX = "non_loopback_"

/**
 * The `menuClick` label for a nudge the server withheld, given its reason.
 *
 * Non-loopback suppression keeps the original
 * ``skillsNudgeSuppressedNonLocal:<locality>`` label it has emitted since 1.59,
 * and every other reason gets ``skillsNudgeSuppressed:<reason>``. Two families
 * rather than one on purpose:
 *
 * - The existing label is load-bearing for the adoption funnel, whose "eligible"
 *   population is `shown ∪ suppressedNonLocal` and whose eligible→shown gap is
 *   defined as the loopback gate's own drop-off. Renaming it would break that
 *   silently — the event log keeps old rows forever and clients upgrade over
 *   months, so both forms would arrive for a long time.
 * - The two suppressions are different in kind. Non-loopback is a *reach* limit
 *   (eligible, but we won't surface a CTA in a possibly-shared app); a conflict
 *   is a *broken state* (the install cannot succeed). Sharing one label would
 *   pool them into a bucket every consumer then has to separate again.
 *
 * A reason without the non-loopback prefix falls through to the generic label,
 * so a new server-side reason is classified correctly with no change here.
 */
export function skillsNudgeSuppressedLabel(reason: string): string {
  return reason.startsWith(NON_LOOPBACK_REASON_PREFIX)
    ? `skillsNudgeSuppressedNonLocal:${reason.slice(NON_LOOPBACK_REASON_PREFIX.length)}`
    : `skillsNudgeSuppressed:${reason}`
}

/**
 * Telemetry label for a successful install.
 *
 * A `fallbackReason` means the server rerouted a project install to a global copy
 * and named why (a bounded set — see `fallback_reason` in the proto). It becomes a
 * label suffix because a fallback install is otherwise indistinguishable from a
 * project install in the success telemetry, and the causes point at different
 * fixes — only Developer Mode being off is something a user can simply turn on.
 *
 * `degradedTargets` names any *best-effort* install target whose write failed while
 * every authoritative target succeeded — the install reached the agent, so it is a
 * success, but a target we still write did not land. It goes in a THIRD segment so
 * segment 2 keeps meaning `fallbackReason` for every existing query. A degraded
 * install with no fallback therefore emits an empty segment 2
 * (`skillsNudgeInstallSucceeded::agents_skills`), which is exactly what a plain
 * success yields for that segment today — deliberate, so `split_part(label, ':', 2)`
 * keeps returning the same thing it always has.
 */
export function skillsNudgeInstallSuccessLabel(
  fallbackReason?: string | null,
  degradedTargets?: string | null
): string {
  if (!fallbackReason && !degradedTargets) {
    return "skillsNudgeInstallSucceeded"
  }
  const base = `skillsNudgeInstallSucceeded:${fallbackReason ?? ""}`
  return degradedTargets ? `${base}:${degradedTargets}` : base
}

/**
 * Prefix the server puts on an `error_reason` when a safety gate *refused* the
 * install before attempting it (headless server, no agent harness, non-loopback
 * connection) rather than an install that ran and failed. The server owns which
 * reasons are refusals — we only strip the prefix — so a gate added there needs no
 * change here. Mirrors `_REFUSED_REASON_PREFIX` in `backend_operation_handler.py`.
 */
const REFUSED_REASON_PREFIX = "refused:"

/**
 * Telemetry label for an install the server rejected.
 *
 * Splits two outcomes the funnel must not conflate: an install that *ran and
 * failed*, and one a safety gate *refused* before touching the filesystem —
 * refusals get their own event so they never inflate the genuine failure rate.
 * Either way the server's machine-readable reason becomes a label suffix,
 * mirroring `skillsNudgeSuppressedNonLocal:<locality>`, so outcomes split by cause
 * (e.g. `skillsNudgeInstallFailed:write_denied`). Reasons are a fixed server-side
 * vocabulary, never user input, so they are safe to emit verbatim.
 *
 * Callers must check {@link isSkillsNudgeDroppedConnection} first — a dropped
 * connection is neither outcome and is counted separately.
 */
export function skillsNudgeInstallFailureLabel(error: unknown): string {
  // getBackendOperationReason already narrows to a non-empty string, so an older
  // backend that omits error_reason lands on the bare label below.
  const reason = getBackendOperationReason(error) ?? ""
  const isRefusal = reason.startsWith(REFUSED_REASON_PREFIX)
  const event = isRefusal
    ? "skillsNudgeInstallRefused"
    : "skillsNudgeInstallFailed"
  // Strip the marker so the label reads `...Refused:non_loopback`.
  const cause = isRefusal ? reason.slice(REFUSED_REASON_PREFIX.length) : reason
  return cause ? `${event}:${cause}` : event
}
