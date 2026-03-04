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

import { act, screen } from "@testing-library/react"
import {
  PointerEventsCheckLevel,
  userEvent,
} from "@testing-library/user-event"

import { MetricsManager } from "@streamlit/app/src/MetricsManager"
import ScreenCastRecorder from "@streamlit/app/src/util/ScreenCastRecorder"
import {
  AUTO_THEME_NAME,
  CUSTOM_THEME_NAME,
  darkTheme,
  IMenuItem,
  lightTheme,
  mockSessionInfo,
  ThemeConfig,
} from "@streamlit/lib"
import { render, renderWithContexts } from "@streamlit/lib/testing"
import { Config } from "@streamlit/protobuf"

import MainMenu, { formatDisplayVersion, Props } from "./MainMenu"
import { getMenuLabels, openMenu } from "./mainMenuTestHelpers"

// Mock ScreenCastRecorder for browser support tests
vi.mock("@streamlit/app/src/util/ScreenCastRecorder", () => ({
  default: {
    isSupportedBrowser: vi.fn(() => true),
  },
}))

const mockCopyToClipboard = vi.fn()
vi.mock("~lib/hooks/useCopyToClipboard", () => ({
  useCopyToClipboard: () => ({
    isCopied: false,
    copyToClipboard: mockCopyToClipboard,
    label: "Copy to clipboard",
  }),
}))

const getProps = (extend?: Partial<Props>): Props => ({
  aboutCallback: vi.fn(),
  printCallback: vi.fn(),
  clearCacheCallback: vi.fn(),
  isServerConnected: true,
  quickRerunCallback: vi.fn(),
  hostMenuItems: [],
  screencastCallback: vi.fn(),
  screenCastState: "OFF",
  sendMessageToHost: vi.fn(),
  menuItems: {},
  developmentMode: true,
  metricsMgr: new MetricsManager(mockSessionInfo()),
  toolbarMode: Config.ToolbarMode.AUTO,
  runOnSave: false,
  onRunOnSaveChange: vi.fn(),
  allowRunOnSave: true,
  ...extend,
})

