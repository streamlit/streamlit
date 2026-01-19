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

import { MetricsManager } from "@streamlit/app/src/MetricsManager"
import { IMenuItem, mockSessionInfo, SessionInfo } from "@streamlit/lib"
import { render } from "@streamlit/lib/testing"
import { Config } from "@streamlit/protobuf"

import MainMenu, { Props } from "./MainMenu"
import { getMenuStructure, openMenu } from "./mainMenuTestHelpers"

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
  menuItems: {},
  developmentMode: true,
  metricsMgr: new MetricsManager(mockSessionInfo()),
  toolbarMode: Config.ToolbarMode.AUTO,
  runOnSave: false,
  onRunOnSaveChange: vi.fn(),
  allowRunOnSave: true,
  sessionInfo: mockSessionInfo(),
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
      {
        type: "separator",
      },
      {
        type: "text",
        label: "View app source",
        key: "source",
      },
      {
        type: "text",
        label: "Report bug with app",
        key: "support",
      },
      {
        type: "separator",
      },
    ]
    const props = getProps({
      hostMenuItems: items,
    })
    render(<MainMenu {...props} />)
    await openMenu(screen)

    expect(screen.getByTestId("stMainMenuItem-Rerun")).toBeVisible()
    expect(screen.getByTestId("stMainMenuAutoRerun")).toBeVisible()
    expect(screen.getByTestId("stMainMenuItem-Clearcache")).toBeVisible()
    expect(screen.getByTestId("stMainMenuItem-Print")).toBeVisible()
    expect(screen.getByTestId("stMainMenuItem-Viewappsource")).toBeVisible()
    expect(screen.getByTestId("stMainMenuItem-Reportbugwithapp")).toBeVisible()
  })

  it("should render core set of menu elements in developer mode", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)
    await openMenu(screen)

    expect(screen.getByTestId("stMainMenuItem-Rerun")).toBeVisible()
    expect(screen.getByTestId("stMainMenuAutoRerun")).toBeVisible()
    expect(screen.getByTestId("stMainMenuItem-Clearcache")).toBeVisible()
    expect(screen.getByTestId("stMainMenuItem-Print")).toBeVisible()
    expect(screen.getByTestId("stMainMenuVersion")).toBeVisible()
  })

  it("should not render configurable elements when hidden", async () => {
    const menuItems = {
      hideGetHelp: true,
      hideReportABug: true,
      aboutSectionMd: "",
    }
    const props = getProps({ menuItems })
    render(<MainMenu {...props} />)
    await openMenu(screen)

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
    await openMenu(screen)

    expect(
      screen.queryByTestId("stMainMenuItem-Reportabug")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId("stMainMenuItem-About")
    ).not.toBeInTheDocument()
  })

  it("should render report a bug when URL is provided", async () => {
    const menuItems = {
      reportABugUrl: "testing",
      hideGetHelp: false,
      hideReportABug: false,
      aboutSectionMd: "",
    }
    const props = getProps({ menuItems })
    render(<MainMenu {...props} />)
    await openMenu(screen)

    expect(screen.getByTestId("stMainMenuItem-Reportabug")).toBeVisible()
    expect(
      screen.queryByTestId("stMainMenuItem-About")
    ).not.toBeInTheDocument()
  })

  it("should not render Clear cache when developmentMode is false", async () => {
    const props = getProps({ developmentMode: false })
    render(<MainMenu {...props} />)
    await openMenu(screen)

    expect(screen.getByTestId("stMainMenuItem-Rerun")).toBeVisible()
    expect(screen.getByTestId("stMainMenuItem-Print")).toBeVisible()
    expect(
      screen.queryByTestId("stMainMenuItem-Clearcache")
    ).not.toBeInTheDocument()
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
    await openMenu(screen)

    const menuStructure = getMenuStructure(view)
    const flatMenuItems = menuStructure.flat()
    expect(flatMenuItems).toContainEqual({
      type: "option",
      label: "Host menu item",
    })
  })

  it("should hide main menu when toolbarMode is Minimal and no host items", () => {
    const props = getProps({
      developmentMode: false,
      toolbarMode: Config.ToolbarMode.MINIMAL,
      hostMenuItems: [],
    })

    render(<MainMenu {...props} />)

    expect(screen.queryByTestId("stMainMenuButton")).toBeNull()
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
    await openMenu(screen)

    const menuStructure = getMenuStructure(view)
    expect(menuStructure).toEqual([
      [{ type: "option", label: "View all apps" }],
    ])
  })

  it.each([
    [
      ["getHelpUrl", "reportABugUrl", "aboutSectionMd"],
      [
        {
          label: "Report a bug",
          type: "option",
        },
        {
          label: "Get help",
          type: "option",
        },
        {
          label: "About",
          type: "option",
        },
      ],
    ],
    [
      ["getHelpUrl"],
      [
        {
          label: "Get help",
          type: "option",
        },
      ],
    ],
    [
      ["reportABugUrl"],
      [
        {
          label: "Report a bug",
          type: "option",
        },
      ],
    ],
    [
      ["aboutSectionMd"],
      [
        {
          label: "About",
          type: "option",
        },
      ],
    ],
  ])(
    "should render custom items in minimal mode[%s]",
    async (menuItems, expectedMenuItems) => {
      const allMenuItems = {
        getHelpUrl: "https://www.extremelycoolapp.com/help",
        reportABugUrl: "https://www.extremelycoolapp.com/bug",
        aboutSectionMd: "# This is a header. This is an *extremely* cool app!",
      }
      const props = getProps({
        developmentMode: false,
        toolbarMode: Config.ToolbarMode.MINIMAL,
        menuItems: Object.fromEntries(
          Object.entries(allMenuItems).filter(d => menuItems.includes(d[0]))
        ),
      })

      const view = render(<MainMenu {...props} />)
      await openMenu(screen)

      const menuStructure = getMenuStructure(view)
      expect(menuStructure).toEqual([expectedMenuItems])
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
    await openMenu(screen)

    const menuStructure = getMenuStructure(view)
    expect(menuStructure).toEqual([
      [
        {
          label: "Report a bug",
          type: "option",
        },
        {
          label: "Get help",
          type: "option",
        },
        {
          label: "View all apps",
          type: "option",
        },
        {
          label: "About",
          type: "option",
        },
      ],
    ])
  })

  it("should show Auto rerun toggle when allowed", async () => {
    const props = getProps({ runOnSave: false })
    render(<MainMenu {...props} />)
    await openMenu(screen)

    const autoRerunToggle = screen.getByLabelText("Auto rerun")
    expect(autoRerunToggle).toBeVisible()
  })

  it("should not show Auto rerun toggle when not allowed", async () => {
    const props = getProps({ allowRunOnSave: false })
    render(<MainMenu {...props} />)
    await openMenu(screen)

    expect(screen.queryByLabelText("Auto rerun")).not.toBeInTheDocument()
  })

  it("should disable Auto rerun toggle when disconnected", async () => {
    const props = getProps({
      isServerConnected: false,
    })
    render(<MainMenu {...props} />)
    await openMenu(screen)

    const autoRerunToggle = screen.getByLabelText("Auto rerun")
    expect(autoRerunToggle).toBeDisabled()
  })

  it("should disable rerun when disconnected", async () => {
    const props = getProps({
      isServerConnected: false,
    })
    render(<MainMenu {...props} />)
    await openMenu(screen)

    expect(screen.getByTestId("stMainMenuItem-Rerun")).toBeDisabled()
  })

  it("should call onRunOnSaveChange when Auto rerun is toggled", async () => {
    const onRunOnSaveChange = vi.fn()
    const props = getProps({ runOnSave: false, onRunOnSaveChange })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<MainMenu {...props} />)
    await openMenu(screen)

    await user.click(screen.getByLabelText("Auto rerun"))

    expect(onRunOnSaveChange).toHaveBeenCalledWith(true)
  })

  it("should display version footer", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)
    await openMenu(screen)

    const versionFooter = screen.getByTestId("stMainMenuVersion")
    expect(versionFooter).toBeVisible()
    expect(versionFooter.textContent).toContain("Made with Streamlit v")
  })

  it("should hide version footer when session info is not set", async () => {
    const sessionInfo = new SessionInfo()
    const props = getProps({ sessionInfo })
    render(<MainMenu {...props} />)
    await openMenu(screen)

    expect(screen.queryByTestId("stMainMenuVersion")).not.toBeInTheDocument()
  })
})
