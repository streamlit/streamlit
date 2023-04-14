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
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { mount, render } from "src/lib/test_util"
import { IMenuItem } from "src/hocs/withHostCommunication/types"

import { GitInfo, IGitInfo } from "src/autogen/proto"
import { IDeployErrorDialog } from "src/app/components/StreamlitDialog/DeployErrorDialogs/types"
import {
  DetachedHead,
  ModuleIsNotAdded,
  NoRepositoryDetected,
} from "src/app/components/StreamlitDialog/DeployErrorDialogs"

import MainMenu, { Props } from "./MainMenu"
import { waitFor } from "@testing-library/dom"
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
  hostIsOwner: false,
  gitInfo: null,
  metricsMgr: new MockMetricsManager(),
  ...extend,
})

describe("App", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = mount(<MainMenu {...props} />)

    expect(wrapper).toBeDefined()
  })

  it("should render host menu items", async () => {
    const user = userEvent.setup()
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
    await user.click(screen.getByRole("button"))

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
    const user = userEvent.setup()
    const props = getProps()
    const wrapper = render(<MainMenu {...props} />)
    await user.click(screen.getByRole("button"))

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
    const user = userEvent.setup()
    const props = getProps({ gitInfo: {} })
    const wrapper = render(<MainMenu {...props} />)
    await user.click(screen.getByRole("button"))

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
    const user = userEvent.setup()
    const menuItems = {
      getHelpUrl: "testing",
      hideGetHelp: false,
      hideReportABug: true,
      aboutSectionMd: "",
    }
    const props = getProps({ menuItems })
    const wrapper = render(<MainMenu {...props} />)
    await user.click(screen.getByRole("button"))

    await waitFor(() =>
      expect(
        wrapper.queryByRole("option", { name: "Report a bug" })
      ).toBeNull()
    )
  })

  it("should render report a bug in core menu", async () => {
    const user = userEvent.setup()
    const menuItems = {
      reportABugUrl: "testing",
      hideGetHelp: false,
      hideReportABug: false,
      aboutSectionMd: "",
    }
    const props = getProps({ menuItems })
    const wrapper = render(<MainMenu {...props} />)
    await user.click(screen.getByRole("button"))

    await waitFor(() =>
      expect(
        wrapper.getByRole("option", { name: "Report a bug" })
      ).toBeDefined()
    )
  })

  it("should not render dev menu when hostIsOwner is false and not on localhost", () => {
    // set isLocalhost to false by deleting window.location.
    // Source: https://www.benmvp.com/blog/mocking-window-location-methods-jest-jsdom/
    // @ts-expect-error
    delete window.location

    // @ts-expect-error
    window.location = {
      assign: jest.fn(),
    }
    const props = getProps()
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
})
