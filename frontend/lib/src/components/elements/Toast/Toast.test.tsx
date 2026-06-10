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
import { vi } from "vitest"

import { Toast as ToastProto } from "@streamlit/protobuf"

import ThemeProvider from "~lib/components/core/ThemeProvider"
import { mockTheme } from "~lib/mocks/mockTheme"
import { render } from "~lib/test_util"

import { StreamlitToastItem } from "./StreamlitToastItem"
import Toast, { ToastProps } from "./Toast"
import { toastQueue } from "./toastQueue"
import { shortenMessage } from "./utils"

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

describe("Toast Component", () => {
  beforeEach(() => {
    // Use fake timers across tests to control and flush internal timeouts
    vi.useFakeTimers()
  })

  afterEach(() => {
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

  it("renders long toast messages with expand option", () => {
    const props = getProps({
      icon: "",
      body: "Random toast message that is a really really really really really really really really really long message, going way past the 3 line limit",
    })
    renderComponent(props)

    const toast = screen.getByRole("alertdialog")
    const toastText = within(toast).getByTestId("stMarkdownContainer")

    const expandButton = screen.getByRole("button", { name: "view more" })
    expect(toast).toBeInTheDocument()
    expect(toastText).toHaveTextContent(
      "Random toast message that is a really really really really really really really really really long"
    )
    expect(toast).toContainElement(expandButton)
  })

  it("can expand to see the full toast message & collapse to truncate", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const props = getProps({
      icon: "",
      body: "Random toast message that is a really really really really really really really really really long message, going way past the 3 line limit",
    })
    renderComponent(props)

    const toast = screen.getByRole("alertdialog")
    const toastText = within(toast).getByTestId("stMarkdownContainer")
    const expandButton = screen.getByRole("button", { name: "view more" })
    // Initial state
    expect(toast).toBeInTheDocument()
    expect(toastText).toHaveTextContent(
      "Random toast message that is a really really really really really really really really really long"
    )
    expect(toast).toContainElement(expandButton)

    // Click view more button & expand the message
    await user.click(expandButton)
    act(() => {
      vi.runOnlyPendingTimers()
    })
    expect(toast).toHaveTextContent(
      "Random toast message that is a really really really really really really really really really long message, going way past the 3 line limit"
    )

    // Click view less button & collapse the message
    const collapseButton = screen.getByRole("button", { name: "view less" })
    expect(toast).toContainElement(collapseButton)
    await user.click(collapseButton)
    act(() => {
      vi.runOnlyPendingTimers()
    })
    expect(toastText).toHaveTextContent(
      "Random toast message that is a really really really really really really really really really long"
    )
    expect(toast).toContainElement(expandButton)
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

  it("shortenMessage does not truncate messages under the character limit", () => {
    const shortMessage = "This message should not be truncated."
    const props = getProps({ body: shortMessage })
    renderComponent(props)

    const toast = screen.getByRole("alertdialog")
    expect(toast).toHaveTextContent(shortMessage)
  })

  it("shortenMessage truncates messages over the character limit without cutting words", () => {
    const longMessage =
      "This is a very long message meant to test the functionality of the shortenMessage function, ensuring it truncates properly without cutting words and respects the character limit."
    const expectedTruncatedMessage = shortenMessage(longMessage)
    const props = getProps({ icon: "", body: longMessage })
    renderComponent(props)

    // Get the text content of the toast, excluding the "view more" button
    const toastText = screen
      .getByRole("alertdialog")
      ?.textContent?.replace("view more", "")

    expect(toastText).toEqual(expectedTruncatedMessage)
    expect(toastText).toHaveLength(expectedTruncatedMessage.length)
  })

  it("shortenMessage handles explicit line breaks correctly", () => {
    const messageWithBreaks =
      "First line of the message.\nSecond line of the message, which is meant to test how explicit line breaks are handled.\nThird line, which should not be visible."
    const expectedTruncatedMessage = shortenMessage(messageWithBreaks)
    const props = getProps({ icon: "", body: messageWithBreaks })
    renderComponent(props)

    const toastText = screen
      .getByRole("alertdialog")
      ?.textContent?.replace("view more", "")
    expect(toastText).toEqual(expectedTruncatedMessage)
    expect(toastText).toHaveLength(expectedTruncatedMessage.length)
  })

  it("expands and collapses long messages with explicit line breaks correctly", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const messageWithBreaks =
      "First line of the message.\nSecond line of the message, which is very long and meant to test the expand and collapse functionality.\nThird line, which should initially be hidden."
    const expectedTruncatedMessage = shortenMessage(messageWithBreaks)
    const props = getProps({ icon: "", body: messageWithBreaks })
    renderComponent(props)

    const expandButton = screen.getByRole("button", { name: "view more" })
    await user.click(expandButton) // Expand
    act(() => {
      vi.runOnlyPendingTimers()
    })

    const toastExpanded = screen
      .getByRole("alertdialog")
      ?.textContent?.replace("view less", "")
    expect(toastExpanded).toEqual(messageWithBreaks) // Check full message is displayed

    const collapseButton = screen.getByRole("button", { name: "view less" })
    await user.click(collapseButton) // Collapse
    act(() => {
      vi.runOnlyPendingTimers()
    })

    const toastCollapsed = screen
      .getByRole("alertdialog")
      ?.textContent?.replace("view more", "")
    expect(toastCollapsed).toEqual(expectedTruncatedMessage) // Check message is truncated again
  })
})
