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
import { userEvent } from "@testing-library/user-event"

import { PageLink as PageLinkProto, streamlit } from "@streamlit/protobuf"

import { render, renderWithContexts } from "~lib/test_util"
import { lightTheme } from "~lib/theme/themeConfigs"

import PageLink, { buildHref, Props } from "./PageLink"

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
      navigationContext: {
        onPageChange: mockOnPageChange,
      },
    })

    const pageNavLink = screen.getByTestId("stPageLink-NavLink")
    await user.click(pageNavLink)
    expect(mockOnPageChange).toHaveBeenCalledWith("main_page_hash", "")
  })

  it("triggers onPageChange with pageScriptHash and queryString when clicked", async () => {
    const user = userEvent.setup()
    const props = getProps({ queryString: "foo=bar" })

    renderWithContexts(<PageLink {...props} />, {
      navigationContext: {
        onPageChange: mockOnPageChange,
      },
    })

    const pageNavLink = screen.getByTestId("stPageLink-NavLink")
    await user.click(pageNavLink)
    expect(mockOnPageChange).toHaveBeenCalledWith("main_page_hash", "foo=bar")
  })

  it("does not trigger onPageChange when disabled", async () => {
    const user = userEvent.setup()
    const props = getProps({}, { disabled: true })

    renderWithContexts(<PageLink {...props} />, {
      navigationContext: {
        onPageChange: mockOnPageChange,
      },
    })

    const pageNavLink = screen.getByTestId("stPageLink-NavLink")
    await user.click(pageNavLink)
    expect(mockOnPageChange).not.toHaveBeenCalled()
  })

  it("does not trigger onPageChange for external links", async () => {
    const user = userEvent.setup()
    const props = getProps({ page: "http://example.com", external: true })

    renderWithContexts(<PageLink {...props} />, {
      navigationContext: {
        onPageChange: mockOnPageChange,
      },
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

  it("positions the icon before the label by default", () => {
    const props = getProps({ icon: "🏠" })
    render(<PageLink {...props} />)

    const pageNavLink = screen.getByTestId("stPageLink-NavLink")
    const iconWrapper = screen.getByTestId("stIconEmoji").parentElement
    expect(pageNavLink.firstElementChild).toBe(iconWrapper)
  })

  it("renders the icon after the label when iconPosition is right", () => {
    const props = getProps({
      icon: "🏠",
      iconPosition: streamlit.ButtonLikeIconPosition.RIGHT,
    })
    render(<PageLink {...props} />)

    const pageNavLink = screen.getByTestId("stPageLink-NavLink")
    const iconWrapper = screen.getByTestId("stIconEmoji").parentElement
    expect(pageNavLink.lastElementChild).toBe(iconWrapper)
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
      navigationContext: {
        currentPageScriptHash: "main_page_hash",
      },
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

  it("constructs href with queryString for external links", () => {
    const props = getProps({
      page: "http://example.com",
      external: true,
      queryString: "foo=bar",
    })
    render(<PageLink {...props} />)

    const pageLink = screen.getByTestId("stPageLink-NavLink")
    expect(pageLink).toHaveAttribute("href", "http://example.com/?foo=bar")
  })

  it("constructs href with queryString for external links when URL already has query params", () => {
    const props = getProps({
      page: "http://example.com?baz=qux",
      external: true,
      queryString: "foo=bar",
    })
    render(<PageLink {...props} />)

    const pageLink = screen.getByTestId("stPageLink-NavLink")
    expect(pageLink).toHaveAttribute(
      "href",
      "http://example.com/?baz=qux&foo=bar"
    )
  })

  it("constructs href with queryString for external links with fragment", () => {
    const props = getProps({
      page: "http://example.com#section",
      external: true,
      queryString: "foo=bar",
    })
    render(<PageLink {...props} />)

    const pageLink = screen.getByTestId("stPageLink-NavLink")
    // Query params should be placed before the fragment
    expect(pageLink).toHaveAttribute(
      "href",
      "http://example.com/?foo=bar#section"
    )
  })

  it("constructs href with queryString for internal links", () => {
    const props = getProps({
      page: "page_1",
      queryString: "foo=bar&baz=qux",
    })
    render(<PageLink {...props} />)

    const pageLink = screen.getByTestId("stPageLink-NavLink")
    expect(pageLink).toHaveAttribute("href", "page_1?foo=bar&baz=qux")
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

describe("buildHref", () => {
  it("returns the page path when no queryString is provided", () => {
    const element = PageLinkProto.create({
      page: "my_page",
      queryString: "",
    })
    expect(buildHref(element)).toBe("my_page")
  })

  it("appends queryString to internal links", () => {
    const element = PageLinkProto.create({
      page: "my_page",
      queryString: "foo=bar",
      external: false,
    })
    expect(buildHref(element)).toBe("my_page?foo=bar")
  })

  it("appends queryString with & for internal links that already have query params", () => {
    const element = PageLinkProto.create({
      page: "my_page?existing=param",
      queryString: "foo=bar",
      external: false,
    })
    expect(buildHref(element)).toBe("my_page?existing=param&foo=bar")
  })

  it("appends queryString to external links using URL API", () => {
    const element = PageLinkProto.create({
      page: "https://example.com",
      queryString: "foo=bar",
      external: true,
    })
    expect(buildHref(element)).toBe("https://example.com/?foo=bar")
  })

  it("appends queryString to external links with existing query params", () => {
    const element = PageLinkProto.create({
      page: "https://example.com?existing=param",
      queryString: "foo=bar",
      external: true,
    })
    expect(buildHref(element)).toBe(
      "https://example.com/?existing=param&foo=bar"
    )
  })

  it("places queryString before fragment for external links", () => {
    const element = PageLinkProto.create({
      page: "https://example.com#section",
      queryString: "foo=bar",
      external: true,
    })
    expect(buildHref(element)).toBe("https://example.com/?foo=bar#section")
  })

  it("handles multiple query params for external links", () => {
    const element = PageLinkProto.create({
      page: "https://example.com",
      queryString: "foo=bar&baz=qux",
      external: true,
    })
    expect(buildHref(element)).toBe("https://example.com/?foo=bar&baz=qux")
  })

  it("falls back to string concatenation for invalid external URLs", () => {
    const element = PageLinkProto.create({
      page: "not-a-valid-url",
      queryString: "foo=bar",
      external: true,
    })
    // Falls back to simple concatenation when URL parsing fails
    expect(buildHref(element)).toBe("not-a-valid-url?foo=bar")
  })

  it("places queryString before fragment in fallback for invalid external URLs", () => {
    const element = PageLinkProto.create({
      page: "not-a-valid-url#section",
      queryString: "foo=bar",
      external: true,
    })
    // Falls back to string manipulation that correctly places query before fragment
    expect(buildHref(element)).toBe("not-a-valid-url?foo=bar#section")
  })
})
