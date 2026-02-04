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

import { MetricsManager } from "@streamlit/app/src/MetricsManager"
import { IMenuItem, mockSessionInfo } from "@streamlit/lib"
import { render } from "@streamlit/lib/testing"
import { Config } from "@streamlit/protobuf"

import MainMenu, { Props } from "./MainMenu"
import { getMenuLabels, openMenu } from "./mainMenuTestHelpers"

const getProps = (extend?: Partial<Props>): Props => ({
  aboutCallback: vi.fn(),
  printCallback: vi.fn(),
  clearCacheCallback: vi.fn(),
  isServerConnected: true,
  quickRerunCallback: vi.fn(),
  hostMenuItems: [],
  screencastCallback: vi.fn(),
  screenCastState: "",
  sendMessageToHost: vi.fn(),
  settingsCallback: vi.fn(),
  menuItems: {},
  developmentMode: true,
  metricsMgr: new MetricsManager(mockSessionInfo()),
  toolbarMode: Config.ToolbarMode.AUTO,
  ...extend,
})

describe("MainMenu", () => {
  beforeEach(() => {
    // BaseWeb uses timers under the hood. We simplify by using fake timers.
    vi.useFakeTimers()
  })

  it("renders without crashing", () => {
    const props = getProps()
    render(<MainMenu {...props} />)

    expect(screen.getByTestId("stMainMenu")).toBeInTheDocument()
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
    expect(labels).toEqual(["Rerun", "Settings", "Clear cache", "Print"])
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
})
