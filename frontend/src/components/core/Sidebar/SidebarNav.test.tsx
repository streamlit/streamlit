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

import { shallow } from "src/lib/test_util"

import SidebarNav, { Props } from "./SidebarNav"
import {
  StyledSidebarNavItems,
  StyledSidebarNavSeparator,
} from "./styled-components"

const getProps = (props: Partial<Props> = {}): Props => ({
  appPages: [
    { pageName: "streamlit_app", scriptPath: "streamlit_app.py" },
    { pageName: "my_other_page", scriptPath: "my_other_page.py" },
  ],
  ...props,
})

describe("SidebarNav", () => {
  it("returns null if 0 appPages (may be true before the first script run)", () => {
    const wrapper = shallow(<SidebarNav {...getProps({ appPages: [] })} />)
    expect(wrapper.getElement()).toBeNull()
  })

  it("returns null if 1 appPage", () => {
    const wrapper = shallow(
      <SidebarNav
        {...getProps({ appPages: [{ pageName: "streamlit_app" }] })}
      />
    )
    expect(wrapper.getElement()).toBeNull()
  })

  it("replaces underscores with spaces in pageName", () => {
    const wrapper = shallow(<SidebarNav {...getProps()} />)

    const listElems = wrapper.find("li")

    expect(listElems.at(0).text()).toBe("streamlit app")
    expect(listElems.at(1).text()).toBe("my other page")
  })

  it("does not add separator below if there are no sidebar elements", () => {
    const wrapper = shallow(
      <SidebarNav {...getProps({ sidebarHasElements: false })} />
    )
    expect(wrapper.find(StyledSidebarNavSeparator).exists()).toBe(false)
  })

  it("adds separator below if the sidebar also has elements", () => {
    const wrapper = shallow(
      <SidebarNav {...getProps({ sidebarHasElements: true })} />
    )
    expect(wrapper.find(StyledSidebarNavSeparator).exists()).toBe(true)
  })

  // NOTE: Ideally we'd want to test that the maxHeight of the element here is
  // actually 25vh (and 75vh in the test below), but for whatever reason the
  // emotion `toHaveStyleRule` matcher doesn't seem to work with maxHeight or
  // max-height :(
  it("is unexpanded by default", () => {
    const wrapper = shallow(<SidebarNav {...getProps()} />)
    expect(wrapper.find(StyledSidebarNavItems).prop("expanded")).toBe(false)
  })

  it("toggles to expanded when the separator is clicked", () => {
    const wrapper = shallow(
      <SidebarNav {...getProps({ sidebarHasElements: true })} />
    )
    wrapper.find(StyledSidebarNavSeparator).simulate("click")
    expect(wrapper.find(StyledSidebarNavItems).prop("expanded")).toBe(true)
  })
})
