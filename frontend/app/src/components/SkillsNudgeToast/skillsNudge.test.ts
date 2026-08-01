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

import {
  CONNECTION_CLOSED_MESSAGE,
  REQUEST_TIMED_OUT_MESSAGE,
} from "@streamlit/lib"

import {
  isSkillsNudgeDismissed,
  isSkillsNudgeDroppedConnection,
  isSkillsNudgeSnoozed,
  setSkillsNudgeDismissed,
  setSkillsNudgeSnoozed,
  SKILLS_NUDGE_DISMISSED_KEY,
  SKILLS_NUDGE_SNOOZE_MS,
  SKILLS_NUDGE_SNOOZED_AT_KEY,
  skillsNudgeInstallFailureLabel,
  skillsNudgeInstallSuccessLabel,
  skillsNudgeSuppressedLabel,
} from "./skillsNudge"

describe("skillsNudge preferences", () => {
  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  describe("isSkillsNudgeDismissed", () => {
    it("is true only when the flag equals the string true", () => {
      expect(isSkillsNudgeDismissed()).toBe(false)
      window.localStorage.setItem(SKILLS_NUDGE_DISMISSED_KEY, "true")
      expect(isSkillsNudgeDismissed()).toBe(true)
    })

    it("is false for any other stored value", () => {
      window.localStorage.setItem(SKILLS_NUDGE_DISMISSED_KEY, "1")
      expect(isSkillsNudgeDismissed()).toBe(false)
    })
  })

  describe("setSkillsNudgeDismissed", () => {
    it("persists the permanent dismissal flag", () => {
      setSkillsNudgeDismissed()
      expect(window.localStorage.getItem(SKILLS_NUDGE_DISMISSED_KEY)).toBe(
        "true"
      )
    })
  })

  describe("isSkillsNudgeSnoozed", () => {
    const NOW = 1_700_000_000_000

    beforeEach(() => {
      vi.spyOn(Date, "now").mockReturnValue(NOW)
    })

    it("is false when never snoozed", () => {
      expect(isSkillsNudgeSnoozed()).toBe(false)
    })

    it("is true within the snooze window", () => {
      window.localStorage.setItem(
        SKILLS_NUDGE_SNOOZED_AT_KEY,
        String(NOW - (SKILLS_NUDGE_SNOOZE_MS - 1000))
      )
      expect(isSkillsNudgeSnoozed()).toBe(true)
    })

    it("is false once the snooze window has lapsed", () => {
      window.localStorage.setItem(
        SKILLS_NUDGE_SNOOZED_AT_KEY,
        String(NOW - SKILLS_NUDGE_SNOOZE_MS)
      )
      expect(isSkillsNudgeSnoozed()).toBe(false)
    })

    it("is false for a future timestamp (clock skew), not stuck snoozed", () => {
      window.localStorage.setItem(
        SKILLS_NUDGE_SNOOZED_AT_KEY,
        String(NOW + 60_000)
      )
      expect(isSkillsNudgeSnoozed()).toBe(false)
    })

    it("is false for a zero or non-numeric timestamp", () => {
      window.localStorage.setItem(SKILLS_NUDGE_SNOOZED_AT_KEY, "0")
      expect(isSkillsNudgeSnoozed()).toBe(false)
      window.localStorage.setItem(SKILLS_NUDGE_SNOOZED_AT_KEY, "not-a-number")
      expect(isSkillsNudgeSnoozed()).toBe(false)
    })
  })

  describe("setSkillsNudgeSnoozed", () => {
    it("persists the current timestamp", () => {
      vi.spyOn(Date, "now").mockReturnValue(12345)
      setSkillsNudgeSnoozed()
      expect(window.localStorage.getItem(SKILLS_NUDGE_SNOOZED_AT_KEY)).toBe(
        "12345"
      )
    })
  })

  describe("isSkillsNudgeDroppedConnection", () => {
    it.each([CONNECTION_CLOSED_MESSAGE, REQUEST_TIMED_OUT_MESSAGE])(
      "is true for the transport-level message %s",
      message => {
        expect(isSkillsNudgeDroppedConnection(new Error(message))).toBe(true)
      }
    )

    it("is false for a genuine install error", () => {
      expect(
        isSkillsNudgeDroppedConnection(new Error("install blew up"))
      ).toBe(false)
    })

    it("is false for a non-Error rejection even if the text matches", () => {
      // A bare string carrying the same text is not a transport error we raised,
      // so it must not be reclassified as a dropped connection.
      expect(isSkillsNudgeDroppedConnection(CONNECTION_CLOSED_MESSAGE)).toBe(
        false
      )
    })
  })

  describe("skillsNudgeSuppressedLabel", () => {
    it.each([
      ["non_loopback_private", "skillsNudgeSuppressedNonLocal:private"],
      ["non_loopback_other", "skillsNudgeSuppressedNonLocal:other"],
      ["non_loopback_unknown", "skillsNudgeSuppressedNonLocal:unknown"],
    ])("keeps the pre-existing label for %s", (reason, expected) => {
      // This label is load-bearing for the adoption funnel ("eligible" is
      // shown ∪ suppressedNonLocal) and has been emitted since 1.59. Renaming
      // it would silently break that: the event log keeps old rows forever and
      // clients upgrade over months, so both forms would coexist for a long
      // time. Pinned exactly, byte for byte.
      expect(skillsNudgeSuppressedLabel(reason)).toBe(expected)
    })

    it.each([
      ["conflict", "skillsNudgeSuppressed:conflict"],
      ["check_failed", "skillsNudgeSuppressed:check_failed"],
    ])("uses the generic label for %s", (reason, expected) => {
      expect(skillsNudgeSuppressedLabel(reason)).toBe(expected)
    })

    it("routes an unrecognized reason to the generic label", () => {
      // A reason added server-side needs no change here, and must never be
      // misfiled under the non-loopback label, which would pool a broken-state
      // suppression into the loopback gate's reach drop-off.
      expect(skillsNudgeSuppressedLabel("some_new_reason")).toBe(
        "skillsNudgeSuppressed:some_new_reason"
      )
    })

    it("does not treat a merely similar reason as non-loopback", () => {
      // Guards the prefix check against matching on a substring.
      expect(skillsNudgeSuppressedLabel("not_non_loopback")).toBe(
        "skillsNudgeSuppressed:not_non_loopback"
      )
    })
  })

  describe("skillsNudgeInstallSuccessLabel", () => {
    it("is the bare label when no reroute happened", () => {
      expect(skillsNudgeInstallSuccessLabel(undefined)).toBe(
        "skillsNudgeInstallSucceeded"
      )
      // An older backend omits fallback_reason; protobuf sends "" for an unset
      // string. Neither may produce a dangling ":" suffix.
      expect(skillsNudgeInstallSuccessLabel(null)).toBe(
        "skillsNudgeInstallSucceeded"
      )
      expect(skillsNudgeInstallSuccessLabel("")).toBe(
        "skillsNudgeInstallSucceeded"
      )
    })

    it("suffixes the reason a project install was rerouted to a global copy", () => {
      // The Windows cohort's diagnostic signal rides the SUCCESS label, because
      // they cannot lay symlinks, get rerouted, and then succeed.
      expect(skillsNudgeInstallSuccessLabel("symlinks_no_privilege")).toBe(
        "skillsNudgeInstallSucceeded:symlinks_no_privilege"
      )
    })
  })

  describe("skillsNudgeInstallFailureLabel", () => {
    it("suffixes the server's failure reason", () => {
      expect(
        skillsNudgeInstallFailureLabel(
          Object.assign(new Error("nope"), { reason: "write_denied" })
        )
      ).toBe("skillsNudgeInstallFailed:write_denied")
    })

    it("counts a safety-gate refusal as Refused, with the prefix stripped", () => {
      // A refusal never ran, so it must not land on the failure metric — the
      // install-failure rate is the number this whole vocabulary exists to explain.
      const label = skillsNudgeInstallFailureLabel(
        Object.assign(new Error("not available"), {
          reason: "refused:non_loopback",
        })
      )
      expect(label).toBe("skillsNudgeInstallRefused:non_loopback")
      expect(label).not.toContain("Failed")
      expect(label).not.toContain("refused:")
    })

    it("falls back to the bare label when the server sends no reason", () => {
      // An older backend has no error_reason field at all, and a rejection need
      // not be an Error. Both must still count as a failure, without a suffix.
      expect(skillsNudgeInstallFailureLabel(new Error("nope"))).toBe(
        "skillsNudgeInstallFailed"
      )
      expect(skillsNudgeInstallFailureLabel(undefined)).toBe(
        "skillsNudgeInstallFailed"
      )
    })
  })
})
