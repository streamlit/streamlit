/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react"

import { mount, shallow } from "src/lib/test_util"
import { IMenuItem } from "src/hocs/withS4ACommunication/types"

import { GitInfo, IGitInfo } from "src/autogen/proto"
import { IDeployErrorDialog } from "src/components/core/StreamlitDialog/DeployErrorDialogs/types"
import {
  DetachedHead,
  ModuleIsNotAdded,
  NoRepositoryDetected,
  RepoIsAhead,
  UncommittedChanges,
  UntrackedFiles,
} from "src/components/core/StreamlitDialog/DeployErrorDialogs"

import MainMenu, { Props } from "./MainMenu"

const { GitStates } = GitInfo

const getProps = (extend?: Partial<Props>): Props => ({
  aboutCallback: jest.fn(),
  clearCacheCallback: jest.fn(),
  isServerConnected: true,
  quickRerunCallback: jest.fn(),
  s4aMenuItems: [],
  screencastCallback: jest.fn(),
  screenCastState: "",
  sendS4AMessage: jest.fn(),
  settingsCallback: jest.fn(),
  shareCallback: jest.fn(),
  sharingEnabled: false,
  isDeployErrorModalOpen: false,
  showDeployError: jest.fn(),
  loadGitInfo: jest.fn(),
  closeDialog: jest.fn(),
  canDeploy: true,
  ...extend,
})

describe("App", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<MainMenu {...props} />)

    expect(wrapper).toMatchSnapshot()
  })

  it("should render s4a menu items", () => {
    const items: IMenuItem[] = [
      {
        type: "text",
        label: "Share this app",
        key: "share",
      },
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
      {
        type: "text",
        label: "About Streamlit for Teams",
        key: "about",
      },
    ]
    const props = getProps({
      s4aMenuItems: items,
    })
    const wrapper = mount(<MainMenu {...props} />)
    const popoverContent = wrapper.find("StatefulPopover").prop("content")

    // @ts-ignore
    const menuWrapper = shallow(popoverContent(() => {})).dive()

    // @ts-ignore
    const menuLabels = menuWrapper
      .find("MenuStatefulContainer")
      .prop("items")
      // @ts-ignore
      .map(item => item.label)
    expect(menuLabels).toEqual([
      "Rerun",
      "Settings",
      "Record a screencast",
      "Share this app",
      "View app source",
      "Report bug with app",
      "About Streamlit for Teams",
    ])
  })

  it("should render core set of menu elements", () => {
    const props = getProps()
    const wrapper = mount(<MainMenu {...props} />)
    const popoverContent = wrapper.find("StatefulPopover").prop("content")
    // @ts-ignore
    const menuWrapper = shallow(popoverContent(() => {})).dive()

    // @ts-ignore
    const menuLabels = menuWrapper
      .find("MenuStatefulContainer")
      .prop("items")
      // @ts-ignore
      .map(item => item.label)
    expect(menuLabels).toEqual([
      "Rerun",
      "Clear cache",
      "Deploy this app",
      "Record a screencast",
      "Documentation",
      "Ask a question",
      "Report a bug",
      "Streamlit for Teams",
      "Settings",
      "About",
    ])
  })

  it("should render deploy app menu item", () => {
    const props = getProps({ gitInfo: {} })
    const wrapper = mount(<MainMenu {...props} />)
    const popoverContent = wrapper.find("StatefulPopover").prop("content")
    // @ts-ignore
    const menuWrapper = shallow(popoverContent(() => {})).dive()

    // @ts-ignore
    const menuLabels = menuWrapper
      .find("MenuStatefulContainer")
      .prop("items")
      // @ts-ignore
      .map(item => item.label)
    expect(menuLabels).toEqual([
      "Rerun",
      "Clear cache",
      "Deploy this app",
      "Record a screencast",
      "Documentation",
      "Ask a question",
      "Report a bug",
      "Streamlit for Teams",
      "Settings",
      "About",
    ])
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
      // @ts-ignore
      const menuWrapper = shallow(popoverContent(() => {})).dive()

      const items: any = menuWrapper.prop("items")

      const deployOption = items.find(
        // @ts-ignore
        ({ label }) => label === "Deploy this app"
      )

      deployOption.onClick()

      // @ts-ignore
      const dialog = dialogComponent(props.gitInfo.module)

      expect(props.showDeployError.mock.calls[0][0]).toStrictEqual(
        dialog.title
      )
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
          isHeadDetached: false,
          untrackedFiles: ["module.py"],
        },
        ModuleIsNotAdded
      )
    })

    it("should display the correct modal if there are uncommitted changes in the repo", () => {
      testDeployErrorModal(
        {
          repository: "repo",
          branch: "branch",
          module: "module.py",
          isHeadDetached: false,
          uncommittedFiles: ["module.py"],
          untrackedFiles: [],
        },
        UncommittedChanges
      )
    })

    it("should display the correct modal if there are changes not pushed to GitHub", () => {
      const deployParams: IGitInfo = {
        repository: "repo",
        branch: "branch",
        module: "module.py",
        uncommittedFiles: [],
        untrackedFiles: [],
        state: GitStates.AHEAD_OF_REMOTE,
      }
      testDeployErrorModal(deployParams, RepoIsAhead)
    })

    it("should display the correct modal if there are untracked files", () => {
      testDeployErrorModal(
        {
          repository: "repo",
          branch: "branch",
          module: "module.py",
          isHeadDetached: false,
          untrackedFiles: ["another-file.py"],
        },
        UntrackedFiles
      )
    })
  })
})
