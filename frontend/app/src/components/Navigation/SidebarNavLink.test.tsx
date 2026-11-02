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

import {
  act,
  cleanup,
  renderHook,
  screen,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useFocusVisible } from "react-aria"
import type { Mock } from "vitest"

import { render } from "@streamlit/lib/testing"

import SidebarNavLink, {
  NAV_HELP_TOOLTIP_HOVER_DELAY_MS,
  type SidebarNavLinkProps,
} from "./SidebarNavLink"

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

  describe("with page help", () => {
    // jsdom pads inline elements with spaces in accessible text, so the bold
    // word is not next to punctuation.
    const HELP = "Net revenue by **region** and month."
    const HELP_TEXT = "Net revenue by region and month."

    /**
     * Click handler that prevents the default navigation, as the nav does
     * before it switches pages itself.
     */
    const createNavClickHandler = (): Mock<SidebarNavLinkProps["onClick"]> =>
      vi.fn<SidebarNavLinkProps["onClick"]>(e => e.preventDefault())

    beforeAll(() => {
      // React Aria tracks the interaction modality through document listeners
      // that useFocusVisible registers once.
      // eslint-disable-next-line testing-library/no-render-in-lifecycle -- registers the document listeners hover tests depend on
      renderHook(() => useFocusVisible())
    })

    beforeEach(() => {
      vi.useFakeTimers()
      // Hover opens a tooltip only while the modality is "pointer".
      document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }))
    })

    afterEach(() => {
      // Close any open tooltip and let the shared warm-up cool down, so the
      // next test's first hover waits for the full delay again.
      act(() => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
      })
      act(() => {
        vi.advanceTimersByTime(NAV_HELP_TOOLTIP_HOVER_DELAY_MS)
      })
      act(() => {
        cleanup()
      })
      vi.useRealTimers()
    })

    it("exposes the rendered help as the link's accessible description while the tooltip is closed", () => {
      render(<SidebarNavLink {...getProps({ help: HELP })} />)

      const link = screen.getByRole("link", { name: "Test" })
      expect(link).toHaveAccessibleDescription(HELP_TEXT)
      expect(screen.queryByTestId("stTooltipContent")).not.toBeInTheDocument()
    })

    it("opens the tooltip on hover only after the nav hover delay", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<SidebarNavLink {...getProps({ help: HELP })} />)

      await user.hover(screen.getByTestId("stTooltipHoverTarget"))
      act(() => {
        vi.advanceTimersByTime(NAV_HELP_TOOLTIP_HOVER_DELAY_MS - 1)
      })
      expect(screen.queryByTestId("stTooltipContent")).not.toBeInTheDocument()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })
      expect(screen.getByTestId("stTooltipContent")).toHaveTextContent(
        HELP_TEXT
      )
    })

    it("opens the next item's tooltip right away once one has opened", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(
        <>
          <SidebarNavLink {...getProps({ help: "First page." })}>
            First
          </SidebarNavLink>
          <SidebarNavLink {...getProps({ help: "Second page." })}>
            Second
          </SidebarNavLink>
        </>
      )
      const [first, second] = screen.getAllByTestId("stTooltipHoverTarget")

      await user.hover(first)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(NAV_HELP_TOOLTIP_HOVER_DELAY_MS)
      })
      expect(screen.getByTestId("stTooltipContent")).toHaveTextContent(
        "First page."
      )

      await user.hover(second)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.getByTestId("stTooltipContent")).toHaveTextContent(
        "Second page."
      )
    })

    it("opens immediately on keyboard focus and describes the link once", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<SidebarNavLink {...getProps({ help: HELP })} />)

      await user.tab()
      const link = screen.getByRole("link", { name: "Test" })
      expect(link).toHaveFocus()

      const tooltipContent = screen.getByTestId("stTooltipContent")
      expect(tooltipContent).toHaveTextContent(HELP_TEXT)
      // The popup is hidden from assistive tech, so only the hidden
      // description describes the link.
      expect(tooltipContent.parentElement).toHaveAttribute(
        "aria-hidden",
        "true"
      )
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
      expect(link.getAttribute("aria-describedby")?.split(" ")).toHaveLength(1)
      expect(link).toHaveAccessibleDescription(HELP_TEXT)
    })

    it("does not open on a touch tap", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onClick = createNavClickHandler()
      render(<SidebarNavLink {...getProps({ help: HELP, onClick })} />)

      await user.pointer({
        keys: "[TouchA]",
        target: screen.getByRole("link", { name: "Test" }),
      })
      act(() => {
        vi.advanceTimersByTime(NAV_HELP_TOOLTIP_HOVER_DELAY_MS)
      })

      expect(onClick).toHaveBeenCalledTimes(1)
      expect(screen.queryByTestId("stTooltipContent")).not.toBeInTheDocument()
    })

    it("keeps links in the help out of the tab order", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(
        <>
          <SidebarNavLink
            {...getProps({
              help: "See the [docs](https://docs.streamlit.io).",
            })}
          />
          <button type="button">After</button>
        </>
      )

      await user.tab()
      expect(screen.getByRole("link", { name: "Test" })).toHaveFocus()
      await user.tab()
      expect(screen.getByRole("button", { name: "After" })).toHaveFocus()
    })

    it("describes the link with a visually hidden copy that is aria-hidden and has no links", () => {
      render(
        <SidebarNavLink
          {...getProps({ help: "See the [docs](https://docs.streamlit.io)." })}
        />
      )

      const link = screen.getByRole("link", { name: "Test" })
      expect(link).toHaveAccessibleDescription("See the docs.")
      const description = document.getElementById(
        link.getAttribute("aria-describedby") ?? ""
      )
      expect(description).toHaveAttribute("aria-hidden", "true")
      // Laid out (not display: none), so browsers compute clean spacing.
      expect(description).not.toHaveAttribute("hidden")
      expect(description?.querySelector("a")).toBeNull()
    })

    it("cancels a pending tooltip when the link is clicked", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onClick = createNavClickHandler()
      render(<SidebarNavLink {...getProps({ help: HELP, onClick })} />)
      const link = screen.getByRole("link", { name: "Test" })

      await user.hover(link)
      act(() => {
        vi.advanceTimersByTime(NAV_HELP_TOOLTIP_HOVER_DELAY_MS / 2)
      })
      await user.click(link)
      act(() => {
        vi.advanceTimersByTime(NAV_HELP_TOOLTIP_HOVER_DELAY_MS)
      })

      expect(onClick).toHaveBeenCalledTimes(1)
      expect(screen.queryByTestId("stTooltipContent")).not.toBeInTheDocument()
    })

    it("closes an open tooltip when the link is clicked", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onClick = createNavClickHandler()
      render(<SidebarNavLink {...getProps({ help: HELP, onClick })} />)
      const link = screen.getByRole("link", { name: "Test" })

      await user.hover(link)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(NAV_HELP_TOOLTIP_HOVER_DELAY_MS)
      })
      expect(screen.getByTestId("stTooltipContent")).toBeVisible()

      await user.click(link)
      expect(screen.queryByTestId("stTooltipContent")).not.toBeInTheDocument()
    })

    it("keeps focus and the tooltip on the link when a link in its help is pressed", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(
        <SidebarNavLink
          {...getProps({ help: "See the [docs](https://docs.streamlit.io)." })}
        />
      )

      await user.tab()
      const navLink = screen.getByRole("link", { name: "Test" })
      const tooltipContent = screen.getByTestId("stTooltipContent")
      const helpLink = within(tooltipContent).getByText("docs")
      // Press without release, so jsdom does not try to open the link.
      await user.pointer({ keys: "[MouseLeft>]", target: helpLink })

      expect(navLink).toHaveFocus()
      expect(screen.getByTestId("stTooltipContent")).toContainElement(helpLink)
    })

    it.each([undefined, null, ""])(
      "renders the plain link without a tooltip for help=%j",
      help => {
        render(<SidebarNavLink {...getProps({ help })} />)

        const link = screen.getByRole("link", { name: "Test" })
        expect(link).not.toHaveAttribute("aria-describedby")
        expect(
          screen.queryByTestId("stTooltipHoverTarget")
        ).not.toBeInTheDocument()
        // The link is the container's only child: no wrapper, no description.
        const container = screen.getByTestId("stSidebarNavLinkContainer")
        expect(link.parentElement).toBe(container)
        expect(container.childElementCount).toBe(1)
      }
    )
  })
})
