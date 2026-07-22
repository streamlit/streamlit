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
 * Client-side preference helpers for the in-app "install skills" nudge.
 *
 * The nudge's *visibility* is owned by ``App`` (it depends on the per-session
 * ``recommendSkillsInstall`` flag and React state), but the browser-local
 * preference logic — the ``localStorage`` snooze/dismiss flags and the
 * dropped-connection classification — is pure and lives here so it can be unit
 * tested in isolation and kept out of the already-large ``App`` component.
 */

import {
  CONNECTION_CLOSED_MESSAGE,
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
