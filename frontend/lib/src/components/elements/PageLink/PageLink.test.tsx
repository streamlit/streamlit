/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import React from "react"

import { screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { PageLink as PageLinkProto } from "@streamlit/protobuf"

import { render, renderWithContexts } from "~lib/test_util"
import { lightTheme } from "~lib/theme"

import PageLink, { Props } from "./PageLink"

const getProps = (
  elementProps: Partial<PageLinkProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: PageLinkProto.create({
    label: "Label",
    page: "streamlit_app",
    pageScriptHash: "main_page_hash",
    useContainerWidth: null,
    ...elementProps,
  }),
  disabled: false,
  ...widgetProps,
})

const mockOnPageChange = vi.fn()

describe("PageLink", () => {
  beforeEach(() => {
    mockOnPageChange.mockClear()
  })

  it("renders without crashing", () => {
    const props = getProps()
    render(<PageLink {...props} />)

    const pageLink = screen.getByRole("link")
    expect(pageLink).toBeInTheDocument()
  })

  it("has correct className", () => {
    const props = getProps()
    render(<PageLink {...props} />)

    const pageLink = screen.getByTestId("stPageLink")

    expect(pageLink).toHaveClass("stPageLink")
  })

  it("renders a label within the button", () => {
    const props = getProps()
    render(<PageLink {...props} />)

    const pageLink = screen.getByRole("link", {
      name: `${props.element.label}`,
    })

    expect(pageLink).toBeInTheDocument()
  })

  it("handles the disabled prop", () => {
    const props = getProps({}, { disabled: true })
    render(<PageLink {...props} />)

    const pageLink = screen.getByRole("link")
    expect(pageLink).toHaveAttribute("disabled")
  })

  it("triggers onPageChange with pageScriptHash when clicked", async () => {
    const user = userEvent.setup()
    const props = getProps()

    renderWithContexts(<PageLink {...props} />, {
      onPageChange: mockOnPageChange,
    })

    const pageNavLink = screen.getByTestId("stPageLink-NavLink")
    await user.click(pageNavLink)
    expect(mockOnPageChange).toHaveBeenCalledWith("main_page_hash")
  })

  it("does not trigger onPageChange when disabled", async () => {
    const user = userEvent.setup()
    const props = getProps({}, { disabled: true })

    renderWithContexts(<PageLink {...props} />, {
      onPageChange: mockOnPageChange,
    })

    const pageNavLink = screen.getByTestId("stPageLink-NavLink")
    await user.click(pageNavLink)
    expect(mockOnPageChange).not.toHaveBeenCalled()
  })

  it("does not trigger onPageChange for external links", async () => {
    const user = userEvent.setup()
    const props = getProps({ page: "http://example.com", external: true })

    renderWithContexts(<PageLink {...props} />, {
      onPageChange: mockOnPageChange,
    })

    const pageNavLink = screen.getByTestId("stPageLink-NavLink")
    await user.click(pageNavLink)
    expect(mockOnPageChange).not.toHaveBeenCalled()
  })

  it("renders an icon when provided", () => {
    const props = getProps({ icon: ":material/home:" })
    render(<PageLink {...props} />)

    const pageLinkIcon = screen.getByTestId("stIconMaterial")
    expect(pageLinkIcon).toHaveTextContent("home")
  })

  it("renders an emoji icon when provided", () => {
    const props = getProps({ icon: "🏠" })
    render(<PageLink {...props} />)

    const pageLinkIcon = screen.getByTestId("stIconEmoji")
    expect(pageLinkIcon).toHaveTextContent("🏠")
  })

  it("does not render an icon when empty string is provided", () => {
    const props = getProps({ icon: "" })
    render(<PageLink {...props} />)

    // Icon should not be rendered when empty string is provided
    const pageLinkIcon = screen.queryByTestId("stIconMaterial")
    expect(pageLinkIcon).not.toBeInTheDocument()

    // Also check for emoji icons
    const emojiIcon = screen.queryByTestId("stIconEmoji")
    expect(emojiIcon).not.toBeInTheDocument()
  })

  it("does not render an icon when icon is not provided", () => {
    const props = getProps({}) // No icon provided
    render(<PageLink {...props} />)

    // Icon should not be rendered when no icon is provided
    const pageLinkIcon = screen.queryByTestId("stIconMaterial")
    expect(pageLinkIcon).not.toBeInTheDocument()

    // Also check for emoji icons
    const emojiIcon = screen.queryByTestId("stIconEmoji")
    expect(emojiIcon).not.toBeInTheDocument()
  })

  it("renders a current page link properly", () => {
    const props = getProps({ pageScriptHash: "main_page_hash" })
    renderWithContexts(<PageLink {...props} />, {
      currentPageScriptHash: "main_page_hash",
    })

    const currentPageBgColor = lightTheme.emotion.colors.darkenedBgMix15

    const pageLink = screen.getByTestId("stPageLink-NavLink")
    expect(pageLink).toHaveStyle(`background-color: ${currentPageBgColor}`)
    const pageLinkText = screen.getByText(props.element.label)
    expect(pageLinkText).toHaveStyle(`font-weight: 600`)
  })

  it("renders an external page link properly", () => {
    const props = getProps({ page: "http://example.com", external: true })
    render(<PageLink {...props} />)

    const pageLink = screen.getByTestId("stPageLink-NavLink")
    expect(pageLink).toHaveAttribute("target", "_blank")
    expect(pageLink).toHaveStyle("background-color: rgba(0, 0, 0, 0)")
    const pageLinkText = screen.getByText(props.element.label)
    expect(pageLinkText).not.toHaveStyle(`font-weight: 600`)
  })

  it("renders with help properly", async () => {
    const user = userEvent.setup()
    render(<PageLink {...getProps({ help: "mockHelpText" })} />)

    // When the help param is used, page link renders twice (once for normal
    // tooltip and once for mobile tooltip) so we need to get the first one
    const pageLink = screen.getAllByTestId("stPageLink-NavLink")[0]
    // Ensure both the page link and tooltip target have correct width.
    // These will be 100% and the ElementContainer will have styles to determine
    // the button width.
    expect(pageLink).toHaveStyle("width: 100%")
    const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")
    expect(tooltipTarget).toHaveStyle("width: 100%")

    // Ensure the tooltip content is visible and has the correct text
    await user.hover(tooltipTarget)

    const tooltipContent = await screen.findByTestId("stTooltipContent")
    expect(tooltipContent).toHaveTextContent("mockHelpText")
  })
})
