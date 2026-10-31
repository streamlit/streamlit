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

import { type ReactElement, StrictMode } from "react"

import { act, type RenderResult, screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { UNSTABLE_ToastRegion as ToastRegion } from "react-aria-components/Toast"
import { type MockInstance, vi } from "vitest"

import { Toast as ToastProto } from "@streamlit/protobuf"

import ThemeProvider from "~lib/components/core/ThemeProvider"
import { mockTheme } from "~lib/mocks/mockTheme"
import { render } from "~lib/test_util"

import { StreamlitToastItem } from "./StreamlitToastItem"
import Toast, { type ToastProps } from "./Toast"
import { toastQueue } from "./toastQueue"

const createContainer = (): ReactElement => (
  <ToastRegion
    queue={toastQueue}
    aria-label="Notifications"
    data-testid="stToastContainer"
  >
    {({ toast }) => <StreamlitToastItem toast={toast} />}
  </ToastRegion>
)

const getProps = (
  elementProps: Partial<ToastProto> = {},
  toastId = "toast-0"
): ToastProps => ({
  element: ToastProto.create({
    body: "This is a toast message",
    icon: "🐶",
    // Default to no auto-hide in tests to avoid timers leaking past teardown
    duration: 0,
    ...elementProps,
  }),
  toastId,
})

const renderComponent = (props: ToastProps): RenderResult =>
  render(
    <>
      {createContainer()}
      <Toast {...props} />
    </>
  )

/**
 * Builds a toast region plus a Toast keyed by `runId`, mirroring how
 * `ElementNodeRenderer` keys it by scriptRunId:
 * - Rerendering with the same `runId` models a `msg.toast()` update within a
 *   run (same instance).
 * - A new `runId` models a rerun (remount).
 */
const createToastTree = (props: ToastProps, runId = "run-1"): ReactElement => (
  <>
    {createContainer()}
    <Toast key={runId} {...props} />
  </>
)

const LONG_MESSAGE =
  "Random toast message that is a really really really really really really really really really long message, going way past the 3 line limit"

describe("Toast Component", () => {
  let scrollHeightSpy: MockInstance | undefined
  let getComputedStyleSpy: MockInstance | undefined

  beforeEach(() => {
    // Use fake timers across tests to control and flush internal timeouts
    vi.useFakeTimers()
  })

  afterEach(() => {
    scrollHeightSpy?.mockRestore()
    scrollHeightSpy = undefined
    getComputedStyleSpy?.mockRestore()
    getComputedStyleSpy = undefined
    // Clear all toasts and flush timers to avoid updates after test teardown
    act(() => {
      toastQueue.visibleToasts.forEach(t => toastQueue.close(t.key))
    })

    // Ensure any pending toast timers are executed and then cleared
    act(() => {
      vi.runOnlyPendingTimers()
    })
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  function simulateOverflow(): void {
    scrollHeightSpy = vi
      .spyOn(HTMLElement.prototype, "scrollHeight", "get")
      .mockImplementation(function (this: HTMLElement) {
        if (this.dataset.testid === "stToastText") {
          return 100
        }
        return 0
      })
    const realGetComputedStyle = window.getComputedStyle.bind(window)
    getComputedStyleSpy = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation((el, pseudoElt) => {
        if (el instanceof HTMLElement && el.dataset.testid === "stToastText") {
          return { lineHeight: "20px" } as CSSStyleDeclaration
        }
        return realGetComputedStyle(el, pseudoElt)
      })
  }

  it("renders default toast", () => {
    const props = getProps()
    renderComponent(props)

    const toast = screen.getByRole("alertdialog")
    const closeButton = screen.getByRole("button", { name: "Close" })
    const expandButton = screen.queryByRole("button", { name: "view more" })

    expect(toast).toBeInTheDocument()
    expect(toast).toHaveTextContent("🐶")
    expect(toast).toHaveTextContent("This is a toast message")
    expect(closeButton).toBeInTheDocument()
    expect(expandButton).not.toBeInTheDocument()

    const toastElement = screen.getByTestId("stToast")
    expect(toastElement).toBeInTheDocument()
    expect(toastElement).toHaveClass("stToast")
  })

  it("renders long toast messages with expand option when overflowing", () => {
    simulateOverflow()
    const props = getProps({ icon: "", body: LONG_MESSAGE })
    renderComponent(props)

    const toast = screen.getByRole("alertdialog")
    const expandButton = within(toast).getByRole("button", {
      name: "view more",
    })

    expect(toast).toBeInTheDocument()
    // Full text is always in the DOM — CSS line-clamp handles visual truncation
    expect(toast).toHaveTextContent(LONG_MESSAGE)
    expect(expandButton).toBeVisible()
  })

  it("can expand to see the full toast message & collapse", async () => {
    simulateOverflow()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const props = getProps({ icon: "", body: LONG_MESSAGE })
    renderComponent(props)

    const toast = screen.getByRole("alertdialog")
    const expandButton = within(toast).getByRole("button", {
      name: "view more",
    })
    expect(toast).toContainElement(expandButton)

    // Click view more button & expand the message
    await user.click(expandButton)
    act(() => {
      vi.runOnlyPendingTimers()
    })
    expect(toast).toHaveTextContent(LONG_MESSAGE)
    const collapseButton = within(toast).getByRole("button", {
      name: "view less",
    })
    expect(collapseButton).toBeVisible()

    // Click view less button & collapse the message
    await user.click(collapseButton)
    act(() => {
      vi.runOnlyPendingTimers()
    })
    expect(
      within(toast).getByRole("button", { name: "view more" })
    ).toBeVisible()
  })

  it("can close toast", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const props = getProps()
    renderComponent(props)

    const toast = screen.getByRole("alertdialog")
    const closeButton = screen.getByRole("button", { name: "Close" })
    expect(toast).toBeInTheDocument()
    expect(closeButton).toBeInTheDocument()
    // Click close button
    await user.click(closeButton)
    act(() => {
      vi.runOnlyPendingTimers()
    })
    // Toast is removed synchronously after timer flush
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("auto hides based on duration seconds", () => {
    const props = getProps({ duration: 1 })
    renderComponent(props)

    const toast = screen.getByRole("alertdialog")
    expect(toast).toBeVisible()

    // Advance time just before auto hide
    act(() => {
      vi.advanceTimersByTime(900)
    })
    expect(screen.getByRole("alertdialog")).toBeVisible()

    // Cross the 1s threshold (Toast multiplies seconds by 1000)
    act(() => {
      vi.advanceTimersByTime(200)
    })

    // Toast is removed synchronously after timer flush
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("throws an error when called via st.sidebar.toast", () => {
    const props = getProps({})
    render(
      <ThemeProvider theme={{ ...mockTheme.emotion, inSidebar: true }}>
        {createContainer()}
        <Toast {...props} />
      </ThemeProvider>
    )

    const toastError = screen.getByRole("alert")
    expect(toastError).toBeInTheDocument()
    expect(toastError).toHaveTextContent("Streamlit API Error")
    // Should not add toast to queue when in sidebar
    expect(toastQueue.visibleToasts).toHaveLength(0)
  })

  it("does not show expand button for short messages", () => {
    const shortMessage = "This message should not be truncated."
    const props = getProps({ body: shortMessage })
    renderComponent(props)

    const toast = screen.getByRole("alertdialog")
    expect(toast).toHaveTextContent(shortMessage)
    expect(
      within(toast).queryByRole("button", { name: "view more" })
    ).not.toBeInTheDocument()
  })

  it("keeps the toast visible after the Toast component unmounts", () => {
    // The ToastRegion stays mounted (like AppView) while only the Toast element
    // unmounts, mirroring the stale-node cleanup that happens when st.rerun()
    // follows st.toast() (issue #7740). The toast must NOT be closed on unmount.
    const Wrapper = ({ showToast }: { showToast: boolean }): ReactElement => (
      <>
        {createContainer()}
        {showToast && <Toast {...getProps()} />}
      </>
    )

    const { rerender } = render(<Wrapper showToast={true} />)
    expect(screen.getByRole("alertdialog")).toBeVisible()

    rerender(<Wrapper showToast={false} />)
    expect(screen.getByRole("alertdialog")).toBeVisible()
  })

  it("de-dupes a second toast added with the same toastId", () => {
    // A rerun re-emits the same toast at the same delta path (the component is
    // keyed by scriptRunId, so it remounts). It must not stack a duplicate.
    render(
      <>
        {createContainer()}
        <Toast {...getProps({}, "event-0")} />
        <Toast {...getProps({}, "event-0")} />
      </>
    )

    expect(screen.getAllByRole("alertdialog")).toHaveLength(1)
  })

  it("shows separate toasts for distinct toastIds", () => {
    // Guards against over-eager de-duplication: two identical st.toast("Hip!")
    // calls live at distinct delta paths and must both be shown.
    render(
      <>
        {createContainer()}
        <Toast {...getProps({ body: "Hip!" }, "event-0")} />
        <Toast {...getProps({ body: "Hip!" }, "event-1")} />
      </>
    )

    expect(screen.getAllByRole("alertdialog")).toHaveLength(2)
  })

  describe("updates and reruns at the same toastId", () => {
    it("updates the visible toast in place with a new body and icon", () => {
      const { rerender } = render(
        createToastTree(getProps({ body: "Gathering ingredients..." }))
      )
      expect(screen.getByRole("alertdialog")).toHaveTextContent(
        "Gathering ingredients..."
      )

      rerender(createToastTree(getProps({ body: "Cooking..." })))
      expect(screen.getAllByRole("alertdialog")).toHaveLength(1)
      expect(screen.getByRole("alertdialog")).toHaveTextContent("Cooking...")
      expect(
        screen.queryByText("Gathering ingredients...")
      ).not.toBeInTheDocument()

      rerender(createToastTree(getProps({ body: "Ready!", icon: "🥞" })))
      expect(screen.getAllByRole("alertdialog")).toHaveLength(1)
      const toast = screen.getByRole("alertdialog")
      expect(toast).toHaveTextContent("🥞Ready!")
      expect(toast).not.toHaveTextContent("🐶")
      expect(screen.queryByText("Cooking...")).not.toBeInTheDocument()
    })

    it("updates the visible toast when only the icon changes", () => {
      const { rerender } = render(
        createToastTree(getProps({ body: "Ready!" }))
      )
      expect(screen.getByRole("alertdialog")).toHaveTextContent("🐶Ready!")

      rerender(createToastTree(getProps({ body: "Ready!", icon: "🥞" })))
      expect(screen.getAllByRole("alertdialog")).toHaveLength(1)
      const toast = screen.getByRole("alertdialog")
      expect(toast).toHaveTextContent("🥞Ready!")
      expect(toast).not.toHaveTextContent("🐶")
    })

    it.each([
      ["a same-run update", "run-1"],
      ["a rerun", "run-2"],
    ])(
      "keeps the running timer when %s has identical content",
      (_description, runId) => {
        const { rerender } = render(createToastTree(getProps({ duration: 1 })))
        act(() => {
          vi.advanceTimersByTime(600)
        })

        // getProps creates a new proto object with identical values.
        rerender(createToastTree(getProps({ duration: 1 }), runId))
        expect(screen.getAllByRole("alertdialog")).toHaveLength(1)

        // Still expires 1s after the first render: the timer was not restarted.
        act(() => {
          vi.advanceTimersByTime(500)
        })
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
      }
    )

    it("restarts the timer when the content changes", () => {
      const { rerender } = render(createToastTree(getProps({ duration: 1 })))
      act(() => {
        vi.advanceTimersByTime(600)
      })

      rerender(createToastTree(getProps({ body: "Updated", duration: 1 })))
      act(() => {
        vi.advanceTimersByTime(600)
      })
      expect(screen.getByRole("alertdialog")).toHaveTextContent("Updated")

      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    })

    it("applies a changed duration", () => {
      const { rerender } = render(createToastTree(getProps({ duration: 0 })))

      rerender(createToastTree(getProps({ duration: 1 })))
      act(() => {
        vi.advanceTimersByTime(900)
      })
      expect(screen.getByRole("alertdialog")).toBeVisible()

      act(() => {
        vi.advanceTimersByTime(200)
      })
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    })

    it("does not revive a dismissed toast on a later update", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const { rerender } = render(createToastTree(getProps()))

      await user.click(screen.getByRole("button", { name: "Close" }))
      act(() => {
        vi.runOnlyPendingTimers()
      })
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()

      rerender(createToastTree(getProps({ body: "Updated" })))
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
      expect(screen.queryByText("Updated")).not.toBeInTheDocument()
    })

    it("does not revive an expired toast on a same-run update", () => {
      const { rerender } = render(createToastTree(getProps({ duration: 1 })))
      act(() => {
        vi.advanceTimersByTime(1100)
      })
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()

      rerender(createToastTree(getProps({ body: "Updated", duration: 1 })))
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
      expect(screen.queryByText("Updated")).not.toBeInTheDocument()
    })

    it("shows an expired toast again when a rerun re-emits it", () => {
      const { rerender } = render(createToastTree(getProps({ duration: 1 })))
      act(() => {
        vi.advanceTimersByTime(1100)
      })
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()

      rerender(createToastTree(getProps({ duration: 1 }), "run-2"))
      expect(screen.getAllByRole("alertdialog")).toHaveLength(1)
      expect(screen.getByRole("alertdialog")).toHaveTextContent(
        "This is a toast message"
      )
    })

    it("does not revive a toast kept by a rerun on a later update after it expires", () => {
      const { rerender } = render(createToastTree(getProps({ duration: 1 })))
      act(() => {
        vi.advanceTimersByTime(600)
      })

      // The rerun re-emits identical content, so it keeps the visible toast.
      rerender(createToastTree(getProps({ duration: 1 }), "run-2"))
      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()

      // A msg.toast() update within that rerun must not bring it back.
      rerender(
        createToastTree(getProps({ body: "Updated", duration: 1 }), "run-2")
      )
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
      expect(screen.queryByText("Updated")).not.toBeInTheDocument()
    })

    it("replaces a visible toast when a rerun emits different content", () => {
      const { rerender } = render(
        createToastTree(getProps({ body: "Ready!" }))
      )

      rerender(
        createToastTree(
          getProps({ body: "Gathering ingredients..." }),
          "run-2"
        )
      )
      expect(screen.getAllByRole("alertdialog")).toHaveLength(1)
      expect(screen.getByRole("alertdialog")).toHaveTextContent(
        "Gathering ingredients..."
      )
      expect(screen.queryByText("Ready!")).not.toBeInTheDocument()
    })

    it("only updates the toast with the matching toastId", () => {
      const twoToasts = (firstBody: string): ReactElement => (
        <>
          {createContainer()}
          <Toast {...getProps({ body: firstBody }, "event-0")} />
          <Toast {...getProps({ body: "Second toast" }, "event-1")} />
        </>
      )
      const { rerender } = render(twoToasts("First toast"))

      rerender(twoToasts("First toast updated"))
      expect(screen.getAllByRole("alertdialog")).toHaveLength(2)
      expect(screen.getByText("First toast updated")).toBeVisible()
      expect(screen.getByText("Second toast")).toBeVisible()
      expect(screen.queryByText("First toast")).not.toBeInTheDocument()
    })

    it("shows a single toast and applies updates under StrictMode", () => {
      const { rerender } = render(
        <StrictMode>{createToastTree(getProps())}</StrictMode>
      )
      expect(screen.getAllByRole("alertdialog")).toHaveLength(1)

      rerender(
        <StrictMode>
          {createToastTree(getProps({ body: "Updated" }))}
        </StrictMode>
      )
      expect(screen.getAllByRole("alertdialog")).toHaveLength(1)
      expect(screen.getByRole("alertdialog")).toHaveTextContent("Updated")
    })
  })
})
