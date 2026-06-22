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

import { act, screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { UNSTABLE_ToastRegion as ToastRegion } from "react-aria-components/Toast"
import { MockInstance, vi } from "vitest"

import { render } from "~lib/test_util"

import { StreamlitToastItem } from "./StreamlitToastItem"
import { toastQueue } from "./toastQueue"

const renderWithQueue = (): ReturnType<typeof render> =>
  render(
    <ToastRegion
      queue={toastQueue}
      aria-label="Notifications"
      data-testid="stToastContainer"
    >
      {({ toast }) => <StreamlitToastItem toast={toast} />}
    </ToastRegion>
  )

const LONG_MESSAGE =
  "Random toast message that is a really really really really really really really really really long message, going way past the 3 line limit"

describe("StreamlitToastItem", () => {
  let scrollHeightSpy: MockInstance | undefined
  let getComputedStyleSpy: MockInstance | undefined

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    scrollHeightSpy?.mockRestore()
    scrollHeightSpy = undefined
    getComputedStyleSpy?.mockRestore()
    getComputedStyleSpy = undefined
    act(() => {
      toastQueue.visibleToasts.forEach(t => toastQueue.close(t.key))
    })
    act(() => {
      vi.runOnlyPendingTimers()
    })
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  function simulateOverflow(): void {
    // Mock scrollHeight to exceed 3 lines so useLayoutEffect detects overflow.
    scrollHeightSpy = vi
      .spyOn(HTMLElement.prototype, "scrollHeight", "get")
      .mockImplementation(function (this: HTMLElement) {
        if (this.dataset.testid === "stToastText") {
          return 100
        }
        return 0
      })
    // Mock getComputedStyle to return a lineHeight for the toast text element,
    // while preserving the real implementation for other elements (needed by RTL).
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

  it("renders toast with body and icon", () => {
    renderWithQueue()
    act(() => {
      toastQueue.add(
        { body: "Hello toast", icon: "🐶" },
        { timeout: undefined }
      )
    })

    const toast = screen.getByTestId("stToast")
    expect(toast).toHaveTextContent("Hello toast")
    expect(toast).toHaveTextContent("🐶")
    expect(screen.getByTestId("stToastDynamicIcon")).toBeInTheDocument()
  })

  it("renders toast without icon when icon is not provided", () => {
    renderWithQueue()
    act(() => {
      toastQueue.add({ body: "No icon toast" }, { timeout: undefined })
    })

    const toast = screen.getByTestId("stToast")
    expect(toast).toHaveTextContent("No icon toast")
    expect(screen.queryByTestId("stToastDynamicIcon")).not.toBeInTheDocument()
  })

  it("shows view more button when text overflows", () => {
    simulateOverflow()
    renderWithQueue()
    act(() => {
      toastQueue.add({ body: LONG_MESSAGE }, { timeout: undefined })
    })

    const toast = screen.getByTestId("stToast")
    expect(
      within(toast).getByRole("button", { name: "view more" })
    ).toBeVisible()
    // Full text is always in the DOM — CSS handles visual truncation
    expect(toast).toHaveTextContent(LONG_MESSAGE)
  })

  it("does not show view more button for short messages", () => {
    renderWithQueue()
    act(() => {
      toastQueue.add({ body: "Short message" }, { timeout: undefined })
    })

    const toast = screen.getByTestId("stToast")
    expect(
      within(toast).queryByRole("button", { name: "view more" })
    ).not.toBeInTheDocument()
  })

  it("expands and collapses long messages", async () => {
    simulateOverflow()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQueue()
    act(() => {
      toastQueue.add({ body: LONG_MESSAGE }, { timeout: undefined })
    })

    const toast = screen.getByTestId("stToast")

    // Expand
    await user.click(within(toast).getByRole("button", { name: "view more" }))
    act(() => {
      vi.runOnlyPendingTimers()
    })

    expect(toast).toHaveTextContent(LONG_MESSAGE)
    expect(
      within(toast).getByRole("button", { name: "view less" })
    ).toBeVisible()

    // Collapse
    await user.click(within(toast).getByRole("button", { name: "view less" }))
    act(() => {
      vi.runOnlyPendingTimers()
    })

    expect(
      within(toast).getByRole("button", { name: "view more" })
    ).toBeVisible()
  })

  it("renders close button with accessible label", () => {
    renderWithQueue()
    act(() => {
      toastQueue.add({ body: "Closeable toast" }, { timeout: undefined })
    })

    const closeButton = screen.getByRole("button", { name: "Close" })
    expect(closeButton).toBeInTheDocument()
  })

  it("has correct test id and class name", () => {
    renderWithQueue()
    act(() => {
      toastQueue.add({ body: "Test toast" }, { timeout: undefined })
    })

    const toast = screen.getByTestId("stToast")
    expect(toast).toHaveClass("stToast")
  })
})
