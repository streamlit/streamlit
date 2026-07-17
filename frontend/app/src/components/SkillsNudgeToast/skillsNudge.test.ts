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
})
