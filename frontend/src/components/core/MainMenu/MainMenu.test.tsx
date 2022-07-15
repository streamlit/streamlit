/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
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

import { mount } from "src/lib/test_util"
import { IMenuItem } from "src/hocs/withS4ACommunication/types"

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
  closeDialog: jest.fn(),
  menuItems: {},
  s4aIsOwner: false,
  ...extend,
})

describe("App", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = mount(<MainMenu {...props} />)

    expect(wrapper).toMatchSnapshot()
  })

  it("should render s4a menu items", () => {
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
      s4aMenuItems: items,
    })
    const wrapper = mount(<MainMenu {...props} />)
    const popoverContent = wrapper.find("StatefulPopover").prop("content")

    // @ts-ignore
    const menuWrapper = mount(popoverContent(() => {}))

    // @ts-ignore
    const menuLabels = menuWrapper
      .find("MenuStatefulContainer")
      .at(0)
      .prop("items")
      // @ts-ignore
      .map(item => item.label)
    expect(menuLabels).toEqual([
      "Rerun",
      "Settings",
      "Record a screencast",
      "Report a bug",
      "Get help",
      "View app source",
      "Report bug with app",
      "About",
    ])

    // @ts-ignore
    const devMenuLabels = menuWrapper
      .find("MenuStatefulContainer")
      .at(1)
      .prop("items")
      // @ts-ignore
      .map(item => item.label)
    expect(devMenuLabels).toEqual([
      "Developer options",
      "Clear cache",
      "Streamlit Cloud",
      "Report a Streamlit bug",
      "Visit Streamlit docs",
      "Visit Streamlit forums",
    ])
  })

  it("should render core set of menu elements", () => {
    const props = getProps()
    const wrapper = mount(<MainMenu {...props} />)
    const popoverContent = wrapper.find("StatefulPopover").prop("content")
    // @ts-ignore
    const menuWrapper = mount(popoverContent(() => {}))

    // @ts-ignore
    const menuLabels = menuWrapper
      .find("MenuStatefulContainer")
      .at(0)
      .prop("items")
      // @ts-ignore
      .map(item => item.label)
    expect(menuLabels).toEqual([
      "Rerun",
      "Settings",
      "Record a screencast",
      "Report a bug",
      "Get help",
      "About",
    ])

    // @ts-ignore
    const devMenuLabels = menuWrapper
      .find("MenuStatefulContainer")
      .at(1)
      .prop("items")
      // @ts-ignore
      .map(item => item.label)
    expect(devMenuLabels).toEqual([
      "Developer options",
      "Clear cache",
      "Deploy this app",
      "Streamlit Cloud",
      "Report a Streamlit bug",
      "Visit Streamlit docs",
      "Visit Streamlit forums",
    ])
  })

  it("should render deploy app menu item", () => {
    const props = getProps()
    const wrapper = mount(<MainMenu {...props} />)
    const popoverContent = wrapper.find("StatefulPopover").prop("content")
    // @ts-ignore
    const menuWrapper = mount(popoverContent(() => {}))

    // @ts-ignore
    const menuLabels = menuWrapper
      .find("MenuStatefulContainer")
      .at(0)
      .prop("items")
      // @ts-ignore
      .map(item => item.label)
    expect(menuLabels).toEqual([
      "Rerun",
      "Settings",
      "Record a screencast",
      "Report a bug",
      "Get help",
      "About",
    ])

    // @ts-ignore
    const devMenuLabels = menuWrapper
      .find("MenuStatefulContainer")
      .at(1)
      .prop("items")
      // @ts-ignore
      .map(item => item.label)
    expect(devMenuLabels).toEqual([
      "Developer options",
      "Clear cache",
      "Deploy this app",
      "Streamlit Cloud",
      "Report a Streamlit bug",
      "Visit Streamlit docs",
      "Visit Streamlit forums",
    ])
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
    // @ts-ignore
    const menuWrapper = mount(popoverContent(() => {}))

    // @ts-ignore
    const menuLabels = menuWrapper
      .find("MenuStatefulContainer")
      .at(0)
      .prop("items")
      // @ts-ignore
      .map(item => item.label)
    expect(menuLabels).toEqual([
      "Rerun",
      "Settings",
      "Record a screencast",
      "About",
    ])
  })

  it("should not render report a bug in core menu", () => {
    const menuItems = {
      getHelpUrl: "testing",
      hideGetHelp: false,
      hideReportABug: true,
      aboutSectionMd: "",
    }
    const props = getProps({ menuItems })
    const wrapper = mount(<MainMenu {...props} />)
    const popoverContent = wrapper.find("StatefulPopover").prop("content")
    // @ts-ignore
    const menuWrapper = mount(popoverContent(() => {}))

    // @ts-ignore
    const menuLabels = menuWrapper
      .find("MenuStatefulContainer")
      .at(0)
      .prop("items")
      // @ts-ignore
      .map(item => item.label)
    expect(menuLabels).toEqual([
      "Rerun",
      "Settings",
      "Record a screencast",
      "Get help",
      "About",
    ])
  })

  it("should not render dev menu when s4aIsOwner is false and not on localhost", () => {
    // set isLocalhost to false by deleting window.location.
    // Source: https://www.benmvp.com/blog/mocking-window-location-methods-jest-jsdom/
    // @ts-ignore
    delete window.location

    // @ts-ignore
    window.location = {
      assign: jest.fn(),
    }
    const props = getProps()
    const wrapper = mount(<MainMenu {...props} />)
    const popoverContent = wrapper.find("StatefulPopover").prop("content")
    // @ts-ignore
    const menuWrapper = mount(popoverContent(() => {}))

    // @ts-ignore
    const menuLabels = menuWrapper
      .find("MenuStatefulContainer")
      // make sure that we only have one menu otherwise prop will fail
      .prop("items")
      // @ts-ignore
      .map(item => item.label)
    expect(menuLabels).toEqual([
      "Rerun",
      "Settings",
      "Record a screencast",
      "Report a bug",
      "Get help",
      "About",
    ])
  })
})