describe("MainMenu", () => {
  // BaseWeb's StatefulPopover uses timers internally, so we need fake timers
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders without crashing", () => {
    const props = getProps()
    render(<MainMenu {...props} />)

    expect(screen.getByTestId("stMainMenu")).toBeInTheDocument()
  })

  // userEvent only emits modern key values; legacy Spacebar variants are handled
  // in production but not emitted by userEvent in tests.
  it.each([["{Enter}"], ["{Space}"]])(
    "opens the menu with keyboard (%s)",
    async key => {
      const props = getProps()
      render(<MainMenu {...props} />)

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const menuButton = screen.getByTestId("stMainMenuButton")
      menuButton.focus()

      await user.keyboard(key)
      vi.runOnlyPendingTimers()

      expect(screen.getByTestId("stMainMenuPopover")).toBeVisible()
    }
  )

  it("moves focus with arrow keys", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)
    await openMenu()

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const rerunItem = screen.getByTestId("stMainMenuItem-rerun")
    const toggleItem = screen.getByTestId("stMainMenuItem-autoRerun")

    // Rerun is the first dev item
    expect(rerunItem).toHaveFocus()

    // ArrowDown moves to the Auto-rerun toggle (next in DOM order)
    await user.keyboard("{ArrowDown}")
    expect(toggleItem).toHaveFocus()

    // ArrowUp returns to Rerun
    await user.keyboard("{ArrowUp}")
    expect(rerunItem).toHaveFocus()
  })

  it("moves focus to first and last items with Home/End", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)
    await openMenu()

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const menuItems = screen.getAllByRole("menuitem")

    await user.keyboard("{End}")
    expect(menuItems[menuItems.length - 1]).toHaveFocus()

    await user.keyboard("{Home}")
    expect(menuItems[0]).toHaveFocus()
  })

  it("wraps focus when navigating past the ends", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)
    await openMenu()

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const menuItems = screen.getAllByRole("menuitem")

    await user.keyboard("{End}")
    expect(menuItems[menuItems.length - 1]).toHaveFocus()

    await user.keyboard("{ArrowDown}")
    expect(menuItems[0]).toHaveFocus()

    await user.keyboard("{ArrowUp}")
    expect(menuItems[menuItems.length - 1]).toHaveFocus()
  })

  it("focuses disabled items when navigating (WAI-ARIA: all menuitems are focusable)", async () => {
    // Menu order (dev mode, disconnected, no theme radios in default context):
    //   Rerun*, Auto-rerun*, Clear cache*, Print, ...
    // (* = disabled when server disconnected)
    const props = getProps({
      isServerConnected: false,
      developmentMode: true,
    })
    render(<MainMenu {...props} />)
    await openMenu()

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const rerunItem = screen.getByTestId("stMainMenuItem-rerun")

    // Rerun is the first item in the default context (no theme radios)
    expect(rerunItem).toHaveFocus()
    expect(rerunItem).toHaveAttribute("aria-disabled", "true")

    // ArrowDown moves to Auto-rerun toggle (disabled but still focusable)
    await user.keyboard("{ArrowDown}")
    const toggleItem = screen.getByTestId("stMainMenuItem-autoRerun")
    expect(toggleItem).toHaveFocus()
    expect(toggleItem).toHaveAttribute("aria-disabled", "true")
  })

  it("focuses first item on mount even when some items are disabled", async () => {
    const props = getProps({
      isServerConnected: false,
      developmentMode: true,
    })
    render(<MainMenu {...props} />)
    await openMenu()

    // First item (Rerun) receives initial focus per WAI-ARIA.
    const rerunItem = screen.getByTestId("stMainMenuItem-rerun")
    expect(rerunItem).toHaveFocus()
  })

  it("navigates through disabled items without skipping", async () => {
    // Menu order (dev mode, disconnected, no theme radios in default context):
    //   Rerun*, Auto-rerun*, Clear cache*, Print, ...
    // (* = disabled when server disconnected)
    const props = getProps({
      isServerConnected: false,
      developmentMode: true,
    })
    render(<MainMenu {...props} />)
    await openMenu()

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const rerunItem = screen.getByTestId("stMainMenuItem-rerun")
    const clearCacheItem = screen.getByTestId("stMainMenuItem-clearCache")

    // Focus starts on Rerun (disabled)
    expect(rerunItem).toHaveFocus()
    expect(rerunItem).toHaveAttribute("aria-disabled", "true")

    // ArrowDown → Auto-rerun toggle (disabled)
    await user.keyboard("{ArrowDown}")
    const toggleItem = screen.getByTestId("stMainMenuItem-autoRerun")
    expect(toggleItem).toHaveAttribute("aria-disabled", "true")

    // ArrowDown → Clear cache (disabled), not skipped
    await user.keyboard("{ArrowDown}")
    expect(clearCacheItem).toHaveFocus()
    expect(clearCacheItem).toHaveAttribute("aria-disabled", "true")

    // ArrowUp → Auto-rerun toggle (disabled), not skipped
    await user.keyboard("{ArrowUp}")
    expect(toggleItem).toHaveFocus()
  })

  it("activates a focused menu item with Enter", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)
    await openMenu()

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    // Rerun is the first item (no theme radios in default context)
    const rerunItem = screen.getByTestId("stMainMenuItem-rerun")
    expect(rerunItem).toHaveFocus()

    // Press Enter to activate
    await user.keyboard("{Enter}")
    expect(props.quickRerunCallback).toHaveBeenCalled()
  })

  it("activates a focused menu item with Space", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)
    await openMenu()

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    // Rerun is the first item (no theme radios in default context)
    const rerunItem = screen.getByTestId("stMainMenuItem-rerun")
    expect(rerunItem).toHaveFocus()

    // Press Space to activate
    await user.keyboard(" ")
    expect(props.quickRerunCallback).toHaveBeenCalled()
  })

  it("closes the menu when Escape is pressed inside menu content", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)
    await openMenu()

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    // Press Escape while focus is inside the menu
    await user.keyboard("{Escape}")
    // Flush React state updates and BaseWeb's animateOut timers
    act(() => {
      vi.runAllTimers()
    })

    expect(screen.queryByTestId("stMainMenuPopover")).not.toBeInTheDocument()
  })

  it("closes the menu when Tab is pressed without returning focus to trigger", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)
    await openMenu()

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    await user.keyboard("{Tab}")
    act(() => {
      vi.runAllTimers()
    })

    expect(screen.queryByTestId("stMainMenuPopover")).not.toBeInTheDocument()
    // Per WAI-ARIA, Tab should let focus advance — not force it back to trigger
    expect(screen.getByTestId("stMainMenuButton")).not.toHaveFocus()
  })

  it("closes the menu when Shift+Tab is pressed without returning focus to trigger", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)
    await openMenu()

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    await user.keyboard("{Shift>}{Tab}{/Shift}")
    act(() => {
      vi.runAllTimers()
    })

    expect(screen.queryByTestId("stMainMenuPopover")).not.toBeInTheDocument()
    // Per WAI-ARIA, Shift+Tab should let focus move back — not force it to trigger
    expect(screen.getByTestId("stMainMenuButton")).not.toHaveFocus()
  })

  it("returns focus to menu button after Escape closes menu", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)

    await openMenu()

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.keyboard("{Escape}")

    // Flush BaseWeb's animateOut timers so the popover unmounts and
    // react-focus-lock invokes our returnFocus callback synchronously.
    act(() => {
      vi.runAllTimers()
    })

    expect(screen.getByTestId("stMainMenuButton")).toHaveFocus()
  })

  it("returns focus to menu button after item click closes menu", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)

    await openMenu()

    // Click a menu item to close the popover (triggers onClose → handlePopoverClose)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByTestId("stMainMenuItem-rerun"))

    // Flush BaseWeb's animateOut timers so the popover unmounts and
    // react-focus-lock invokes our returnFocus callback synchronously.
    act(() => {
      vi.runAllTimers()
    })

    // Get a fresh reference since DOM may have been recreated during re-renders
    expect(screen.getByTestId("stMainMenuButton")).toHaveFocus()
  })

  it("applies roving tabindex: focused item has tabIndex 0, others -1", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)
    await openMenu()

    const menuItems = screen.getAllByRole("menuitem")

    // First item should be focused with tabIndex 0
    expect(menuItems[0]).toHaveAttribute("tabindex", "0")

    // All other items should have tabIndex -1
    for (let i = 1; i < menuItems.length; i++) {
      expect(menuItems[i]).toHaveAttribute("tabindex", "-1")
    }

    // Navigate down - tabindex should follow focus (next item is Auto-rerun toggle)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.keyboard("{ArrowDown}")

    const toggleItem = screen.getByTestId("stMainMenuItem-autoRerun")
    expect(menuItems[0]).toHaveAttribute("tabindex", "-1")
    expect(toggleItem).toHaveAttribute("tabindex", "0")
  })

  it("syncs focusedIndex when an item receives focus directly (e.g. mouse click)", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)
    await openMenu()

    const menuItems = screen.getAllByRole("menuitem")
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    // Simulate mouse-driven focus by directly focusing item at index 2.
    // The onFocus delegation handler should sync focusedIndex so the
    // next ArrowDown starts from index 2, not from 0.
    // Wrapped in act() because .focus() triggers handleMenuFocus → setFocusedIndex.
    act(() => {
      menuItems[2].focus()
    })
    expect(menuItems[2]).toHaveFocus()

    await user.keyboard("{ArrowDown}")
    expect(menuItems[3]).toHaveFocus()
    expect(menuItems[3]).toHaveAttribute("tabindex", "0")
  })

  it("renders menu container with role='menu' and aria-label", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)
    await openMenu()

    const menuContainer = screen.getByTestId("stMainMenuList")
    expect(menuContainer).toHaveAttribute("role", "menu")
    expect(menuContainer).toHaveAttribute("aria-label", "Main menu")
  })

  it("renders all visible items with role='menuitem'", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)
    await openMenu()

    const menuItems = screen.getAllByRole("menuitem")
    // developmentMode: true gives Rerun, Clear cache, Print, Record screen
    expect(menuItems).toHaveLength(4)
  })

  it("renders disabled items with aria-disabled", async () => {
    const props = getProps({
      isServerConnected: false,
      developmentMode: true,
    })
    render(<MainMenu {...props} />)
    await openMenu()

    const rerunItem = screen.getByTestId("stMainMenuItem-rerun")
    const clearCacheItem = screen.getByTestId("stMainMenuItem-clearCache")

    expect(rerunItem).toHaveAttribute("aria-disabled", "true")
    expect(clearCacheItem).toHaveAttribute("aria-disabled", "true")
  })

  it("renders dividers with role='separator'", async () => {
    const props = getProps({ developmentMode: true })
    render(<MainMenu {...props} />)
    await openMenu()

    const dividers = screen.getAllByTestId("stMainMenuDivider")
    expect(dividers.length).toBeGreaterThan(0)
    dividers.forEach(divider => {
      expect(divider).toHaveAttribute("role", "separator")
      expect(divider).toHaveAttribute("aria-hidden", "true")
    })
  })

  it("menu button has accessible aria-label", () => {
    const props = getProps()
    render(<MainMenu {...props} />)

    const menuButton = screen.getByTestId("stMainMenuButton")
    expect(menuButton).toHaveAttribute("aria-label", "Main menu")
  })

  it("menu button has aria-haspopup='menu'", () => {
    const props = getProps()
    render(<MainMenu {...props} />)

    const menuButton = screen.getByTestId("stMainMenuButton")
    expect(menuButton).toHaveAttribute("aria-haspopup", "menu")
  })

  it("menu button has aria-expanded='false' when closed", () => {
    const props = getProps()
    render(<MainMenu {...props} />)

    const menuButton = screen.getByTestId("stMainMenuButton")
    expect(menuButton).toHaveAttribute("aria-expanded", "false")
  })

  it("menu button has aria-expanded='true' when open", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)

    await openMenu()

    const menuButton = screen.getByTestId("stMainMenuButton")
    expect(menuButton).toHaveAttribute("aria-expanded", "true")
  })

  it("menu button aria-expanded returns to 'false' after menu closes", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)

    await openMenu()
    expect(screen.getByTestId("stMainMenuButton")).toHaveAttribute(
      "aria-expanded",
      "true"
    )

    // Close the menu by clicking a menu item
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByTestId("stMainMenuItem-rerun"))

    // Flush BaseWeb's animateOut and our 50ms focus-return timer
    act(() => {
      vi.advanceTimersByTime(30)
    })
    act(() => {
      vi.advanceTimersByTime(30)
    })

    expect(screen.getByTestId("stMainMenuButton")).toHaveAttribute(
      "aria-expanded",
      "false"
    )
  })

  it("should render host menu items", async () => {
    const items: IMenuItem[] = [
      { type: "separator" },
      { type: "text", label: "View app source", key: "source" },
      { type: "text", label: "Report bug with app", key: "support" },
      { type: "separator" },
    ]
    const props = getProps({ hostMenuItems: items })
    render(<MainMenu {...props} />)
    await openMenu()

    expect(screen.getByTestId("stMainMenuItem-rerun")).toBeVisible()
    expect(screen.getByTestId("stMainMenuItem-clearCache")).toBeVisible()
    expect(screen.getByTestId("stMainMenuItem-print")).toBeVisible()
    expect(screen.getByTestId("stMainMenuItem-host-source")).toBeVisible()
    expect(screen.getByTestId("stMainMenuItem-host-support")).toBeVisible()
  })

  it("should not render configurable elements when hidden", async () => {
    const menuItems = {
      hideGetHelp: true,
      hideReportABug: true,
      aboutSectionMd: "",
    }
    const props = getProps({ menuItems })
    render(<MainMenu {...props} />)
    await openMenu()

    expect(
      screen.queryByTestId("stMainMenuItem-community")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId("stMainMenuItem-report")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId("stMainMenuItem-about")
    ).not.toBeInTheDocument()
  })

  it("should not render report a bug when hidden", async () => {
    const menuItems = {
      getHelpUrl: "testing",
      hideGetHelp: false,
      hideReportABug: true,
      aboutSectionMd: "",
    }
    const props = getProps({ menuItems })
    render(<MainMenu {...props} />)
    await openMenu()

    expect(
      screen.queryByTestId("stMainMenuItem-report")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId("stMainMenuItem-about")
    ).not.toBeInTheDocument()
    expect(screen.getByTestId("stMainMenuItem-community")).toBeVisible()
  })

  it("should render report a bug when configured", async () => {
    const menuItems = {
      reportABugUrl: "testing",
      hideGetHelp: false,
      hideReportABug: false,
      aboutSectionMd: "",
    }
    const props = getProps({ menuItems })
    render(<MainMenu {...props} />)
    await openMenu()

    expect(screen.getByTestId("stMainMenuItem-report")).toBeVisible()
    expect(
      screen.queryByTestId("stMainMenuItem-about")
    ).not.toBeInTheDocument()
  })

  it("should render Get help when URL provided", async () => {
    const menuItems = {
      getHelpUrl: "https://example.com/help",
    }
    const props = getProps({ menuItems })
    render(<MainMenu {...props} />)
    await openMenu()

    expect(screen.getByTestId("stMainMenuItem-community")).toBeVisible()
  })

  it("should render About when markdown provided", async () => {
    const menuItems = {
      aboutSectionMd: "# About\n\nThis is my app.",
    }
    const props = getProps({ menuItems })
    render(<MainMenu {...props} />)
    await openMenu()

    expect(screen.getByTestId("stMainMenuItem-about")).toBeVisible()
  })

  it("should call aboutCallback when About is clicked", async () => {
    const menuItems = {
      aboutSectionMd: "# About\n\nThis is my app.",
    }
    const props = getProps({ menuItems })
    render(<MainMenu {...props} />)
    await openMenu()

    screen.getByTestId("stMainMenuItem-about").click()

    expect(props.aboutCallback).toHaveBeenCalled()
  })

  it("should open URL when Get help is clicked", async () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null)
    const menuItems = {
      getHelpUrl: "https://example.com/help",
    }
    const props = getProps({ menuItems })
    render(<MainMenu {...props} />)
    await openMenu()

    screen.getByTestId("stMainMenuItem-community").click()

    expect(windowOpenSpy).toHaveBeenCalledWith(
      "https://example.com/help",
      "_blank"
    )
    windowOpenSpy.mockRestore()
  })

  it("should open URL when Report a bug is clicked", async () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null)
    const menuItems = {
      reportABugUrl: "https://example.com/bug",
    }
    const props = getProps({ menuItems })
    render(<MainMenu {...props} />)
    await openMenu()

    screen.getByTestId("stMainMenuItem-report").click()

    expect(windowOpenSpy).toHaveBeenCalledWith(
      "https://example.com/bug",
      "_blank"
    )
    windowOpenSpy.mockRestore()
  })

  it("should not render dev items (Rerun, Auto-rerun, Clear cache) when developmentMode is false", async () => {
    const props = getProps({ developmentMode: false })
    render(<MainMenu {...props} />)
    await openMenu()

    expect(
      screen.queryByTestId("stMainMenuItem-rerun")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId("stMainMenuItem-autoRerun")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId("stMainMenuItem-clearCache")
    ).not.toBeInTheDocument()
    // Print is always visible
    expect(screen.getByTestId("stMainMenuItem-print")).toBeVisible()
  })

  it.each([
    [Config.ToolbarMode.AUTO],
    [Config.ToolbarMode.DEVELOPER],
    [Config.ToolbarMode.VIEWER],
    [Config.ToolbarMode.MINIMAL],
  ])("should render host menu items if available[%s]", async toolbarMode => {
    const props = getProps({
      toolbarMode,
      hostMenuItems: [
        { label: "Host menu item", key: "host-item", type: "text" },
      ],
    })
    const view = render(<MainMenu {...props} />)
    await openMenu()

    const labels = getMenuLabels(view)
    expect(labels).toContain("Host menu item")
  })

  it("should hide main menu when toolbarMode is Minimal and no host items", () => {
    const props = getProps({
      developmentMode: false,
      toolbarMode: Config.ToolbarMode.MINIMAL,
      hostMenuItems: [],
    })

    render(<MainMenu {...props} />)

    expect(screen.queryByTestId("stMainMenuButton")).not.toBeInTheDocument()
  })

  it("should render host menu items in minimal mode", async () => {
    const props = getProps({
      developmentMode: false,
      toolbarMode: Config.ToolbarMode.MINIMAL,
      hostMenuItems: [
        { type: "separator" },
        { type: "text", label: "View all apps", key: "viewAllApps" },
        { type: "separator" },
        { type: "text", label: "About Streamlit Cloud", key: "about" },
        { type: "separator" },
      ],
    })
    const view = render(<MainMenu {...props} />)
    await openMenu()

    const labels = getMenuLabels(view)
    expect(labels).toContain("View all apps")
  })

  it("should hide host 'about' item when developer provides aboutSectionMd", async () => {
    const props = getProps({
      hostMenuItems: [
        { type: "text", label: "About Streamlit Cloud", key: "about" },
      ],
      menuItems: {
        aboutSectionMd: "# My Custom About",
      },
    })
    const view = render(<MainMenu {...props} />)
    await openMenu()

    const labels = getMenuLabels(view)
    // Developer's About should be shown
    expect(labels).toContain("About")
    // Host's "About Streamlit Cloud" should be hidden
    expect(labels).not.toContain("About Streamlit Cloud")
  })

  it("should hide host 'reportBug' item when developer sets hideGetHelp", async () => {
    const props = getProps({
      hostMenuItems: [
        { type: "text", label: "Report Bug to Host", key: "reportBug" },
      ],
      menuItems: {
        hideGetHelp: true,
      },
    })
    const view = render(<MainMenu {...props} />)
    await openMenu()

    const labels = getMenuLabels(view)
    // Host's reportBug item should be hidden
    expect(labels).not.toContain("Report Bug to Host")
  })

  it("should show host items that don't conflict with developer settings", async () => {
    const props = getProps({
      hostMenuItems: [
        { type: "text", label: "Fork this app", key: "fork" },
        { type: "text", label: "About Streamlit Cloud", key: "about" },
      ],
      menuItems: {
        aboutSectionMd: "# My Custom About",
      },
    })
    const view = render(<MainMenu {...props} />)
    await openMenu()

    const labels = getMenuLabels(view)
    // Non-conflicting host item should be shown
    expect(labels).toContain("Fork this app")
    // Conflicting host item should be hidden (developer's About takes precedence)
    expect(labels).not.toContain("About Streamlit Cloud")
    // Developer's About should be shown
    expect(labels).toContain("About")
  })

  it.each([
    [
      ["getHelpUrl", "reportABugUrl", "aboutSectionMd"],
      ["Report a bug", "Get help", "About"],
    ],
    [["getHelpUrl"], ["Get help"]],
    [["reportABugUrl"], ["Report a bug"]],
    [["aboutSectionMd"], ["About"]],
  ])(
    "should render custom items in minimal mode[%s]",
    async (menuItemKeys, expectedLabels) => {
      const allMenuItems = {
        getHelpUrl: "https://www.extremelycoolapp.com/help",
        reportABugUrl: "https://www.extremelycoolapp.com/bug",
        aboutSectionMd: "# This is a header. This is an *extremely* cool app!",
      }
      const props = getProps({
        developmentMode: false,
        toolbarMode: Config.ToolbarMode.MINIMAL,
        menuItems: Object.fromEntries(
          Object.entries(allMenuItems).filter(d => menuItemKeys.includes(d[0]))
        ),
      })

      const view = render(<MainMenu {...props} />)
      await openMenu()

      const labels = getMenuLabels(view)
      expectedLabels.forEach(label => {
        expect(labels).toContain(label)
      })
    }
  )

  it("should render host menu items and custom items in minimal mode", async () => {
    const props = getProps({
      developmentMode: false,
      toolbarMode: Config.ToolbarMode.MINIMAL,
      hostMenuItems: [
        { type: "separator" },
        { type: "text", label: "View all apps", key: "viewAllApps" },
        { type: "separator" },
        { type: "text", label: "About Streamlit Cloud", key: "about" },
        { type: "separator" },
      ],
      menuItems: {
        getHelpUrl: "https://www.extremelycoolapp.com/help",
        reportABugUrl: "https://www.extremelycoolapp.com/bug",
        aboutSectionMd: "# This is a header. This is an *extremely* cool app!",
      },
    })
    const view = render(<MainMenu {...props} />)
    await openMenu()

    const labels = getMenuLabels(view)
    expect(labels).toContain("Report a bug")
    expect(labels).toContain("Get help")
    expect(labels).toContain("View all apps")
    expect(labels).toContain("About")
  })

  it("should disable Rerun and Clear cache when server is disconnected", async () => {
    const props = getProps({
      isServerConnected: false,
      developmentMode: true,
    })
    render(<MainMenu {...props} />)
    await openMenu()

    const rerunButton = screen.getByTestId("stMainMenuItem-rerun")
    const clearCacheButton = screen.getByTestId("stMainMenuItem-clearCache")

    expect(rerunButton).toHaveAttribute("aria-disabled", "true")
    expect(clearCacheButton).toHaveAttribute("aria-disabled", "true")
  })

  it("should call callbacks when menu items are clicked", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)
    await openMenu()

    screen.getByTestId("stMainMenuItem-rerun").click()

    expect(props.quickRerunCallback).toHaveBeenCalled()
  })

  it("should display keyboard shortcuts for Rerun and Clear cache", async () => {
    const props = getProps({ developmentMode: true })
    render(<MainMenu {...props} />)
    await openMenu()

    // Check that shortcuts are rendered
    const rerunItem = screen.getByTestId("stMainMenuItem-rerun")
    const clearCacheItem = screen.getByTestId("stMainMenuItem-clearCache")

    expect(rerunItem).toHaveTextContent("R")
    expect(clearCacheItem).toHaveTextContent("C")
  })

  it("should render menu items in correct order", async () => {
    const props = getProps({ developmentMode: true })
    const view = render(<MainMenu {...props} />)
    await openMenu()

    const labels = getMenuLabels(view)
    // getMenuLabels only captures action item labels (not toggle items)
    expect(labels).toEqual(["Rerun", "Clear cache", "Print", "Record screen"])

    // Auto-rerun toggle appears between Rerun and Clear cache
    expect(screen.getByTestId("stMainMenuItem-autoRerun")).toBeVisible()
  })

  it("should render About after standard items and before common items", async () => {
    const props = getProps({
      developmentMode: true,
      menuItems: {
        getHelpUrl: "https://help.example.com",
        reportABugUrl: "https://bug.example.com",
        aboutSectionMd: "# About This App",
      },
    })
    const view = render(<MainMenu {...props} />)
    await openMenu()

    const labels = getMenuLabels(view)
    const aboutIndex = labels.indexOf("About")
    const printIndex = labels.indexOf("Print")
    const reportIndex = labels.indexOf("Report a bug")
    const getHelpIndex = labels.indexOf("Get help")
    // About is in the same section as Print/Record, after them
    expect(aboutIndex).toBeGreaterThan(printIndex)
    // Common items (Report a bug, Get help) follow in the next section
    expect(reportIndex).toBeGreaterThan(aboutIndex)
    expect(getHelpIndex).toBeGreaterThan(aboutIndex)
  })

  it("should render About last in minimal mode", async () => {
    const props = getProps({
      developmentMode: false,
      toolbarMode: Config.ToolbarMode.MINIMAL,
      menuItems: {
        getHelpUrl: "https://help.example.com",
        reportABugUrl: "https://bug.example.com",
        aboutSectionMd: "# About This App",
      },
    })
    const view = render(<MainMenu {...props} />)
    await openMenu()

    const labels = getMenuLabels(view)
    // Verify About is always the last item in minimal mode
    expect(labels[labels.length - 1]).toBe("About")
  })

  it("should track metrics when menu item is clicked", async () => {
    const props = getProps()
    const enqueueSpy = vi.spyOn(props.metricsMgr, "enqueue")
    render(<MainMenu {...props} />)
    await openMenu()

    screen.getByTestId("stMainMenuItem-rerun").click()

    expect(enqueueSpy).toHaveBeenCalledWith("menuClick", { label: "Rerun" })
  })

  it("should show host about item when aboutSectionMd is empty string", async () => {
    // When aboutSectionMd is explicitly set to empty string,
    // the host's about item should be shown (no developer override)
    const props = getProps({
      hostMenuItems: [
        { type: "text", label: "About Streamlit Cloud", key: "about" },
      ],
      menuItems: {
        aboutSectionMd: "",
      },
    })
    const view = render(<MainMenu {...props} />)
    await openMenu()

    const labels = getMenuLabels(view)
    // Host's about item should be visible since developer didn't provide custom About
    expect(labels).toContain("About Streamlit Cloud")
    // Developer's About should NOT be shown (empty string means no custom About)
    expect(
      screen.queryByTestId("stMainMenuItem-about")
    ).not.toBeInTheDocument()
  })

  it("should not render Record screen when browser does not support it", async () => {
    // Mock isSupportedBrowser to return false
    vi.mocked(ScreenCastRecorder.isSupportedBrowser).mockReturnValue(false)

    const props = getProps()
    const view = render(<MainMenu {...props} />)
    await openMenu()

    const labels = getMenuLabels(view)
    expect(labels).not.toContain("Record screen")

    // Restore mock for other tests
    vi.mocked(ScreenCastRecorder.isSupportedBrowser).mockReturnValue(true)
  })

  it("should render Record screen when browser supports it", async () => {
    vi.mocked(ScreenCastRecorder.isSupportedBrowser).mockReturnValue(true)

    const props = getProps()
    const view = render(<MainMenu {...props} />)
    await openMenu()

    const labels = getMenuLabels(view)
    expect(labels).toContain("Record screen")
  })

  it("should show 'Cancel recording' with ESC shortcut when screenCastState is COUNTDOWN", async () => {
    const props = getProps({ screenCastState: "COUNTDOWN" })
    const view = render(<MainMenu {...props} />)
    await openMenu()

    const labels = getMenuLabels(view)
    expect(labels).toContain("Cancel recording")
    expect(labels).not.toContain("Record screen")

    const recordItem = screen.getByTestId("stMainMenuItem-recordScreencast")
    expect(recordItem).toHaveTextContent("ESC")
  })

  it("should show 'Stop recording' with ESC shortcut when screenCastState is RECORDING", async () => {
    const props = getProps({ screenCastState: "RECORDING" })
    const view = render(<MainMenu {...props} />)
    await openMenu()

    const labels = getMenuLabels(view)
    expect(labels).toContain("Stop recording")
    expect(labels).not.toContain("Record screen")

    const recordItem = screen.getByTestId("stMainMenuItem-recordScreencast")
    expect(recordItem).toHaveTextContent("ESC")
  })

  it("should not show ESC shortcut when screenCastState is OFF", async () => {
    const props = getProps({ screenCastState: "OFF" })
    render(<MainMenu {...props} />)
    await openMenu()

    const recordItem = screen.getByTestId("stMainMenuItem-recordScreencast")
    expect(recordItem).not.toHaveTextContent("ESC")
  })

  it("should style recording menu item with recording state", async () => {
    const props = getProps({ screenCastState: "RECORDING" })
    render(<MainMenu {...props} />)
    await openMenu()

    // The menu item should exist with the recording label
    const recordingItem = screen.getByTestId("stMainMenuItem-recordScreencast")
    expect(recordingItem).toBeVisible()
  })

  it("should not call callback when clicking disabled item", async () => {
    const props = getProps({ isServerConnected: false })
    render(<MainMenu {...props} />)
    await openMenu()

    // Click disabled Rerun button
    screen.getByTestId("stMainMenuItem-rerun").click()

    // Callback should not have been called
    expect(props.quickRerunCallback).not.toHaveBeenCalled()
  })

  it("should show recording indicator when recording", () => {
    const props = getProps({ screenCastState: "RECORDING" })
    render(<MainMenu {...props} />)

    expect(
      screen.getByTestId("stMainMenuRecordingIndicator")
    ).toBeInTheDocument()
  })

  it("should not show recording indicator when not recording", () => {
    const props = getProps({ screenCastState: "OFF" })
    render(<MainMenu {...props} />)

    expect(
      screen.queryByTestId("stMainMenuRecordingIndicator")
    ).not.toBeInTheDocument()
  })

  describe("Theme radio items", () => {
    // Create a fake auto theme for testing
    const autoTheme: ThemeConfig = {
      ...lightTheme,
      name: AUTO_THEME_NAME,
    }

    const defaultAvailableThemes = [autoTheme, lightTheme, darkTheme]

    function renderWithThemes(
      propsOverride?: Partial<Props>,
      themeOverride?: {
        activeTheme?: ThemeConfig
        availableThemes?: ThemeConfig[]
        setTheme?: (theme: ThemeConfig) => void
      }
    ): ReturnType<typeof renderWithContexts> {
      const props = getProps(propsOverride)
      return renderWithContexts(<MainMenu {...props} />, {
        themeContext: {
          activeTheme: themeOverride?.activeTheme ?? autoTheme,
          availableThemes:
            themeOverride?.availableThemes ?? defaultAvailableThemes,
          setTheme: themeOverride?.setTheme ?? vi.fn(),
        },
      })
    }

    it("renders 3 theme radio items when themes are available", async () => {
      renderWithThemes()
      await openMenu()

      const radioItems = screen.getAllByRole("menuitemradio")
      expect(radioItems).toHaveLength(3)
      expect(radioItems[0]).toHaveTextContent("System")
      expect(radioItems[1]).toHaveTextContent("Light")
      expect(radioItems[2]).toHaveTextContent("Dark")
    })

    it("renders theme radio group with role='group' and aria-label='Theme'", async () => {
      renderWithThemes()
      await openMenu()

      const group = screen.getByTestId("stThemeSwitcher")
      expect(group).toHaveAttribute("role", "group")
      expect(group).toHaveAttribute("aria-label", "Theme")
    })

    it("does not render theme radio items when no themes are available", async () => {
      renderWithThemes(undefined, { availableThemes: [] })
      await openMenu()

      expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument()
      expect(screen.queryByTestId("stThemeSwitcher")).not.toBeInTheDocument()
    })

    it("does not render theme radio items when only a single custom theme", async () => {
      const customTheme: ThemeConfig = {
        ...lightTheme,
        name: CUSTOM_THEME_NAME,
      }
      renderWithThemes(undefined, {
        activeTheme: customTheme,
        availableThemes: [customTheme],
      })
      await openMenu()

      expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument()
    })

    it.each([
      ["System", autoTheme, 0, [true, false, false]],
      ["Light", lightTheme, 1, [false, true, false]],
      ["Dark", darkTheme, 2, [false, false, true]],
    ] as const)(
      "theme %s: renders aria-checked, calls setTheme on click, keeps menu open",
      async (_label, theme, index, expectedChecked) => {
        const setTheme = vi.fn()
        renderWithThemes(undefined, { activeTheme: theme, setTheme })
        await openMenu()

        const radioItems = screen.getAllByRole("menuitemradio")

        // Verify aria-checked reflects the active theme
        expectedChecked.forEach((checked, i) => {
          expect(radioItems[i]).toHaveAttribute(
            "aria-checked",
            String(checked)
          )
        })

        // Click a *different* radio to verify setTheme is called
        const targetIndex = (index + 1) % 3
        const targetTheme = [autoTheme, lightTheme, darkTheme][targetIndex]
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        await user.click(radioItems[targetIndex])

        expect(setTheme).toHaveBeenCalledWith(targetTheme)

        // Menu should remain open after selecting a theme
        expect(screen.getByTestId("stMainMenuPopover")).toBeVisible()
      }
    )

    // Note: " " (literal space) is used instead of "{Space}" because JSDOM
    // does not fire click on <button> elements for {Space} keyUp. The menu
    // button test uses {Space} because BaseWeb's popover handles it directly.
    it.each([["{Enter}"], [" "]])(
      "activates a theme radio item with keyboard (%s)",
      async key => {
        const setTheme = vi.fn()
        renderWithThemes(undefined, { setTheme })
        await openMenu()

        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        const radioItems = screen.getAllByRole("menuitemradio")

        // Navigate to Dark (third radio item)
        await user.keyboard("{ArrowDown}{ArrowDown}")
        expect(radioItems[2]).toHaveFocus()

        await user.keyboard(key)
        expect(setTheme).toHaveBeenCalledWith(darkTheme)
      }
    )

    it("focus remains on the selected theme after a theme is selected", async () => {
      const setTheme = vi.fn()
      renderWithThemes(undefined, { setTheme })
      await openMenu()

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const radioItems = screen.getAllByRole("menuitemradio")

      // Navigate to Dark (third radio item) and select it
      await user.keyboard("{ArrowDown}{ArrowDown}")
      expect(radioItems[2]).toHaveFocus()

      await user.click(radioItems[2])
      expect(setTheme).toHaveBeenCalled()

      // Focus should remain on the Dark radio item
      expect(radioItems[2]).toHaveFocus()
    })

    it("enqueues metrics when clicking a theme radio", async () => {
      const props = getProps()
      const enqueueSpy = vi.spyOn(props.metricsMgr, "enqueue")
      renderWithContexts(<MainMenu {...props} />, {
        themeContext: {
          activeTheme: autoTheme,
          availableThemes: defaultAvailableThemes,
          setTheme: vi.fn(),
        },
      })
      await openMenu()

      const lightRadio = screen.getByTestId("stMainMenuItem-theme-Light")
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.click(lightRadio)

      expect(enqueueSpy).toHaveBeenCalledWith("menuClick", {
        label: "changeTheme",
      })
    })

    it("navigates seamlessly from radio items to action items with ArrowDown", async () => {
      renderWithThemes()
      await openMenu()

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const radioItems = screen.getAllByRole("menuitemradio")
      const actionItems = screen.getAllByRole("menuitem")

      // Focus starts on System radio (first item)
      expect(radioItems[0]).toHaveFocus()

      // ArrowDown through radio items
      await user.keyboard("{ArrowDown}")
      expect(radioItems[1]).toHaveFocus() // Light

      await user.keyboard("{ArrowDown}")
      expect(radioItems[2]).toHaveFocus() // Dark

      // ArrowDown into action items (Rerun)
      await user.keyboard("{ArrowDown}")
      expect(actionItems[0]).toHaveFocus() // Rerun
    })

    it("navigates from action items back to radio items with ArrowUp", async () => {
      renderWithThemes()
      await openMenu()

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const radioItems = screen.getAllByRole("menuitemradio")
      const actionItems = screen.getAllByRole("menuitem")

      // Navigate to first action item (index 3 in flat list)
      await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}")
      expect(actionItems[0]).toHaveFocus() // Rerun

      // ArrowUp back to Dark radio
      await user.keyboard("{ArrowUp}")
      expect(radioItems[2]).toHaveFocus() // Dark
    })

    it("Home navigates to first radio item, End to last action item", async () => {
      renderWithThemes()
      await openMenu()

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const radioItems = screen.getAllByRole("menuitemradio")
      const actionItems = screen.getAllByRole("menuitem")

      // End should go to last action item
      await user.keyboard("{End}")
      expect(actionItems[actionItems.length - 1]).toHaveFocus()

      // Home should go to first radio item (System)
      await user.keyboard("{Home}")
      expect(radioItems[0]).toHaveFocus()
    })

    it("wraps focus from last action item to first radio item", async () => {
      renderWithThemes()
      await openMenu()

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const radioItems = screen.getAllByRole("menuitemradio")
      const actionItems = screen.getAllByRole("menuitem")

      // Go to last action item
      await user.keyboard("{End}")
      expect(actionItems[actionItems.length - 1]).toHaveFocus()

      // ArrowDown should wrap to first radio item
      await user.keyboard("{ArrowDown}")
      expect(radioItems[0]).toHaveFocus()
    })

    it("applies roving tabindex across radio and action items", async () => {
      renderWithThemes()
      await openMenu()

      const radioItems = screen.getAllByRole("menuitemradio")
      const actionItems = screen.getAllByRole("menuitem")

      // First radio item should have tabIndex 0
      expect(radioItems[0]).toHaveAttribute("tabindex", "0")
      expect(radioItems[1]).toHaveAttribute("tabindex", "-1")
      expect(radioItems[2]).toHaveAttribute("tabindex", "-1")
      expect(actionItems[0]).toHaveAttribute("tabindex", "-1")

      // Navigate to an action item
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}")
      expect(actionItems[0]).toHaveFocus()

      // Now action item has tabIndex 0, radios have -1
      expect(radioItems[0]).toHaveAttribute("tabindex", "-1")
      expect(actionItems[0]).toHaveAttribute("tabindex", "0")
    })

    it("menuitem count remains unchanged (radio items use different role)", async () => {
      renderWithThemes()
      await openMenu()

      // menuitemradio items should not be counted by getAllByRole("menuitem")
      const actionItems = screen.getAllByRole("menuitem")
      // developmentMode: true gives Rerun, Clear cache, Print, Record screen
      expect(actionItems).toHaveLength(4)

      // Radio items should be counted separately
      const radioItems = screen.getAllByRole("menuitemradio")
      expect(radioItems).toHaveLength(3)
    })

    it("renders theme radios in minimal mode when themes are available", async () => {
      renderWithThemes({
        toolbarMode: Config.ToolbarMode.MINIMAL,
        hostMenuItems: [
          { type: "text", label: "View all apps", key: "viewAllApps" },
        ],
      })
      await openMenu()

      const radioItems = screen.getAllByRole("menuitemradio")
      expect(radioItems).toHaveLength(3)
    })
  })

  describe("Auto-rerun toggle", () => {
    it("renders Auto-rerun toggle in dev mode", async () => {
      const props = getProps({
        developmentMode: true,
        allowRunOnSave: true,
        runOnSave: false,
      })
      render(<MainMenu {...props} />)
      await openMenu()

      const toggle = screen.getByTestId("stMainMenuItem-autoRerun")
      expect(toggle).toBeVisible()
      expect(toggle).toHaveAttribute("role", "menuitemcheckbox")
      expect(toggle).toHaveAttribute("aria-checked", "false")
    })

    it("does not render Auto-rerun toggle when developmentMode is false", async () => {
      const props = getProps({
        developmentMode: false,
        allowRunOnSave: true,
      })
      render(<MainMenu {...props} />)
      await openMenu()

      expect(
        screen.queryByTestId("stMainMenuItem-autoRerun")
      ).not.toBeInTheDocument()
    })

    it("does not render Auto-rerun toggle when allowRunOnSave is false", async () => {
      const props = getProps({
        developmentMode: true,
        allowRunOnSave: false,
      })
      render(<MainMenu {...props} />)
      await openMenu()

      expect(
        screen.queryByTestId("stMainMenuItem-autoRerun")
      ).not.toBeInTheDocument()
    })

    it("menu stays open after toggling auto-rerun", async () => {
      const props = getProps({
        developmentMode: true,
        allowRunOnSave: true,
        runOnSave: false,
      })
      render(<MainMenu {...props} />)
      await openMenu()

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const toggle = screen.getByTestId("stMainMenuItem-autoRerun")
      await user.click(toggle)

      expect(screen.getByTestId("stMainMenuPopover")).toBeVisible()
    })

    it("emits metrics when auto-rerun is toggled", async () => {
      const props = getProps({
        developmentMode: true,
        allowRunOnSave: true,
        runOnSave: false,
      })
      const enqueueSpy = vi.spyOn(props.metricsMgr, "enqueue")
      render(<MainMenu {...props} />)
      await openMenu()

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const toggle = screen.getByTestId("stMainMenuItem-autoRerun")
      await user.click(toggle)

      expect(enqueueSpy).toHaveBeenCalledWith("menuClick", {
        label: "autoRerun",
      })
    })

    it("Rerun is hidden when developmentMode is false", async () => {
      const props = getProps({ developmentMode: false })
      render(<MainMenu {...props} />)
      await openMenu()

      expect(
        screen.queryByTestId("stMainMenuItem-rerun")
      ).not.toBeInTheDocument()
    })

    it("toggle participates in roving tabindex", async () => {
      const props = getProps({
        developmentMode: true,
        allowRunOnSave: true,
      })
      render(<MainMenu {...props} />)
      await openMenu()

      const toggle = screen.getByTestId("stMainMenuItem-autoRerun")

      // Toggle should start with tabIndex -1 (not the focused item)
      expect(toggle).toHaveAttribute("tabindex", "-1")

      // Navigate to the toggle: Rerun(0) → toggle(1)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.keyboard("{ArrowDown}")
      expect(toggle).toHaveFocus()
      expect(toggle).toHaveAttribute("tabindex", "0")
    })

    it("toggle is reachable and focusable via keyboard navigation", async () => {
      const props = getProps({
        developmentMode: true,
        allowRunOnSave: true,
        runOnSave: false,
      })
      render(<MainMenu {...props} />)
      await openMenu()

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const toggle = screen.getByTestId("stMainMenuItem-autoRerun")

      // Navigate: Rerun → toggle
      await user.keyboard("{ArrowDown}")
      expect(toggle).toHaveFocus()

      // Continue past toggle to Clear cache
      await user.keyboard("{ArrowDown}")
      const clearCacheItem = screen.getByTestId("stMainMenuItem-clearCache")
      expect(clearCacheItem).toHaveFocus()

      // ArrowUp back to toggle
      await user.keyboard("{ArrowUp}")
      expect(toggle).toHaveFocus()
    })
  })

  describe("version footer", () => {
    it("renders the version footer when streamlitVersion is provided", async () => {
      const props = getProps({ streamlitVersion: "1.46.1" })
      render(<MainMenu {...props} />)
      await openMenu()

      expect(
        screen.getByText("Made with Streamlit v1.46.1")
      ).toBeInTheDocument()
    })

    it("does not render the footer when streamlitVersion is undefined", async () => {
      const props = getProps({ streamlitVersion: undefined })
      render(<MainMenu {...props} />)
      await openMenu()

      expect(
        screen.queryByText(/Made with Streamlit v/)
      ).not.toBeInTheDocument()
    })

    it("truncates nightly version for display", async () => {
      const props = getProps({ streamlitVersion: "1.54.1.dev20260217" })
      render(<MainMenu {...props} />)
      await openMenu()

      expect(
        screen.getByText("Made with Streamlit v1.54.1.dev")
      ).toBeInTheDocument()
    })

    it("copies the full (untruncated) version string to clipboard", async () => {
      const user = userEvent.setup({
        advanceTimers: vi.advanceTimersByTime,
        pointerEventsCheck: PointerEventsCheckLevel.Never,
      })

      const props = getProps({ streamlitVersion: "1.54.1.dev20260217" })
      render(<MainMenu {...props} />)
      await openMenu()

      await user.click(
        screen.getByRole("button", { name: "Copy version to clipboard" })
      )

      expect(mockCopyToClipboard).toHaveBeenCalledWith("1.54.1.dev20260217")
    })

    it("renders the footer in minimal mode", async () => {
      const props = getProps({
        streamlitVersion: "1.46.1",
        toolbarMode: Config.ToolbarMode.MINIMAL,
        menuItems: { getHelpUrl: "https://example.com" },
      })
      render(<MainMenu {...props} />)
      await openMenu()

      expect(
        screen.getByText("Made with Streamlit v1.46.1")
      ).toBeInTheDocument()
    })

    it("renders the CopyButton outside role=menu", async () => {
      const props = getProps({ streamlitVersion: "1.46.1" })
      render(<MainMenu {...props} />)
      await openMenu()

      const menu = screen.getByRole("menu", { name: "Main menu" })
      const copyButton = screen.getByRole("button", {
        name: "Copy version to clipboard",
      })

      expect(menu).not.toContainElement(copyButton)
    })

    it("does not close the menu on Tab from a menu item when footer exists", async () => {
      const props = getProps({ streamlitVersion: "1.46.1" })
      render(<MainMenu {...props} />)
      await openMenu()

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await user.keyboard("{Tab}")
      act(() => {
        vi.runAllTimers()
      })

      expect(screen.getByTestId("stMainMenuPopover")).toBeInTheDocument()
    })

    it("closes the menu on forward Tab from the CopyButton", async () => {
      const props = getProps({ streamlitVersion: "1.46.1" })
      render(<MainMenu {...props} />)
      await openMenu()

      const copyButton = screen.getByRole("button", {
        name: "Copy version to clipboard",
      })
      act(() => {
        copyButton.focus()
      })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.keyboard("{Tab}")
      act(() => {
        vi.runAllTimers()
      })

      expect(screen.queryByTestId("stMainMenuPopover")).not.toBeInTheDocument()
    })

    it("does not close the menu on Shift+Tab from the CopyButton", async () => {
      const props = getProps({ streamlitVersion: "1.46.1" })
      render(<MainMenu {...props} />)
      await openMenu()

      const copyButton = screen.getByRole("button", {
        name: "Copy version to clipboard",
      })
      act(() => {
        copyButton.focus()
      })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.keyboard("{Shift>}{Tab}{/Shift}")
      act(() => {
        vi.runAllTimers()
      })

      expect(screen.getByTestId("stMainMenuPopover")).toBeInTheDocument()
    })

    it("closes the menu on Escape from the CopyButton", async () => {
      const props = getProps({ streamlitVersion: "1.46.1" })
      render(<MainMenu {...props} />)
      await openMenu()

      const copyButton = screen.getByRole("button", {
        name: "Copy version to clipboard",
      })
      act(() => {
        copyButton.focus()
      })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.keyboard("{Escape}")
      act(() => {
        vi.runAllTimers()
      })

      expect(screen.queryByTestId("stMainMenuPopover")).not.toBeInTheDocument()
    })
  })
})

describe("formatDisplayVersion", () => {
  it("returns stable releases unchanged", () => {
    expect(formatDisplayVersion("1.46.1")).toBe("1.46.1")
  })

  it("strips date digits from nightly versions", () => {
    expect(formatDisplayVersion("1.54.1.dev20260217")).toBe("1.54.1.dev")
  })

  it("handles versions without dev suffix", () => {
    expect(formatDisplayVersion("2.0.0")).toBe("2.0.0")
  })

  it("handles dev suffix without digits", () => {
    expect(formatDisplayVersion("1.0.0.dev")).toBe("1.0.0.dev")
  })
})
