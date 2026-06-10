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

import { act, screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { UNSTABLE_ToastRegion as ToastRegion } from "react-aria-components/Toast"
import { vi } from "vitest"

import { render } from "~lib/test_util"

import { StreamlitToastItem } from "./StreamlitToastItem"
import { toastQueue } from "./toastQueue"

const renderWithQueue = (): ReactElement => (
  <ToastRegion
    queue={toastQueue}
    aria-label="Notifications"
    data-testid="stToastContainer"
  >
    {({ toast }) => <StreamlitToastItem toast={toast} />}
  </ToastRegion>
)

describe("StreamlitToastItem", () => {
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

  it("renders toast with body and icon", () => {
    render(renderWithQueue())
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
    render(renderWithQueue())
    act(() => {
      toastQueue.add({ body: "No icon toast" }, { timeout: undefined })
    })

    const toast = screen.getByTestId("stToast")
    expect(toast).toHaveTextContent("No icon toast")
    expect(screen.queryByTestId("stToastDynamicIcon")).not.toBeInTheDocument()
  })

  it("shows truncated message with view more button for long messages", () => {
    render(renderWithQueue())
    act(() => {
      toastQueue.add(
        {
          body: "Random toast message that is a really really really really really really really really really long message, going way past the 3 line limit",
        },
        { timeout: undefined }
      )
    })

    const toast = screen.getByTestId("stToast")
    const expandButton = within(toast).getByRole("button", {
      name: "view more",
    })
    expect(expandButton).toBeInTheDocument()
    expect(within(toast).getByTestId("stMarkdownContainer")).toHaveTextContent(
      "Random toast message that is a really really really really really really really really really long"
    )
  })

  it("does not show view more button for short messages", () => {
    render(renderWithQueue())
    act(() => {
      toastQueue.add({ body: "Short message" }, { timeout: undefined })
    })

    const toast = screen.getByTestId("stToast")
    expect(
      within(toast).queryByRole("button", { name: "view more" })
    ).not.toBeInTheDocument()
  })

  it("expands and collapses long messages", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(renderWithQueue())
    act(() => {
      toastQueue.add(
        {
          body: "Random toast message that is a really really really really really really really really really long message, going way past the 3 line limit",
        },
        { timeout: undefined }
      )
    })

    const toast = screen.getByTestId("stToast")

    // Expand
    const expandButton = within(toast).getByRole("button", {
      name: "view more",
    })
    await user.click(expandButton)
    act(() => {
      vi.runOnlyPendingTimers()
    })

    expect(within(toast).getByTestId("stMarkdownContainer")).toHaveTextContent(
      "Random toast message that is a really really really really really really really really really long message, going way past the 3 line limit"
    )
    expect(
      within(toast).getByRole("button", { name: "view less" })
    ).toBeInTheDocument()

    // Collapse
    const collapseButton = within(toast).getByRole("button", {
      name: "view less",
    })
    await user.click(collapseButton)
    act(() => {
      vi.runOnlyPendingTimers()
    })

    expect(within(toast).getByTestId("stMarkdownContainer")).toHaveTextContent(
      "Random toast message that is a really really really really really really really really really long"
    )
    expect(
      within(toast).getByRole("button", { name: "view more" })
    ).toBeInTheDocument()
  })

  it("renders close button with accessible label", () => {
    render(renderWithQueue())
    act(() => {
      toastQueue.add({ body: "Closeable toast" }, { timeout: undefined })
    })

    const closeButton = screen.getByRole("button", { name: "Close" })
    expect(closeButton).toBeInTheDocument()
  })

  it("has correct test id and class name", () => {
    render(renderWithQueue())
    act(() => {
      toastQueue.add({ body: "Test toast" }, { timeout: undefined })
    })

    const toast = screen.getByTestId("stToast")
    expect(toast).toHaveClass("stToast")
  })
})
