/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
  screen,
  fireEvent,
  waitFor,
  RenderResult,
} from "@testing-library/react"
import "@testing-library/jest-dom"

import { render } from "src/lib/test_util"

import { Toast as ToastProto } from "src/lib/proto"
import { mockTheme } from "src/lib/mocks/mockTheme"
import { Toast, ToastProps } from "./Toast"
import { ToasterContainer, PLACEMENT } from "baseui/toast"

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

const getProps = (elementProps: Partial<ToastProto> = {}): ToastProps => ({
  text: "This is a toast message",
  icon: "🐶",
  theme: mockTheme.emotion,
  width: 0,
  ...elementProps,
})

const renderComponent = (props: ToastProps): RenderResult => {
  return render(
    <>
      {createContainer()}
      <Toast {...props} />
    </>
  )
}

describe("Toast Component", () => {
  test("renders default toast", () => {
    const props = getProps()
    renderComponent(props)

    const toast = screen.getByRole("alert")
    const closeButton = screen.getByRole("button", { name: "Close" })
    const expandButton = screen.queryByRole("button", { name: "view more" })

    expect(toast).toBeInTheDocument()
    expect(toast).toHaveTextContent("🐶 This is a toast message")
    expect(closeButton).toBeInTheDocument()
    expect(expandButton).not.toBeInTheDocument()
  })

  test("renders long toast messages with expand option", () => {
    const props = getProps({
      icon: "",
      text: "Random toast message that is a really really really really really really really really really long message, going way past the 3 line limit",
    })
    renderComponent(props)

    const toast = screen.getByRole("alert")
    const expandButton = screen.getByRole("button", { name: "view more" })
    expect(toast).toBeInTheDocument()
    expect(toast).toHaveTextContent(
      "Random toast message that is a really really really really really really really really really long message,"
    )
    expect(toast).toContainElement(expandButton)
  })

  test("can expand to see full toast message", () => {
    const props = getProps({
      icon: "",
      text: "Random toast message that is a really really really really really really really really really long message, going way past the 3 line limit",
    })
    renderComponent(props)

    const toast = screen.getByRole("alert")
    const expandButton = screen.getByRole("button", { name: "view more" })
    expect(toast).toBeInTheDocument()
    expect(toast).toHaveTextContent(
      "Random toast message that is a really really really really really really really really really long message,"
    )
    expect(toast).toContainElement(expandButton)

    fireEvent.click(expandButton)
    expect(toast).toHaveTextContent(
      "Random toast message that is a really really really really really really really really really long message, going way past the 3 line limit"
    )
    const collapseButton = screen.getByRole("button", { name: "view less" })
    expect(toast).toContainElement(collapseButton)
  })

  test("can collapse to see truncated toast message", () => {
    const props = getProps({
      icon: "",
      text: "Random toast message that is a really really really really really really really really really long message, going way past the 3 line limit",
    })
    renderComponent(props)

    const toast = screen.getByRole("alert")
    const expandButton = screen.getByRole("button", { name: "view more" })
    // Click view more button (expand the message)
    fireEvent.click(expandButton)
    expect(toast).toHaveTextContent(
      "Random toast message that is a really really really really really really really really really long message, going way past the 3 line limit"
    )

    // Click view less button (collapse the message)
    const collapseButton = screen.getByRole("button", { name: "view less" })
    fireEvent.click(collapseButton)
    expect(toast).toHaveTextContent(
      "Random toast message that is a really really really really really really really really really long message,"
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
})
