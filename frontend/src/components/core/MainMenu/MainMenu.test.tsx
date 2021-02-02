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
import { shallow } from "lib/test_util"
import { IMenuItem } from "hocs/withS4ACommunication/types"

import MainMenu, { Props } from "./MainMenu"

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
    const wrapper = shallow(<MainMenu {...props} />)
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
    const wrapper = shallow(<MainMenu {...props} />)
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
    const props = getProps({ deployParams: {} })
    const wrapper = shallow(<MainMenu {...props} />)
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
})
