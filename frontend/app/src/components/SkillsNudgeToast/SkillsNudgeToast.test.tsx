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

import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { render } from "@streamlit/lib/testing"

import SkillsNudgeToast, { SkillsNudgeToastProps } from "./SkillsNudgeToast"

const getProps = (
  propOverrides: Partial<SkillsNudgeToastProps> = {}
): SkillsNudgeToastProps => ({
  onInstall: vi.fn().mockResolvedValue(undefined),
  onSnooze: vi.fn(),
  onDontShowAgain: vi.fn(),
  onDismiss: vi.fn(),
  ...propOverrides,
})

describe("SkillsNudgeToast", () => {
  it("renders install, don't show again, and a dismiss control", () => {
    render(<SkillsNudgeToast {...getProps()} />)

    expect(screen.getByTestId("stSkillsNudge")).toBeVisible()
    expect(screen.getByRole("button", { name: "Install" })).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Don't show again" })
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeVisible()
    // No success/error confirmation should be present initially.
    expect(screen.queryByText("Skills installed")).not.toBeInTheDocument()
  })

  it("installs and shows the success confirmation, then auto-dismisses", async () => {
    const user = userEvent.setup()
    const onInstall = vi.fn().mockResolvedValue(undefined)
    const onDismiss = vi.fn()
    render(<SkillsNudgeToast {...getProps({ onInstall, onDismiss })} />)

    await user.click(screen.getByRole("button", { name: "Install" }))

    expect(onInstall).toHaveBeenCalledTimes(1)
    expect(await screen.findByText("Skills installed")).toBeVisible()
    // The action buttons are gone once the install succeeds.
    expect(
      screen.queryByRole("button", { name: "Install" })
    ).not.toBeInTheDocument()

    // The toast auto-dismisses a few seconds after success.
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1))
  })

  it("shows an error and keeps the actions when the install fails", async () => {
    const user = userEvent.setup()
    const onInstall = vi.fn().mockRejectedValue(new Error("network down"))
    const onDismiss = vi.fn()
    render(<SkillsNudgeToast {...getProps({ onInstall, onDismiss })} />)

    await user.click(screen.getByRole("button", { name: "Install" }))

    expect(await screen.findByText("network down")).toBeVisible()
    // Actions remain so the user can retry or dismiss; no auto-dismiss occurs.
    expect(screen.getByRole("button", { name: "Install" })).toBeVisible()
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it("calls onSnooze when the user clicks the dismiss (✕) control", async () => {
    const user = userEvent.setup()
    const onSnooze = vi.fn()
    render(<SkillsNudgeToast {...getProps({ onSnooze })} />)

    await user.click(screen.getByRole("button", { name: "Dismiss" }))

    expect(onSnooze).toHaveBeenCalledTimes(1)
  })

  it("calls onDontShowAgain when the user clicks Don't show again", async () => {
    const user = userEvent.setup()
    const onDontShowAgain = vi.fn()
    render(<SkillsNudgeToast {...getProps({ onDontShowAgain })} />)

    await user.click(screen.getByRole("button", { name: "Don't show again" }))

    expect(onDontShowAgain).toHaveBeenCalledTimes(1)
  })
})
