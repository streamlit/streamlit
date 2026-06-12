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

import { act, RenderResult, screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { UNSTABLE_ToastRegion as ToastRegion } from "react-aria-components/Toast"
import { MockInstance, vi } from "vitest"

import { Toast as ToastProto } from "@streamlit/protobuf"

import ThemeProvider from "~lib/components/core/ThemeProvider"
import { mockTheme } from "~lib/mocks/mockTheme"
import { render } from "~lib/test_util"

import { StreamlitToastItem } from "./StreamlitToastItem"
import Toast, { ToastProps } from "./Toast"
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

const getProps = (elementProps: Partial<ToastProto> = {}): ToastProps => ({
  element: ToastProto.create({
    body: "This is a toast message",
    icon: "🐶",
    // Default to no auto-hide in tests to avoid timers leaking past teardown
    duration: 0,
    ...elementProps,
  }),
})

const renderComponent = (props: ToastProps): RenderResult =>
  render(
    <>
      {createContainer()}
      <Toast {...props} />
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
      <ThemeProvider
        theme={{ ...mockTheme.emotion, inSidebar: true }}
        baseuiTheme={mockTheme.basewebTheme}
      >
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
})
