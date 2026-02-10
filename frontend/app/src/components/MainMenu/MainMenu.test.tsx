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
import { userEvent } from "@testing-library/user-event"

import { MetricsManager } from "@streamlit/app/src/MetricsManager"
import ScreenCastRecorder from "@streamlit/app/src/util/ScreenCastRecorder"
import { IMenuItem, mockSessionInfo } from "@streamlit/lib"
import { render } from "@streamlit/lib/testing"
import { Config } from "@streamlit/protobuf"

import MainMenu, { Props } from "./MainMenu"
import { getMenuLabels, openMenu } from "./mainMenuTestHelpers"

// Mock ScreenCastRecorder for browser support tests
vi.mock("@streamlit/app/src/util/ScreenCastRecorder", () => ({
  default: {
    isSupportedBrowser: vi.fn(() => true),
  },
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
  settingsCallback: vi.fn(),
  menuItems: {},
  developmentMode: true,
  metricsMgr: new MetricsManager(mockSessionInfo()),
  toolbarMode: Config.ToolbarMode.AUTO,
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
    const menuItems = screen.getAllByRole("menuitem")

    expect(menuItems[0]).toHaveFocus()

    await user.keyboard("{ArrowDown}")
    expect(menuItems[1]).toHaveFocus()

    await user.keyboard("{ArrowUp}")
    expect(menuItems[0]).toHaveFocus()
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

  it("skips disabled items when moving focus", async () => {
    const props = getProps({
      isServerConnected: false,
      developmentMode: true,
    })
    render(<MainMenu {...props} />)
    await openMenu()

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const settingsItem = screen.getByTestId("stMainMenuItem-Settings")
    const printItem = screen.getByTestId("stMainMenuItem-Print")

    expect(settingsItem).toHaveFocus()

    await user.keyboard("{ArrowDown}")
    expect(printItem).toHaveFocus()
  })

  it("focuses first enabled item when leading items are disabled", async () => {
    const props = getProps({
      isServerConnected: false,
      developmentMode: true,
    })
    render(<MainMenu {...props} />)
    await openMenu()

    // Rerun and Clear cache are disabled when disconnected.
    // First focusable item should be Settings.
    const settingsItem = screen.getByTestId("stMainMenuItem-Settings")
    expect(settingsItem).toHaveFocus()
  })

  it("skips multiple consecutive disabled items when navigating", async () => {
    // Both Rerun and Clear cache are disabled when disconnected
    const props = getProps({
      isServerConnected: false,
      developmentMode: true,
    })
    render(<MainMenu {...props} />)
    await openMenu()

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const settingsItem = screen.getByTestId("stMainMenuItem-Settings")
    const printItem = screen.getByTestId("stMainMenuItem-Print")

    // Focus starts on Settings (first enabled item)
    expect(settingsItem).toHaveFocus()

    // ArrowDown should skip disabled Clear cache and land on Print
    await user.keyboard("{ArrowDown}")
    expect(printItem).toHaveFocus()

    // ArrowUp should skip disabled Clear cache and land back on Settings
    await user.keyboard("{ArrowUp}")
    expect(settingsItem).toHaveFocus()
  })

  it("activates a focused menu item with Enter", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)
    await openMenu()

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    // Navigate to Settings (second item)
    await user.keyboard("{ArrowDown}")
    const settingsItem = screen.getByTestId("stMainMenuItem-Settings")
    expect(settingsItem).toHaveFocus()

    // Press Enter to activate
    await user.keyboard("{Enter}")
    expect(props.settingsCallback).toHaveBeenCalled()
  })

  it("activates a focused menu item with Space", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)
    await openMenu()

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    // Navigate to Settings (second item)
    await user.keyboard("{ArrowDown}")
    const settingsItem = screen.getByTestId("stMainMenuItem-Settings")
    expect(settingsItem).toHaveFocus()

    // Press Space to activate
    await user.keyboard(" ")
    expect(props.settingsCallback).toHaveBeenCalled()
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

  it("closes the menu when Tab is pressed inside menu content", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)
    await openMenu()

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    await user.keyboard("{Tab}")
    act(() => {
      vi.runAllTimers()
    })

    expect(screen.queryByTestId("stMainMenuPopover")).not.toBeInTheDocument()
  })

  it("closes the menu when Shift+Tab is pressed inside menu content", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)
    await openMenu()

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    await user.keyboard("{Shift>}{Tab}{/Shift}")
    act(() => {
      vi.runAllTimers()
    })

    expect(screen.queryByTestId("stMainMenuPopover")).not.toBeInTheDocument()
  })

  it("returns focus to menu button after popover closes", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)

    await openMenu()

    // Click a menu item to close the popover (triggers onClose → handlePopoverClose)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByTestId("stMainMenuItem-Settings"))

    // Flush BaseWeb's animateOut cycle (20ms + 0ms animateOutComplete),
    // then our 30ms focus-return timer, within separate act() calls so
    // React can commit state between timer phases.
    act(() => {
      vi.advanceTimersByTime(25)
    })
    act(() => {
      vi.advanceTimersByTime(25)
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

    // Navigate down - tabindex should follow focus
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.keyboard("{ArrowDown}")

    expect(menuItems[0]).toHaveAttribute("tabindex", "-1")
    expect(menuItems[1]).toHaveAttribute("tabindex", "0")
  })

  it("renders menu container with role='menu' and aria-label", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)
    await openMenu()

    const menuContainer = screen.getByTestId("stMainMenuList")
    expect(menuContainer).toHaveAttribute("role", "menu")
    expect(menuContainer).toHaveAttribute("aria-label", "Main menu")
  })

  it("renders menu items with role='menuitem'", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)
    await openMenu()

    const menuItems = screen.getAllByRole("menuitem")
    expect(menuItems.length).toBeGreaterThan(0)
    menuItems.forEach(item => {
      expect(item).toHaveAttribute("role", "menuitem")
    })
  })

  it("renders disabled items with aria-disabled", async () => {
    const props = getProps({
      isServerConnected: false,
      developmentMode: true,
    })
    render(<MainMenu {...props} />)
    await openMenu()

    const rerunItem = screen.getByTestId("stMainMenuItem-Rerun")
    const clearCacheItem = screen.getByTestId("stMainMenuItem-Clearcache")
    const settingsItem = screen.getByTestId("stMainMenuItem-Settings")

    expect(rerunItem).toHaveAttribute("aria-disabled", "true")
    expect(clearCacheItem).toHaveAttribute("aria-disabled", "true")
    // Settings is not disabled and should not have aria-disabled=true
    expect(settingsItem).not.toHaveAttribute("aria-disabled", "true")
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
    await user.click(screen.getByTestId("stMainMenuItem-Settings"))

    // Flush BaseWeb's animateOut and our focus-return timer
    act(() => {
      vi.advanceTimersByTime(25)
    })
    act(() => {
      vi.advanceTimersByTime(25)
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

    expect(screen.getByTestId("stMainMenuItem-Rerun")).toBeVisible()
    expect(screen.getByTestId("stMainMenuItem-Settings")).toBeVisible()
    expect(screen.getByTestId("stMainMenuItem-Clearcache")).toBeVisible()
    expect(screen.getByTestId("stMainMenuItem-Print")).toBeVisible()
    expect(screen.getByTestId("stMainMenuItem-Viewappsource")).toBeVisible()
    expect(screen.getByTestId("stMainMenuItem-Reportbugwithapp")).toBeVisible()
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
      screen.queryByTestId("stMainMenuItem-Gethelp")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId("stMainMenuItem-Reportabug")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId("stMainMenuItem-About")
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
      screen.queryByTestId("stMainMenuItem-Reportabug")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId("stMainMenuItem-About")
    ).not.toBeInTheDocument()
    expect(screen.getByTestId("stMainMenuItem-Gethelp")).toBeVisible()
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

    expect(screen.getByTestId("stMainMenuItem-Reportabug")).toBeVisible()
    expect(
      screen.queryByTestId("stMainMenuItem-About")
    ).not.toBeInTheDocument()
  })

  it("should render Get help when URL provided", async () => {
    const menuItems = {
      getHelpUrl: "https://example.com/help",
    }
    const props = getProps({ menuItems })
    render(<MainMenu {...props} />)
    await openMenu()

    expect(screen.getByTestId("stMainMenuItem-Gethelp")).toBeVisible()
  })

  it("should render About when markdown provided", async () => {
    const menuItems = {
      aboutSectionMd: "# About\n\nThis is my app.",
    }
    const props = getProps({ menuItems })
    render(<MainMenu {...props} />)
    await openMenu()

    expect(screen.getByTestId("stMainMenuItem-About")).toBeVisible()
  })

  it("should call aboutCallback when About is clicked", async () => {
    const menuItems = {
      aboutSectionMd: "# About\n\nThis is my app.",
    }
    const props = getProps({ menuItems })
    render(<MainMenu {...props} />)
    await openMenu()

    screen.getByTestId("stMainMenuItem-About").click()

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

    screen.getByTestId("stMainMenuItem-Gethelp").click()

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

    screen.getByTestId("stMainMenuItem-Reportabug").click()

    expect(windowOpenSpy).toHaveBeenCalledWith(
      "https://example.com/bug",
      "_blank"
    )
    windowOpenSpy.mockRestore()
  })

  it("should not render Clear cache when developmentMode is false", async () => {
    const props = getProps({ developmentMode: false })
    render(<MainMenu {...props} />)
    await openMenu()

    expect(
      screen.queryByTestId("stMainMenuItem-Clearcache")
    ).not.toBeInTheDocument()
    expect(screen.getByTestId("stMainMenuItem-Rerun")).toBeVisible()
    expect(screen.getByTestId("stMainMenuItem-Settings")).toBeVisible()
    expect(screen.getByTestId("stMainMenuItem-Print")).toBeVisible()
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

    const rerunButton = screen.getByTestId("stMainMenuItem-Rerun")
    const clearCacheButton = screen.getByTestId("stMainMenuItem-Clearcache")

    expect(rerunButton).toBeDisabled()
    expect(clearCacheButton).toBeDisabled()
  })

  it("should call callbacks when menu items are clicked", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)
    await openMenu()

    screen.getByTestId("stMainMenuItem-Settings").click()

    expect(props.settingsCallback).toHaveBeenCalled()
  })

  it("should display keyboard shortcuts for Rerun and Clear cache", async () => {
    const props = getProps({ developmentMode: true })
    render(<MainMenu {...props} />)
    await openMenu()

    // Check that shortcuts are rendered
    const rerunItem = screen.getByTestId("stMainMenuItem-Rerun")
    const clearCacheItem = screen.getByTestId("stMainMenuItem-Clearcache")

    expect(rerunItem).toHaveTextContent("R")
    expect(clearCacheItem).toHaveTextContent("C")
  })

  it("should render menu items in correct order", async () => {
    const props = getProps({ developmentMode: true })
    const view = render(<MainMenu {...props} />)
    await openMenu()

    const labels = getMenuLabels(view)
    expect(labels).toEqual([
      "Rerun",
      "Settings",
      "Clear cache",
      "Print",
      "Record screen",
    ])
  })

  it("should render About last when all configurable items are present", async () => {
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
    // Verify About is always the last item
    expect(labels[labels.length - 1]).toBe("About")
    // Verify other configurable items come before About
    const aboutIndex = labels.indexOf("About")
    const reportIndex = labels.indexOf("Report a bug")
    const getHelpIndex = labels.indexOf("Get help")
    expect(reportIndex).toBeLessThan(aboutIndex)
    expect(getHelpIndex).toBeLessThan(aboutIndex)
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

    screen.getByTestId("stMainMenuItem-Settings").click()

    expect(enqueueSpy).toHaveBeenCalledWith("menuClick", { label: "Settings" })
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
      screen.queryByTestId("stMainMenuItem-About")
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

  it("should show 'Cancel recording' when screenCastState is COUNTDOWN", async () => {
    const props = getProps({ screenCastState: "COUNTDOWN" })
    const view = render(<MainMenu {...props} />)
    await openMenu()

    const labels = getMenuLabels(view)
    expect(labels).toContain("Cancel recording")
    expect(labels).not.toContain("Record screen")
  })

  it("should show 'Stop recording' when screenCastState is RECORDING", async () => {
    const props = getProps({ screenCastState: "RECORDING" })
    const view = render(<MainMenu {...props} />)
    await openMenu()

    const labels = getMenuLabels(view)
    expect(labels).toContain("Stop recording")
    expect(labels).not.toContain("Record screen")
  })

  it("should style recording menu item with recording state", async () => {
    const props = getProps({ screenCastState: "RECORDING" })
    render(<MainMenu {...props} />)
    await openMenu()

    // The menu item should exist with the recording label
    const recordingItem = screen.getByTestId("stMainMenuItem-Stoprecording")
    expect(recordingItem).toBeVisible()
  })

  it("should not call callback when clicking disabled item", async () => {
    const props = getProps({ isServerConnected: false })
    render(<MainMenu {...props} />)
    await openMenu()

    // Click disabled Rerun button
    screen.getByTestId("stMainMenuItem-Rerun").click()

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
})
