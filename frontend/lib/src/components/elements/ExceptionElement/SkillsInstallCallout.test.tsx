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
  enabled: true,
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

  it("hides while idle when disabled, and reappears when re-enabled", () => {
    const { rerender } = render(
      <SkillsInstallCallout {...getProps({ enabled: true })} />
    )
    expect(screen.getByTestId("stSkillsInstallCallout")).toBeVisible()

    // Eligibility is lost (the toast took over / the server stopped
    // recommending): the idle callout hides — but is NOT permanently dismissed.
    rerender(<SkillsInstallCallout {...getProps({ enabled: false })} />)
    expect(
      screen.queryByTestId("stSkillsInstallCallout")
    ).not.toBeInTheDocument()

    // Eligibility returns (e.g. the toast is closed): the callout comes back.
    rerender(<SkillsInstallCallout {...getProps({ enabled: true })} />)
    expect(screen.getByTestId("stSkillsInstallCallout")).toBeVisible()
  })

  it("stays visible mid-install and during the success confirmation even if disabled", async () => {
    const user = userEvent.setup()
    let resolveInstall: (detail?: string) => void = () => {}
    const onInstall = vi.fn(
      () =>
        new Promise<string | undefined>(resolve => {
          resolveInstall = resolve
        })
    )
    const { rerender } = render(
      <SkillsInstallCallout {...getProps({ enabled: true, onInstall })} />
    )

    await user.click(screen.getByRole("button", { name: "Install skills" }))
    // Losing eligibility mid-install must NOT hide the in-flight action.
    rerender(
      <SkillsInstallCallout {...getProps({ enabled: false, onInstall })} />
    )
    expect(screen.getByTestId("stSkillsInstallCallout")).toBeVisible()

    await act(async () => {
      resolveInstall("Installed to .agents/skills")
      await Promise.resolve()
    })
    // The success confirmation still shows even though disabled — only its own
    // timer removes it; the hide-while-idle rule doesn't touch a confirmation.
    expect(screen.getByText("Installed to .agents/skills")).toBeVisible()
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
    // While installing the button reports progress and is unavailable — but via
    // aria-disabled, so it KEEPS FOCUS. The `disabled` attribute would make the
    // browser blur it, dumping a keyboard user back to the top of the document
    // and putting the Retry it may become out of reach.
    const installingButton = screen.getByRole("button", {
      name: "Installing…",
    })
    expect(installingButton).toHaveAttribute("aria-disabled", "true")
    expect(installingButton).not.toBeDisabled()
    expect(installingButton).toHaveFocus()
    // A second click while in flight must not start another install.
    await user.click(installingButton)
    expect(onInstall).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveInstall("Installed to .agents/skills")
      await Promise.resolve()
    })

    // The server's detail wins: it says where the skills landed, and names any
    // it had to skip, so a partial install isn't confirmed as a complete one.
    expect(screen.getByText("Installed to .agents/skills")).toBeVisible()
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

  it("lays a long failure reason out as one row, action last, icon hidden from the live region", async () => {
    const user = userEvent.setup()
    let rejectInstall: (error: Error) => void = () => {}
    const onInstall = vi.fn(
      () =>
        new Promise<string | undefined>((_resolve, reject) => {
          rejectInstall = reject
        })
    )
    render(<SkillsInstallCallout {...getProps({ onInstall })} />)

    // A long, server-supplied failure reason is the case that matters. The row
    // must not wrap: the copy absorbs the length by wrapping inside itself, so
    // the icon stays beside it and the action stays at the end of the row.
    await user.click(screen.getByRole("button", { name: "Install skills" }))
    await act(async () => {
      rejectInstall(
        new Error(
          ".agents/skills/developing-with-streamlit, " +
            ".claude/skills/developing-with-streamlit already exist. " +
            "Remove them and try again."
        )
      )
      await Promise.resolve()
    })

    const row = screen.getByTestId("stSkillsInstallCallout")
    const icon = screen.getByTestId("stIconMaterial")
    const retry = screen.getByRole("button", { name: "Retry" })

    // The row has exactly two children: the icon+copy group, then the action.
    // Grouping is what stops flex stranding the icon on a line of its own when
    // the copy is long, and the action being outside that group is what lets it
    // wrap away on its own in a narrow container.
    const group = screen.getByText(/already exist/).parentElement
    expect(row.children).toHaveLength(2)
    expect(row.firstElementChild).toBe(group)
    expect(row.lastElementChild).toBe(retry)
    expect(group).toContainElement(icon)
    expect(group).not.toContainElement(retry)

    // Structure is all this test can honestly claim. The layout itself — where
    // the action sits, when it wraps away, that a long path breaks instead of
    // overflowing — depends on several declarations interacting under real
    // line-breaking, and jsdom does no layout. Asserting the CSS here only pins
    // the literal inverse of whichever declaration you thought of. The guard is
    // the E2E snapshot of this exact state in
    // `skills_install_callout_test.py::test_skills_install_callout_reports_a_failed_install`.

    // The Material ligature ("error") is text in the DOM, so it must be hidden
    // from the live region or it gets announced before the message.
    expect(icon.closest("[aria-hidden='true']")).not.toBeNull()
  })

  it("keeps the action mounted across a failure, so Retry is one keypress away", async () => {
    const user = userEvent.setup()
    let rejectInstall: (error: Error) => void = () => {}
    const onInstall = vi.fn(
      () =>
        new Promise<string | undefined>((_resolve, reject) => {
          rejectInstall = reject
        })
    )
    render(<SkillsInstallCallout {...getProps({ onInstall })} />)

    // Reach the action by keyboard, the way the affected user does.
    await user.tab()
    const action = screen.getByRole("button", { name: "Install skills" })
    expect(action).toHaveFocus()
    await user.keyboard("{Enter}")

    await act(async () => {
      rejectInstall(new Error("Permission denied"))
      await Promise.resolve()
    })

    // Retry is the SAME element relabelled, never a remounted one, so focus
    // survives the round trip and Retry is reachable without tabbing the whole
    // document again.
    //
    // Scope note: the focus assertion here only catches an unmount/remount of
    // the action. It canNOT catch a regression to the `disabled` attribute —
    // jsdom doesn't run the browser's unfocusing steps for a disabled element,
    // so focus would appear to survive here while really being lost in a browser.
    // The assertions guarding that are the aria-disabled/not-disabled pair in
    // "installs and shows the success confirmation"; keep them.
    const retry = screen.getByRole("button", { name: "Retry" })
    expect(retry).toBe(action)
    expect(retry).toHaveFocus()
    expect(retry).not.toHaveAttribute("aria-disabled")
    await user.keyboard("{Enter}")
    expect(onInstall).toHaveBeenCalledTimes(2)
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
      // With no detail from the server, the generic confirmation stands in.
      expect(
        screen.getByText(
          "Skills installed — your AI assistant is ready to help."
        )
      ).toBeVisible()
      // The confirmation lingers briefly before asking to be dismissed.
      expect(onDismiss).not.toHaveBeenCalled()

      act(() => {
        vi.advanceTimersByTime(2999)
      })
      // Matches the nudge toast's 3s, so the same message doesn't get less
      // reading time here than there.
      expect(onDismiss).not.toHaveBeenCalled()
      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(onDismiss).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
