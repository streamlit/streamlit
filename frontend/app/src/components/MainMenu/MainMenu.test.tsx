/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
import "@testing-library/jest-dom"
import {
  screen,
  within,
  waitFor,
  fireEvent,
  RenderResult,
  Screen,
} from "@testing-library/react"
import { render, IMenuItem, mockSessionInfo, Config } from "@streamlit/lib"

import { SegmentMetricsManager } from "@streamlit/app/src/SegmentMetricsManager"

import MainMenu, { Props } from "./MainMenu"

const getProps = (extend?: Partial<Props>): Props => ({
  aboutCallback: jest.fn(),
  printCallback: jest.fn(),
  clearCacheCallback: jest.fn(),
  isServerConnected: true,
  quickRerunCallback: jest.fn(),
  hostMenuItems: [],
  screencastCallback: jest.fn(),
  screenCastState: "",
  sendMessageToHost: jest.fn(),
  settingsCallback: jest.fn(),
  menuItems: {},
  developmentMode: true,
  metricsMgr: new SegmentMetricsManager(mockSessionInfo()),
  toolbarMode: Config.ToolbarMode.AUTO,
  ...extend,
})

async function openMenu(screen: Screen): Promise<void> {
  fireEvent.click(screen.getByRole("button"))
  // Each SubMenu is a listbox, so need to use findAllByRole (findByRole throws error if multiple matches)
  const menu = await screen.findAllByRole("listbox")
  expect(menu).toBeDefined()
}

function getMenuStructure(
  renderResult: RenderResult
): ({ type: "separator" } | { type: "option"; label: string })[][] {
  return Array.from(
    renderResult.baseElement.querySelectorAll('[role="listbox"]')
  ).map(listBoxElement => {
    return Array.from(
      listBoxElement.querySelectorAll(
        '[role=option] span:first-of-type, [data-testid="main-menu-divider"]'
      )
    ).map(d =>
      d.getAttribute("data-testid") == "main-menu-divider"
        ? { type: "separator" }
        : { type: "option", label: d.textContent as string }
    )
  })
}

describe("MainMenu", () => {
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

    const menuOptions = await screen.findAllByRole("option")

    const expectedLabels = [
      "Rerun",
      "Settings",
      "Print",
      "Record a screencast",
      "View app source",
      "Report bug with app",
      "About",
      "Developer options",
      "Clear cache",
    ]

    expectedLabels.forEach((label, index) => {
      expect(menuOptions[index]).toHaveTextContent(label)
    })
  })

  it("should render core set of menu elements", async () => {
    const props = getProps()
    render(<MainMenu {...props} />)
    await openMenu(screen)

    const menuOptions = await screen.findAllByRole("option")

    const expectedLabels = [
      "Rerun",
      "Settings",
      "Print",
      "Record a screencast",
      "About",
      "Developer options",
      "Clear cache",
    ]

    expectedLabels.forEach((label, index) => {
      expect(menuOptions[index]).toHaveTextContent(label)
    })
  })

  it("should not render set of configurable elements", async () => {
    const menuItems = {
      hideGetHelp: true,
      hideReportABug: true,
      aboutSectionMd: "",
    }
    const props = getProps({ menuItems })
    render(<MainMenu {...props} />)
    await openMenu(screen)

    // first SubMenu (menu items, not dev menu items)
    const coreMenu = screen.getAllByTestId("main-menu-list")[0]

    const coreMenuOptions = within(coreMenu).getAllByRole("option")
    expect(coreMenuOptions).toHaveLength(5)

    const expectedLabels = [
      "Rerun",
      "Settings",
      "Print",
      "Record a screencast",
      "About",
    ]
    coreMenuOptions.forEach((option, index) => {
      expect(option).toHaveTextContent(expectedLabels[index])
    })
  })

  it("should not render report a bug in core menu", async () => {
    const menuItems = {
      getHelpUrl: "testing",
      hideGetHelp: false,
      hideReportABug: true,
      aboutSectionMd: "",
    }
    const props = getProps({ menuItems })
    render(<MainMenu {...props} />)
    await openMenu(screen)

    await waitFor(() =>
      expect(screen.queryByRole("option", { name: "Report a bug" })).toBeNull()
    )
  })

  it("should render report a bug in core menu", async () => {
    const menuItems = {
      reportABugUrl: "testing",
      hideGetHelp: false,
      hideReportABug: false,
      aboutSectionMd: "",
    }
    const props = getProps({ menuItems })
    render(<MainMenu {...props} />)
    await openMenu(screen)

    const reportOption = await screen.findByRole("option", {
      name: "Report a bug",
    })
    expect(reportOption).toBeDefined()
  })

  it("should not render dev menu when developmentMode is false", async () => {
    const props = getProps({ developmentMode: false })
    render(<MainMenu {...props} />)
    await openMenu(screen)

    const subMenus = screen.getAllByTestId("main-menu-list")
    // Make sure there is only one SubMenu (no dev menu)
    expect(subMenus).toHaveLength(1)

    const coreMenuOptions = within(subMenus[0]).getAllByRole("option")
    expect(coreMenuOptions).toHaveLength(5)

    const expectedLabels = [
      "Rerun",
      "Settings",
      "Print",
      "Record a screencast",
      "About",
    ]
    coreMenuOptions.forEach((option, index) => {
      expect(option).toHaveTextContent(expectedLabels[index])
    })
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
    expect(menuStructure[0]).toContainEqual({
      type: "option",
      label: "Host menu item",
    })
  })

  it("should hide main menu when toolbarMode is Minimal and no host items", async () => {
    const props = getProps({
      developmentMode: false,
      toolbarMode: Config.ToolbarMode.MINIMAL,
      hostMenuItems: [],
    })

    render(<MainMenu {...props} />)

    expect(screen.queryByRole("button")).toBeNull()
  })

  it("should skip divider from host menu items if it is at the beginning and end", async () => {
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
