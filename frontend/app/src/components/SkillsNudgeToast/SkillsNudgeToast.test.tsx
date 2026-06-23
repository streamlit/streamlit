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

import { act, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { render } from "@streamlit/lib/testing"

import SkillsNudgeToast, { SkillsNudgeToastProps } from "./SkillsNudgeToast"

type NudgeHandlers = Pick<
  SkillsNudgeToastProps,
  "onInstall" | "onSnooze" | "onDontShowAgain" | "onClose"
>

/**
 * Render the standalone nudge card with mock handlers. Unlike the previous
 * queue-based nudge, this is a plain component the app renders directly; its
 * visibility is owned by the parent (App), so dismissal here means calling
 * ``onClose`` rather than removing itself from a toast queue.
 */
const renderNudge = (
  overrides: Partial<NudgeHandlers> = {}
): NudgeHandlers => {
  const handlers: NudgeHandlers = {
    onInstall: vi.fn().mockResolvedValue(undefined),
    onSnooze: vi.fn(),
    onDontShowAgain: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }

  render(
    <SkillsNudgeToast
      onInstall={handlers.onInstall}
      onSnooze={handlers.onSnooze}
      onDontShowAgain={handlers.onDontShowAgain}
      onClose={handlers.onClose}
    />
  )

  return handlers
}

describe("SkillsNudgeToast", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  /** Flush the install promise's microtasks and re-render. */
  const flush = async (): Promise<void> => {
    await act(async () => {
      await Promise.resolve()
    })
  }

  it("renders install, don't show again, and a dismiss control", () => {
    renderNudge()

    expect(screen.getByTestId("stSkillsNudge")).toBeVisible()
    expect(screen.getByRole("button", { name: "Install" })).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Don't show again" })
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeVisible()
    // No success confirmation should be present initially.
    expect(screen.queryByText("Skills installed")).not.toBeInTheDocument()
  })

  it("installs and shows the success confirmation, then asks to be closed", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onInstall = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    renderNudge({ onInstall, onClose })

    await user.click(screen.getByRole("button", { name: "Install" }))
    await flush()

    expect(onInstall).toHaveBeenCalledTimes(1)
    expect(screen.getByText("Skills installed")).toBeVisible()
    // The action buttons are gone once the install succeeds.
    expect(
      screen.queryByRole("button", { name: "Install" })
    ).not.toBeInTheDocument()
    // Not closed yet — the confirmation stays briefly before auto-dismiss.
    expect(onClose).not.toHaveBeenCalled()

    // A few seconds after success, the card requests to be closed.
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("shows the install location detail returned by onInstall", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onInstall = vi.fn().mockResolvedValue("Installed to .agents/skills")
    renderNudge({ onInstall })

    await user.click(screen.getByRole("button", { name: "Install" }))
    await flush()

    expect(screen.getByText("Skills installed")).toBeVisible()
    expect(screen.getByText("Installed to .agents/skills")).toBeVisible()
  })

  it("shows an error and keeps the actions when the install fails", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onInstall = vi.fn().mockRejectedValue(new Error("network down"))
    const onClose = vi.fn()
    renderNudge({ onInstall, onClose })

    await user.click(screen.getByRole("button", { name: "Install" }))
    await flush()

    expect(screen.getByText("network down")).toBeVisible()
    // Actions remain so the user can retry; the card is not closed.
    expect(screen.getByRole("button", { name: "Install" })).toBeVisible()
    expect(screen.getByTestId("stSkillsNudge")).toBeVisible()
    // An error must never auto-dismiss, even long after the failure.
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(onClose).not.toHaveBeenCalled()
  })

  it("snoozes and closes when the user clicks the dismiss (✕) control", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onSnooze = vi.fn()
    const onClose = vi.fn()
    renderNudge({ onSnooze, onClose })

    await user.click(screen.getByRole("button", { name: "Dismiss" }))

    expect(onSnooze).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    // Snooze must not be confused with the permanent dismissal.
    expect(screen.queryByRole("button", { name: "Install" })).toBeVisible()
  })

  it("permanently dismisses and closes when the user clicks Don't show again", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onDontShowAgain = vi.fn()
    const onClose = vi.fn()
    renderNudge({ onDontShowAgain, onClose })

    await user.click(screen.getByRole("button", { name: "Don't show again" }))

    expect(onDontShowAgain).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("snoozes and closes on Escape (keyboard dismissal)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onSnooze = vi.fn()
    const onDontShowAgain = vi.fn()
    const onClose = vi.fn()
    renderNudge({ onSnooze, onDontShowAgain, onClose })

    // Escape from a focused control inside the card dismisses it (snooze),
    // mirroring the ✕ — keyboard users get a quick non-destructive dismissal.
    screen.getByRole("button", { name: "Install" }).focus()
    await user.keyboard("{Escape}")

    expect(onSnooze).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    // Escape snoozes; it must not trigger the permanent dismissal.
    expect(onDontShowAgain).not.toHaveBeenCalled()
  })
})
