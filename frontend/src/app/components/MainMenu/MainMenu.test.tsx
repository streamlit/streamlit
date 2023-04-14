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

import { mount, render } from "src/lib/test_util"
import { IMenuItem } from "src/lib/hocs/withHostCommunication/types"

import { Config, GitInfo, IGitInfo } from "src/autogen/proto"
import { IDeployErrorDialog } from "src/app/components/StreamlitDialog/DeployErrorDialogs/types"
import {
  DetachedHead,
  ModuleIsNotAdded,
  NoRepositoryDetected,
} from "src/app/components/StreamlitDialog/DeployErrorDialogs"

import MainMenu, { Props } from "./MainMenu"
import { waitFor } from "@testing-library/dom"
import { fireEvent, RenderResult } from "@testing-library/react"
import { MockMetricsManager } from "src/lib/mocks/mocks"

const { GitStates } = GitInfo

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
  isDeployErrorModalOpen: false,
  showDeployError: jest.fn(),
  loadGitInfo: jest.fn(),
  closeDialog: jest.fn(),
  canDeploy: true,
  menuItems: {},
  developmentMode: true,
  gitInfo: null,
  metricsMgr: new MockMetricsManager(),
  toolbarMode: Config.ToolbarMode.AUTO,
  ...extend,
})

