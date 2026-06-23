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

import { render } from "~lib/test_util"

import SkillsInstallCallout, {
  SkillsInstallCalloutProps,
} from "./SkillsInstallCallout"

const getProps = (
  overrides: Partial<SkillsInstallCalloutProps> = {}
): SkillsInstallCalloutProps => ({
  onInstall: vi.fn().mockResolvedValue(undefined),
  onShown: vi.fn(),
  onDismiss: vi.fn(),
  ...overrides,
})

describe("SkillsInstallCallout", () => {
  it("renders an Install CTA with no dismiss controls", () => {
    render(<SkillsInstallCallout {...getProps()} />)

    expect(screen.getByTestId("stSkillsInstallCallout")).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Install skills" })
    ).toBeVisible()
    // Deliberately non-dismissable: no ✕ / snooze / "don't show again".
    expect(
      screen.queryByRole("button", { name: /don't show again/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /close|dismiss/i })
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Skills installed/)).not.toBeInTheDocument()
  })

  it("records the impression exactly once on mount", () => {
    const onShown = vi.fn()
    const { rerender } = render(
      <SkillsInstallCallout {...getProps({ onShown })} />
    )
    expect(onShown).toHaveBeenCalledTimes(1)

    // A re-render must not re-fire the impression.
    rerender(<SkillsInstallCallout {...getProps({ onShown })} />)
    expect(onShown).toHaveBeenCalledTimes(1)
  })

  it("installs and shows the success confirmation", async () => {
    const user = userEvent.setup()
    let resolveInstall: (detail?: string) => void = () => {}
    const onInstall = vi.fn(
      () =>
        new Promise<string | undefined>(resolve => {
          resolveInstall = resolve
        })
    )
    render(<SkillsInstallCallout {...getProps({ onInstall })} />)

    await user.click(screen.getByRole("button", { name: "Install skills" }))
    expect(onInstall).toHaveBeenCalledTimes(1)
    // While installing, the button shows progress and is disabled.
    const installingButton = screen.getByRole("button", {
      name: "Installing…",
    })
    expect(installingButton).toBeDisabled()

    await act(async () => {
      resolveInstall("Installed to .agents/skills")
      await Promise.resolve()
    })

    expect(
      screen.getByText(/Skills installed/, { exact: false })
    ).toBeVisible()
    // The button is gone once installed (nothing left to do).
    expect(
      screen.queryByRole("button", { name: /install/i })
    ).not.toBeInTheDocument()
  })

  it("shows the error and keeps the button for retry on failure", async () => {
    const user = userEvent.setup()
    let rejectInstall: (error: Error) => void = () => {}
    const onInstall = vi.fn(
      () =>
        new Promise<string | undefined>((_resolve, reject) => {
          rejectInstall = reject
        })
    )
    render(<SkillsInstallCallout {...getProps({ onInstall })} />)

    await user.click(screen.getByRole("button", { name: "Install skills" }))
    await act(async () => {
      rejectInstall(new Error("Permission denied"))
      await Promise.resolve()
    })

    expect(screen.getByText(/Permission denied/)).toBeVisible()
    // The button remains (relabeled "Retry") so the developer can retry.
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled()
    expect(
      screen.queryByRole("button", { name: "Install skills" })
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Skills installed/)).not.toBeInTheDocument()
  })

  it("auto-dismisses shortly after a successful install", async () => {
    vi.useFakeTimers()
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onDismiss = vi.fn()
      const onInstall = vi.fn().mockResolvedValue(undefined)
      render(<SkillsInstallCallout {...getProps({ onInstall, onDismiss })} />)

      await user.click(screen.getByRole("button", { name: "Install skills" }))
      // Resolve the install promise's microtasks.
      await act(async () => {
        await Promise.resolve()
      })
      expect(screen.getByText(/Skills installed/)).toBeVisible()
      // The confirmation lingers briefly before asking to be dismissed.
      expect(onDismiss).not.toHaveBeenCalled()

      act(() => {
        vi.advanceTimersByTime(2500)
      })
      expect(onDismiss).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
