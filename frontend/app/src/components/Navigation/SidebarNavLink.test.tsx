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

import { render } from "@streamlit/lib/testing"

import SidebarNavLink, { SidebarNavLinkProps } from "./SidebarNavLink"

const getProps = (
  props: Partial<SidebarNavLinkProps> = {}
): SidebarNavLinkProps => ({
  isActive: false,
  pageUrl: "https://www.example.com",
  icon: "",
  onClick: vi.fn(),
  children: "Test",
  widgetsDisabled: false,
  ...props,
})

describe("SidebarNavLink", () => {
  it("renders without crashing", () => {
    render(<SidebarNavLink {...getProps()} />)

    const sidebarNavLink = screen.getByTestId("stSidebarNavLink")
    expect(sidebarNavLink).toHaveTextContent("Test")
    expect(sidebarNavLink).toHaveAttribute("href", "https://www.example.com")
  })

  it("has the correct href & text", () => {
    render(<SidebarNavLink {...getProps()} />)

    const sidebarNavLink = screen.getByTestId("stSidebarNavLink")
    expect(sidebarNavLink).toHaveAttribute("href", "https://www.example.com")
    expect(sidebarNavLink).toHaveTextContent("Test")
  })

  it("renders with material icon", () => {
    render(<SidebarNavLink {...getProps({ icon: ":material/page:" })} />)

    screen.getByTestId("stSidebarNavLink")

    const materialIcon = screen.getByTestId("stIconMaterial")
    expect(materialIcon).toHaveTextContent("page")
  })

  it("renders with emoji icon", () => {
    render(<SidebarNavLink {...getProps({ icon: "🚀" })} />)

    screen.getByTestId("stSidebarNavLink")

    const emojiIcon = screen.getByTestId("stIconEmoji")
    expect(emojiIcon).toHaveTextContent("🚀")
  })

  it("renders a non-active page properly", () => {
    render(<SidebarNavLink {...getProps()} />)

    const sidebarNavLink = screen.getByTestId("stSidebarNavLink")
    expect(sidebarNavLink).not.toHaveAttribute("aria-current")
  })

  it("renders an active page properly", () => {
    render(<SidebarNavLink {...getProps({ isActive: true })} />)

    const sidebarNavLink = screen.getByTestId("stSidebarNavLink")
    expect(sidebarNavLink).toHaveAttribute("aria-current", "page")
  })

  it("renders when widgets are disabled", () => {
    render(<SidebarNavLink {...getProps({ widgetsDisabled: true })} />)

    screen.getByTestId("stSidebarNavLinkContainer")
    const sidebarNavLink = screen.getByTestId("stSidebarNavLink")
    expect(sidebarNavLink).toHaveStyle("pointer-events: none")
  })

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn(event => {
      event.preventDefault()
    })
    render(<SidebarNavLink {...getProps({ onClick })} />)

    const sidebarNavLink = screen.getByTestId("stSidebarNavLink")
    await user.click(sidebarNavLink)

    expect(onClick).toHaveBeenCalled()
  })

  it("renders markdown in page title with links disabled", () => {
    render(
      <SidebarNavLink
        {...getProps({
          children: "**Bold** and *italic* with [link](https://example.com)",
        })}
      />
    )

    const sidebarNavLink = screen.getByTestId("stSidebarNavLink")
    expect(sidebarNavLink.querySelector("strong")).toHaveTextContent("Bold")
    expect(sidebarNavLink.querySelector("em")).toHaveTextContent("italic")
    // Links in markdown titles should be disabled (no nested <a> elements inside the nav link)
    expect(
      sidebarNavLink.querySelector(".stMarkdown a, .stStreamlitMarkdown a")
    ).toBeNull()
  })

  describe("when isTopNav is true", () => {
    it("renders successfully with isTopNav prop", () => {
      render(<SidebarNavLink {...getProps({ isTopNav: true })} />)

      const sidebarNavLink = screen.getByTestId("stTopNavLink")
      expect(sidebarNavLink).toHaveTextContent("Test")
    })

    it("maintains active state functionality for top nav", () => {
      render(
        <SidebarNavLink {...getProps({ isTopNav: true, isActive: true })} />
      )

      const sidebarNavLink = screen.getByTestId("stTopNavLink")
      expect(sidebarNavLink).toHaveAttribute("aria-current", "page")
    })

    it("handles disabled state for top nav", () => {
      render(
        <SidebarNavLink
          {...getProps({ isTopNav: true, widgetsDisabled: true })}
        />
      )

      screen.getByTestId("stTopNavLinkContainer")
      const sidebarNavLink = screen.getByTestId("stTopNavLink")
      expect(sidebarNavLink).toHaveStyle("pointer-events: none")
    })
  })

  describe("when isExternal is true", () => {
    it("renders with target='_blank' and rel='noopener noreferrer'", () => {
      render(
        <SidebarNavLink
          {...getProps({
            isExternal: true,
            externalUrl: "https://docs.streamlit.io",
          })}
        />
      )

      const sidebarNavLink = screen.getByTestId("stSidebarNavLink")
      expect(sidebarNavLink).toHaveAttribute("target", "_blank")
      expect(sidebarNavLink).toHaveAttribute("rel", "noopener noreferrer")
    })

    it("uses externalUrl for href when provided", () => {
      render(
        <SidebarNavLink
          {...getProps({
            isExternal: true,
            externalUrl: "https://docs.streamlit.io",
            pageUrl: "https://internal.example.com",
          })}
        />
      )

      const sidebarNavLink = screen.getByTestId("stSidebarNavLink")
      expect(sidebarNavLink).toHaveAttribute(
        "href",
        "https://docs.streamlit.io"
      )
    })

    it("falls back to pageUrl when externalUrl is not provided", () => {
      render(
        <SidebarNavLink
          {...getProps({
            isExternal: true,
            externalUrl: null,
            pageUrl: "https://fallback.example.com",
          })}
        />
      )

      const sidebarNavLink = screen.getByTestId("stSidebarNavLink")
      expect(sidebarNavLink).toHaveAttribute(
        "href",
        "https://fallback.example.com"
      )
    })

    it("calls onClick when external link is clicked", async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(
        <SidebarNavLink
          {...getProps({
            isExternal: true,
            externalUrl: "https://docs.streamlit.io",
            onClick,
          })}
        />
      )

      const sidebarNavLink = screen.getByTestId("stSidebarNavLink")
      await user.click(sidebarNavLink)

      expect(onClick).toHaveBeenCalled()
    })

    it("works correctly with isTopNav for external links", () => {
      render(
        <SidebarNavLink
          {...getProps({
            isExternal: true,
            externalUrl: "https://docs.streamlit.io",
            isTopNav: true,
          })}
        />
      )

      const sidebarNavLink = screen.getByTestId("stTopNavLink")
      expect(sidebarNavLink).toHaveAttribute("target", "_blank")
      expect(sidebarNavLink).toHaveAttribute("rel", "noopener noreferrer")
      expect(sidebarNavLink).toHaveAttribute(
        "href",
        "https://docs.streamlit.io"
      )
    })

    it("includes screen-reader-only '(opens in new tab)' text", () => {
      render(
        <SidebarNavLink
          {...getProps({
            isExternal: true,
            externalUrl: "https://docs.streamlit.io",
          })}
        />
      )

      const srText = screen.getByText("(opens in new tab)")
      // Visually hidden but accessible to screen readers
      expect(srText).toHaveStyle({
        position: "absolute",
        clip: "rect(0, 0, 0, 0)",
      })
    })

    it("does not show aria-current='page' even when isActive is true", () => {
      render(
        <SidebarNavLink
          {...getProps({
            isExternal: true,
            externalUrl: "https://docs.streamlit.io",
            isActive: true,
          })}
        />
      )

      const sidebarNavLink = screen.getByTestId("stSidebarNavLink")
      expect(sidebarNavLink).not.toHaveAttribute("aria-current")
    })
  })

  describe("when isExternal is false", () => {
    it("does not render external link attributes or screen-reader text", () => {
      render(<SidebarNavLink {...getProps({ isExternal: false })} />)

      const sidebarNavLink = screen.getByTestId("stSidebarNavLink")
      expect(sidebarNavLink).not.toHaveAttribute("target", "_blank")
      expect(sidebarNavLink).not.toHaveAttribute("rel", "noopener noreferrer")
      expect(screen.queryByText("(opens in new tab)")).not.toBeInTheDocument()
    })
  })
})
