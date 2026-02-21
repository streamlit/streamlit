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

import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { Breadcrumbs as BreadcrumbsProto } from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import Breadcrumbs from "./Breadcrumbs"

const getProps = (
  elementProps: Partial<BreadcrumbsProto> = {}
): {
  element: BreadcrumbsProto
  disabled: boolean
  widgetMgr: WidgetStateManager
  fragmentId: string
} => ({
  element: BreadcrumbsProto.create({
    id: "test_breadcrumbs",
    items: [
      { content: "Home" },
      { content: "Electronics" },
      { content: "Phones" },
    ],
    disabled: false,
    separator: "/",
    ...elementProps,
  }),
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
  fragmentId: "test_fragment",
})

describe("Breadcrumbs widget", () => {
  it("renders breadcrumbs items", () => {
    render(<Breadcrumbs {...getProps()} />)

    expect(screen.getByText("Home")).toBeVisible()
    expect(screen.getByText("Electronics")).toBeVisible()
    expect(screen.getByText("Phones")).toBeVisible()
  })

  it("renders with correct accessibility attributes", () => {
    render(<Breadcrumbs {...getProps()} />)

    const nav = screen.getByRole("navigation")
    expect(nav).toHaveAttribute("aria-label", "Breadcrumb")

    const phonesText = screen.getByText("Phones")
    expect(phonesText.parentElement).toHaveAttribute("aria-current", "page")
  })

  it("renders separators between items", () => {
    render(<Breadcrumbs {...getProps()} />)

    const separators = screen.getAllByText("/")
    expect(separators).toHaveLength(2)
  })

  it("calls setStringValue when clicking a non-last item", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")

    render(<Breadcrumbs {...props} />)

    const electronicsButton = screen.getByRole("button", {
      name: "Electronics",
    })
    await user.click(electronicsButton)

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      "1",
      { fromUi: true },
      props.fragmentId
    )
  })

  it("does not render last item as a button", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")

    render(<Breadcrumbs {...props} />)

    expect(
      screen.queryByRole("button", { name: "Phones" })
    ).not.toBeInTheDocument()
  })

  it("renders icons when provided", () => {
    const props = getProps({
      items: [
        { content: "Home", contentIcon: ":material/home:" },
        { content: "Current" },
      ],
    })

    render(<Breadcrumbs {...props} />)

    expect(screen.getByText("Home")).toBeVisible()
    expect(screen.getByText("Current")).toBeVisible()
  })

  it("does not trigger click handler when disabled", async () => {
    const user = userEvent.setup()
    const props = {
      ...getProps(),
      disabled: true,
    }
    vi.spyOn(props.widgetMgr, "setStringValue")

    render(<Breadcrumbs {...props} />)

    const homeButton = screen.getByRole("button", { name: "Home" })
    await user.click(homeButton)

    expect(props.widgetMgr.setStringValue).not.toHaveBeenCalled()
  })

  it("renders single item without separators", () => {
    const props = getProps({
      items: [{ content: "Home" }],
    })

    render(<Breadcrumbs {...props} />)

    expect(screen.getByText("Home")).toBeVisible()
    expect(screen.queryByText("/")).not.toBeInTheDocument()
  })

  it("renders help tooltip when provided", () => {
    const props = getProps({
      help: "Navigation help text",
    })

    render(<Breadcrumbs {...props} />)

    expect(screen.getByTestId("stTooltipIcon")).toBeVisible()
  })

  it("renders custom text separator", () => {
    const props = getProps({
      separator: " > ",
    })

    render(<Breadcrumbs {...props} />)

    // Custom separator should not render as default "/"
    expect(screen.queryByText("/")).not.toBeInTheDocument()
    // The separator elements should exist (with aria-hidden)
    const nav = screen.getByRole("navigation")
    const separators = nav.querySelectorAll('[aria-hidden="true"]')
    expect(separators).toHaveLength(2)
    // Check the separator content contains the custom separator
    expect(separators[0]).toHaveTextContent(">")
  })

  it("renders material icon separator", () => {
    const props = getProps({
      separator: ":material/chevron_right:",
    })

    render(<Breadcrumbs {...props} />)

    // Material icon separator should not render as text "/"
    expect(screen.queryByText("/")).not.toBeInTheDocument()
    // The separator elements should still exist (with aria-hidden)
    const nav = screen.getByRole("navigation")
    const separators = nav.querySelectorAll('[aria-hidden="true"]')
    expect(separators).toHaveLength(2)
  })
})
