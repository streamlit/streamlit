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

import { ReactElement } from "react"

import { act, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UNSTABLE_ToastRegion as ToastRegion } from "react-aria-components/Toast"

import { isCustomToastContent, toastQueue } from "@streamlit/lib"
import { render } from "@streamlit/lib/testing"

import SkillsNudgeToast, { SkillsNudgeToastProps } from "./SkillsNudgeToast"

type NudgeHandlers = Pick<
  SkillsNudgeToastProps,
  "onInstall" | "onSnooze" | "onDontShowAgain"
>

/**
 * Render the nudge the way the app does: enqueue a custom toast into the shared
 * queue and dispatch it through a ToastRegion. Returns the (mock) handlers.
 */
const renderNudge = (
  overrides: Partial<NudgeHandlers> = {}
): NudgeHandlers => {
  const handlers: NudgeHandlers = {
    onInstall: vi.fn().mockResolvedValue(undefined),
    onSnooze: vi.fn(),
    onDontShowAgain: vi.fn(),
    ...overrides,
  }

  render(
    <ToastRegion queue={toastQueue} aria-label="Notifications">
      {({ toast }): ReactElement =>
        isCustomToastContent(toast.content) ? (
          <>{toast.content.render(toast, () => toastQueue.close(toast.key))}</>
        ) : (
          <div />
        )
      }
    </ToastRegion>
  )

  act(() => {
    toastQueue.add(
      {
        render: (toast, close) => (
          <SkillsNudgeToast
            toast={toast}
            close={close}
            onInstall={handlers.onInstall}
            onSnooze={handlers.onSnooze}
            onDontShowAgain={handlers.onDontShowAgain}
          />
        ),
      },
      { timeout: undefined }
    )
  })

  return handlers
}

describe("SkillsNudgeToast", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    act(() => {
      toastQueue.visibleToasts.forEach(t => toastQueue.close(t.key))
    })
    act(() => {
      vi.runOnlyPendingTimers()
    })
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

  it("installs and shows the success confirmation, then auto-dismisses", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onInstall = vi.fn().mockResolvedValue(undefined)
    renderNudge({ onInstall })

    await user.click(screen.getByRole("button", { name: "Install" }))
    await flush()

    expect(onInstall).toHaveBeenCalledTimes(1)
    expect(screen.getByText("Skills installed")).toBeVisible()
    // The action buttons are gone once the install succeeds.
    expect(
      screen.queryByRole("button", { name: "Install" })
    ).not.toBeInTheDocument()

    // The toast auto-dismisses a few seconds after success.
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    act(() => {
      vi.runOnlyPendingTimers()
    })
    expect(screen.queryByTestId("stSkillsNudge")).not.toBeInTheDocument()
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
    renderNudge({ onInstall })

    await user.click(screen.getByRole("button", { name: "Install" }))
    await flush()

    expect(screen.getByText("network down")).toBeVisible()
    // Actions remain so the user can retry; the toast is not dismissed.
    expect(screen.getByRole("button", { name: "Install" })).toBeVisible()
    expect(screen.getByTestId("stSkillsNudge")).toBeVisible()
  })

  it("snoozes and dismisses when the user clicks the dismiss (✕) control", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onSnooze = vi.fn()
    renderNudge({ onSnooze })

    await user.click(screen.getByRole("button", { name: "Dismiss" }))
    act(() => {
      vi.runOnlyPendingTimers()
    })

    expect(onSnooze).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId("stSkillsNudge")).not.toBeInTheDocument()
  })

  it("permanently dismisses when the user clicks Don't show again", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onDontShowAgain = vi.fn()
    renderNudge({ onDontShowAgain })

    await user.click(screen.getByRole("button", { name: "Don't show again" }))
    act(() => {
      vi.runOnlyPendingTimers()
    })

    expect(onDontShowAgain).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId("stSkillsNudge")).not.toBeInTheDocument()
  })
})
