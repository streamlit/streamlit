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

  it("renders with correct accessibility attributes (defaults to last item)", () => {
    render(<Breadcrumbs {...getProps()} />)

    const nav = screen.getByRole("navigation")
    expect(nav).toHaveAttribute("aria-label", "Breadcrumb")

    // When no value is set, the last item is selected by default
    const phonesText = screen.getByText("Phones")
    expect(phonesText.parentElement).toHaveAttribute("aria-current", "page")
  })

  it("renders separators between items", () => {
    render(<Breadcrumbs {...getProps()} />)

    const separators = screen.getAllByText("/")
    expect(separators).toHaveLength(2)
  })

  it("calls setIntValue when clicking a non-selected item", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setIntValue")

    render(<Breadcrumbs {...props} />)

    const electronicsButton = screen.getByRole("button", {
      name: "Electronics",
    })
    await user.click(electronicsButton)

    expect(props.widgetMgr.setIntValue).toHaveBeenCalledWith(
      props.element,
      1,
      { fromUi: true },
      props.fragmentId
    )
  })

  it("does not render last item as a button when no value set", () => {
    render(<Breadcrumbs {...getProps()} />)

    expect(
      screen.queryByRole("button", { name: "Phones" })
    ).not.toBeInTheDocument()
  })

  it("renders selected item (from value) as non-clickable", () => {
    const props = getProps({
      value: "1", // "Electronics" is selected
    })

    render(<Breadcrumbs {...props} />)

    // "Electronics" (index 1) should not be a button
    expect(
      screen.queryByRole("button", { name: "Electronics" })
    ).not.toBeInTheDocument()

    // "Home" (index 0) should still be a button
    expect(screen.getByRole("button", { name: "Home" })).toBeVisible()

    // "Phones" (index 2) should now be a button since it's no longer the selected item
    expect(screen.getByRole("button", { name: "Phones" })).toBeVisible()
  })

  it("marks selected item with aria-current page", () => {
    const props = getProps({
      value: "0", // "Home" is selected
    })

    render(<Breadcrumbs {...props} />)

    const homeText = screen.getByText("Home")
    expect(homeText.parentElement).toHaveAttribute("aria-current", "page")
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

  it("renders all items as plain text when disabled (no clickable buttons)", () => {
    const props = {
      ...getProps(),
      disabled: true,
    }

    render(<Breadcrumbs {...props} />)

    // All items should be visible as text
    expect(screen.getByText("Home")).toBeVisible()
    expect(screen.getByText("Electronics")).toBeVisible()
    expect(screen.getByText("Phones")).toBeVisible()

    // No buttons should be rendered when disabled
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
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
