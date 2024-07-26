/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React, { ReactElement } from "react"
import {
  fireEvent,
  RenderResult,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import "@testing-library/jest-dom"
import { PLACEMENT, ToasterContainer } from "baseui/toast"

import { render } from "@streamlit/lib/src/test_util"
import { Toast as ToastProto } from "@streamlit/lib/src/proto"
import { EmotionTheme } from "@streamlit/lib/src/theme"
import { mockTheme } from "@streamlit/lib/src/mocks/mockTheme"

import { shortenMessage, Toast, ToastProps } from "./Toast"

// A Toaster Container is required to render Toasts
// Don't import the actual one from EventContainer as that lives on app side
const createContainer = (): ReactElement => (
  <ToasterContainer
    placement={PLACEMENT.bottomRight}
    // increasing autoHideDuration to 10s to avoid test flakiness
    autoHideDuration={10000}
    overrides={{
      Root: {
        props: {
          "data-testid": "toastContainer",
        },
      },
    }}
  />
)

const getProps = (
  elementProps: Partial<ToastProto> = {},
  themeProps: Partial<EmotionTheme> = {}
): ToastProps => ({
  body: "This is a toast message",
  icon: "🐶",
  theme: {
    ...mockTheme.emotion,
    ...themeProps,
  },
  width: 0,
  ...elementProps,
})

const renderComponent = (props: ToastProps): RenderResult =>
  render(
    <>
      {createContainer()}
      <Toast {...props} />
    </>
  )

describe("Toast Component", () => {
  test("renders default toast", () => {
    const props = getProps()
    renderComponent(props)

    const toast = screen.getByRole("alert")
    const closeButton = screen.getByRole("button", { name: "Close" })
    const expandButton = screen.queryByRole("button", { name: "view more" })

    expect(toast).toBeInTheDocument()
    expect(toast).toHaveTextContent("🐶")
    expect(toast).toHaveTextContent("This is a toast message")
    expect(closeButton).toBeInTheDocument()
    expect(expandButton).not.toBeInTheDocument()
  })

  test("renders long toast messages with expand option", () => {
    const props = getProps({
      icon: "",
      body: "Random toast message that is a really really really really really really really really really long message, going way past the 3 line limit",
    })
    renderComponent(props)

    const toast = screen.getByRole("alert")
    const toastText = within(toast).getByTestId("stMarkdownContainer")

    const expandButton = screen.getByRole("button", { name: "view more" })
    expect(toast).toBeInTheDocument()
    expect(toastText).toHaveTextContent(
      "Random toast message that is a really really really really really really really really really long"
    )
    expect(toast).toContainElement(expandButton)
  })

  test("can expand to see the full toast message & collapse to truncate", () => {
    const props = getProps({
      icon: "",
      body: "Random toast message that is a really really really really really really really really really long message, going way past the 3 line limit",
    })
    renderComponent(props)

    const toast = screen.getByRole("alert")
    const toastText = within(toast).getByTestId("stMarkdownContainer")
    const expandButton = screen.getByRole("button", { name: "view more" })
    // Initial state
    expect(toast).toBeInTheDocument()
    expect(toastText).toHaveTextContent(
      "Random toast message that is a really really really really really really really really really long"
    )
    expect(toast).toContainElement(expandButton)

    // Click view more button & expand the message
    fireEvent.click(expandButton)
    expect(toast).toHaveTextContent(
      "Random toast message that is a really really really really really really really really really long message, going way past the 3 line limit"
    )

    // Click view less button & collapse the message
    const collapseButton = screen.getByRole("button", { name: "view less" })
    expect(toast).toContainElement(collapseButton)
    fireEvent.click(collapseButton)
    expect(toastText).toHaveTextContent(
      "Random toast message that is a really really really really really really really really really long"
    )
    expect(toast).toContainElement(expandButton)
  })

  test("can close toast", async () => {
    const props = getProps()
    renderComponent(props)

    const toast = screen.getByRole("alert")
    const closeButton = screen.getByRole("button", { name: "Close" })
    expect(toast).toBeInTheDocument()
    expect(closeButton).toBeInTheDocument()
    // Click close button
    fireEvent.click(closeButton)
    // Wait for toast to be removed from DOM
    await waitFor(() => expect(toast).not.toBeInTheDocument())
  })

  test("throws an error when called via st.sidebar.toast", async () => {
    const props = getProps({}, { inSidebar: true })
    renderComponent(props)

    const toastError = screen.getByRole("alert")
    expect(toastError).toBeInTheDocument()
    expect(toastError).toHaveTextContent("Streamlit API Error")
  })

  test("shortenMessage does not truncate messages under the character limit", () => {
    const shortMessage = "This message should not be truncated."
    const props = getProps({ body: shortMessage })
    renderComponent(props)

    const toast = screen.getByRole("alert")
    expect(toast).toHaveTextContent(shortMessage)
  })

  test("shortenMessage truncates messages over the character limit without cutting words", () => {
    const longMessage =
      "This is a very long message meant to test the functionality of the shortenMessage function, ensuring it truncates properly without cutting words and respects the character limit."
    const expectedTruncatedMessage = shortenMessage(longMessage)
    const props = getProps({ icon: "", body: longMessage })
    renderComponent(props)

    // Get the text content of the toast, excluding the "view more" and "Close" buttons
    const toastText = screen
      .getByRole("alert")
      ?.textContent?.replace("view moreClose", "")

    expect(toastText).toEqual(expectedTruncatedMessage)
    expect(toastText).toHaveLength(expectedTruncatedMessage.length)
  })

  test("shortenMessage handles explicit line breaks correctly", () => {
    const messageWithBreaks =
      "First line of the message.\nSecond line of the message, which is meant to test how explicit line breaks are handled.\nThird line, which should not be visible."
    const expectedTruncatedMessage = shortenMessage(messageWithBreaks)
    const props = getProps({ icon: "", body: messageWithBreaks })
    renderComponent(props)

    const toastText = screen
      .getByRole("alert")
      ?.textContent?.replace("view moreClose", "")
    expect(toastText).toEqual(expectedTruncatedMessage)
    expect(toastText).toHaveLength(expectedTruncatedMessage.length)
  })

  test("expands and collapses long messages with explicit line breaks correctly", () => {
    const messageWithBreaks =
      "First line of the message.\nSecond line of the message, which is very long and meant to test the expand and collapse functionality.\nThird line, which should initially be hidden."
    const expectedTruncatedMessage = shortenMessage(messageWithBreaks)
    const props = getProps({ icon: "", body: messageWithBreaks })
    renderComponent(props)

    const expandButton = screen.getByRole("button", { name: "view more" })
    fireEvent.click(expandButton) // Expand

    const toastExpanded = screen
      .getByRole("alert")
      ?.textContent?.replace("view lessClose", "")
    expect(toastExpanded).toEqual(messageWithBreaks) // Check full message is displayed

    const collapseButton = screen.getByRole("button", { name: "view less" })
    fireEvent.click(collapseButton) // Collapse

    const toastCollapsed = screen
      .getByRole("alert")
      ?.textContent?.replace("view moreClose", "")
    expect(toastCollapsed).toEqual(expectedTruncatedMessage) // Check message is truncated again
  })
})
