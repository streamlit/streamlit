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
import { ReactWrapper } from "enzyme"
import { mount } from "src/lib/test_util"
import { PageConfig } from "src/autogen/proto"

import Sidebar, { SidebarProps } from "./Sidebar"

function renderSideBar(props: Partial<SidebarProps>): ReactWrapper {
  return mount(<Sidebar {...props} />)
}

describe("Sidebar Component", () => {
  it("should render without crashing", () => {
    const wrapper = renderSideBar({})

    expect(wrapper.find("StyledSidebarContent").exists()).toBe(true)
  })

  it("should render expanded", () => {
    const wrapper = renderSideBar({
      initialSidebarState: PageConfig.SidebarState.EXPANDED,
    })

    expect(wrapper.find("StyledSidebarContent").prop("isCollapsed")).toBe(
      false
    )
  })

  it("should render collapsed", () => {
    const wrapper = renderSideBar({
      initialSidebarState: PageConfig.SidebarState.COLLAPSED,
    })

    expect(wrapper.find("StyledSidebarContent").prop("isCollapsed")).toBe(true)
  })

  it("should collapse on toggle if expanded", () => {
    const wrapper = renderSideBar({
      initialSidebarState: PageConfig.SidebarState.EXPANDED,
    })

    wrapper
      .find("StyledSidebarCloseButton")
      .find("Button")
      .simulate("click")
    expect(wrapper.find("StyledSidebarContent").prop("isCollapsed")).toBe(true)
  })

  it("should expand on toggle if collapsed", () => {
    const wrapper = renderSideBar({
      initialSidebarState: PageConfig.SidebarState.COLLAPSED,
    })

    wrapper
      .find("StyledSidebarCollapsedControl")
      .find("Button")
      .simulate("click")
    expect(wrapper.find("StyledSidebarContent").prop("isCollapsed")).toBe(
      false
    )
  })
})