async function openMenu(wrapper: RenderResult): Promise<void> {
  fireEvent.click(wrapper.getByRole("button"))
  await waitFor(() => expect(wrapper.findByRole("listbox")).toBeDefined())
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
    const wrapper = mount(<MainMenu {...props} />)

    expect(wrapper).toBeDefined()
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
    const wrapper = render(<MainMenu {...props} />)
    await openMenu(wrapper)

    await waitFor(() =>
      expect(
        wrapper
          .getAllByRole("option")
          .map(item => item.querySelector("span:first-of-type")?.textContent)
      ).toEqual([
        "Rerun",
        "Settings",
        "Print",
        "Record a screencast",
        "View app source",
        "Report bug with app",
        "About",
        "Developer options",
        "Clear cache",
      ])
    )
  })

  it("should render core set of menu elements", async () => {
    const props = getProps()
    const wrapper = render(<MainMenu {...props} />)
    await openMenu(wrapper)

    await waitFor(() =>
      expect(
        wrapper
          .getAllByRole("option")
          .map(item => item.querySelector("span:first-of-type")?.textContent)
      ).toEqual([
        "Rerun",
        "Settings",
        "Print",
        "Record a screencast",
        "About",
        "Developer options",
        "Clear cache",
        "Deploy this app",
      ])
    )
  })

  it("should render deploy app menu item", async () => {
    const props = getProps({ gitInfo: {} })
    const wrapper = render(<MainMenu {...props} />)
    await openMenu(wrapper)

    await waitFor(() =>
      expect(
        wrapper.getByRole("option", { name: "Deploy this app" })
      ).toBeDefined()
    )
  })

  describe("Onclick deploy button", () => {
    function testDeployErrorModal(
      gitInfo: Partial<IGitInfo>,
      dialogComponent: (module: string) => IDeployErrorDialog
    ): void {
      const props = getProps({
        gitInfo,
      })
      const wrapper = mount(<MainMenu {...props} />)
      const popoverContent = wrapper.find("StatefulPopover").prop("content")

      // @ts-expect-error
      const menuWrapper = mount(popoverContent(() => {}))
      const items: any = menuWrapper.find("StatefulMenu").at(1).prop("items")

      const deployOption = items.find(
        // @ts-expect-error
        ({ label }) => label === "Deploy this app"
      )

      deployOption.onClick()

      // @ts-expect-error
      const dialog = dialogComponent(props.gitInfo.module)
      // @ts-expect-error
      expect(props.showDeployError.mock.calls[0][0]).toStrictEqual(
        dialog.title
      )
      // @ts-expect-error
      expect(props.showDeployError.mock.calls[0][1]).toStrictEqual(dialog.body)
    }

    it("should display the correct modal if there is no repo or remote", () => {
      testDeployErrorModal(
        {
          state: GitStates.DEFAULT,
        },
        NoRepositoryDetected
      )
    })

    it("should display the correct modal if there is an empty repo", () => {
      testDeployErrorModal(
        {
          repository: "",
          branch: "",
          module: "",
          state: GitStates.DEFAULT,
        },
        NoRepositoryDetected
      )
    })

    it("should display the correct modal if the repo is detached", () => {
      testDeployErrorModal(
        {
          repository: "repo",
          branch: "branch",
          module: "module",
          state: GitStates.HEAD_DETACHED,
        },
        DetachedHead
      )
    })

    it("should display the correct modal if the script is not added to the repo", () => {
      testDeployErrorModal(
        {
          repository: "repo",
          branch: "branch",
          module: "module.py",
          state: GitStates.DEFAULT,
          untrackedFiles: ["module.py"],
        },
        ModuleIsNotAdded
      )
    })
  })

  it("should not render set of configurable elements", () => {
    const menuItems = {
      hideGetHelp: true,
      hideReportABug: true,
      aboutSectionMd: "",
    }
    const props = getProps({ menuItems })
    const wrapper = mount(<MainMenu {...props} />)
    const popoverContent = wrapper.find("StatefulPopover").prop("content")
    // @ts-expect-error
    const menuWrapper = mount(popoverContent(() => {}))

    // @ts-expect-error
    const menuLabels = menuWrapper
      .find("MenuStatefulContainer")
      .at(0)
      .prop("items")
      // @ts-expect-error
      .map(item => item.label)
    expect(menuLabels).toEqual([
      "Rerun",
      "Settings",
      "Print",
      "Record a screencast",
      "About",
    ])
  })

  it("should not render report a bug in core menu", async () => {
    const menuItems = {
      getHelpUrl: "testing",
      hideGetHelp: false,
      hideReportABug: true,
      aboutSectionMd: "",
    }
    const props = getProps({ menuItems })
    const wrapper = render(<MainMenu {...props} />)
    await openMenu(wrapper)

    await waitFor(() =>
      expect(
        wrapper.queryByRole("option", { name: "Report a bug" })
      ).toBeNull()
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
    const wrapper = render(<MainMenu {...props} />)
    await openMenu(wrapper)

    await waitFor(() =>
      expect(
        wrapper.getByRole("option", { name: "Report a bug" })
      ).toBeDefined()
    )
  })

  it("should not render dev menu when developmentMode is false", () => {
    const props = getProps({ developmentMode: false })
    const wrapper = mount(<MainMenu {...props} />)
    const popoverContent = wrapper.find("StatefulPopover").prop("content")
    // @ts-expect-error
    const menuWrapper = mount(popoverContent(() => {}))

    // @ts-expect-error
    const menuLabels = menuWrapper
      .find("MenuStatefulContainer")
      // make sure that we only have one menu otherwise prop will fail
      .prop("items")
      // @ts-expect-error
      .map(item => item.label)
    expect(menuLabels).toEqual([
      "Rerun",
      "Settings",
      "Print",
      "Record a screencast",
      "About",
    ])
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
    const wrapper = render(<MainMenu {...props} />)
    await openMenu(wrapper)

    const menuStructure = getMenuStructure(wrapper)
    expect(menuStructure[0]).toContainEqual({
      type: "option",
      label: "Host menu item",
    })
  })

  it("should hide hamburger when toolbarMode is Minimal and no host items", async () => {
    const props = getProps({
      developmentMode: false,
      toolbarMode: Config.ToolbarMode.MINIMAL,
      hostMenuItems: [],
    })

    const wrapper = render(<MainMenu {...props} />)

    expect(wrapper.queryByRole("button")).toBeNull()
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
    const wrapper = render(<MainMenu {...props} />)
    await openMenu(wrapper)

    const menuStructure = getMenuStructure(wrapper)
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

      const wrapper = render(<MainMenu {...props} />)
      await openMenu(wrapper)

      const menuStructure = getMenuStructure(wrapper)
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
    const wrapper = render(<MainMenu {...props} />)
    await openMenu(wrapper)

    const menuStructure = getMenuStructure(wrapper)
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
