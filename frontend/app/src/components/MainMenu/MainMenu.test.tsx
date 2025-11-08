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

import { screen, within } from "@testing-library/react"

import { MetricsManager } from "@streamlit/app/src/MetricsManager"
import { IMenuItem, mockSessionInfo, render } from "@streamlit/lib"
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

  it("should render host menu items", () => {
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
    openMenu(screen)

    const menuOptions = screen.getAllByRole("option")

    const expectedLabels = [
      "Rerun",
      "Settings",
      "Print",
      "View app source",
      "Report bug with app",
      "Developer options",
      "Clear cache",
    ]

    expectedLabels.forEach((label, index) => {
      expect(menuOptions[index]).toHaveTextContent(label)
    })
  })

  it("should render core set of menu elements", () => {
    const props = getProps()
    render(<MainMenu {...props} />)
    openMenu(screen)

    const menuOptions = screen.getAllByRole("option")

    const expectedLabels = [
      "Rerun",
      "Settings",
      "Print",
      "Developer options",
      "Clear cache",
    ]

    expectedLabels.forEach((label, index) => {
      expect(menuOptions[index]).toHaveTextContent(label)
    })
  })

  it("should not render set of configurable elements", () => {
    const menuItems = {
      hideGetHelp: true,
      hideReportABug: true,
      aboutSectionMd: "",
    }
    const props = getProps({ menuItems })
    render(<MainMenu {...props} />)
    openMenu(screen)

    // first SubMenu (menu items, not dev menu items)
    const coreMenu = screen.getAllByTestId("stMainMenuList")[0]

    const coreMenuOptions = within(coreMenu).getAllByRole("option")
    expect(coreMenuOptions).toHaveLength(3)

    const expectedLabels = ["Rerun", "Settings", "Print"]
    coreMenuOptions.forEach((option, index) => {
      expect(option).toHaveTextContent(expectedLabels[index])
    })
  })

  it("should not render report a bug in core menu", () => {
    const menuItems = {
      getHelpUrl: "testing",
      hideGetHelp: false,
      hideReportABug: true,
      aboutSectionMd: "",
    }
    const props = getProps({ menuItems })
    render(<MainMenu {...props} />)
    openMenu(screen)

    expect(screen.queryByRole("option", { name: "Report a bug" })).toBeNull()
    expect(screen.queryByRole("option", { name: "About" })).toBeNull()
  })

  it("should render report a bug in core menu", () => {
    const menuItems = {
      reportABugUrl: "testing",
      hideGetHelp: false,
      hideReportABug: false,
      aboutSectionMd: "",
    }
    const props = getProps({ menuItems })
    render(<MainMenu {...props} />)
    openMenu(screen)

    const reportOption = screen.getByRole("option", {
      name: "Report a bug",
    })
    expect(reportOption).toBeDefined()
    expect(screen.queryByRole("option", { name: "About" })).toBeNull()
  })

  it("should not render dev menu when developmentMode is false", () => {
    const props = getProps({ developmentMode: false })
    render(<MainMenu {...props} />)
    openMenu(screen)

    const subMenus = screen.getAllByTestId("stMainMenuList")
    // Make sure there is only one SubMenu (no dev menu)
    expect(subMenus).toHaveLength(1)

    const coreMenuOptions = within(subMenus[0]).getAllByRole("option")
    expect(coreMenuOptions).toHaveLength(3)

    const expectedLabels = ["Rerun", "Settings", "Print"]
    coreMenuOptions.forEach((option, index) => {
      expect(option).toHaveTextContent(expectedLabels[index])
    })
  })

  it.each([
    [Config.ToolbarMode.AUTO],
    [Config.ToolbarMode.DEVELOPER],
    [Config.ToolbarMode.VIEWER],
    [Config.ToolbarMode.MINIMAL],
  ])("should render host menu items if available[%s]", toolbarMode => {
    const props = getProps({
      toolbarMode,
      hostMenuItems: [
        { label: "Host menu item", key: "host-item", type: "text" },
      ],
    })
    const view = render(<MainMenu {...props} />)
    openMenu(screen)

    const menuStructure = getMenuStructure(view)
    expect(menuStructure[0]).toContainEqual({
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

    expect(screen.queryByRole("button")).toBeNull()
  })

  it("should skip divider from host menu items if it is at the beginning and end", () => {
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
    openMenu(screen)

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
          type: "separator",
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
    (menuItems, expectedMenuItems) => {
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
      openMenu(screen)

      const menuStructure = getMenuStructure(view)
      expect(menuStructure).toEqual([expectedMenuItems])
    }
  )

  it("should render host menu items and custom items in minimal mode", () => {
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
    openMenu(screen)

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
          type: "separator",
        },
        {
          label: "View all apps",
          type: "option",
        },
        {
          type: "separator",
        },
        {
          label: "About",
          type: "option",
        },
      ],
    ])
  })
})
