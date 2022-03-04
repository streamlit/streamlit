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

import { matchers } from "@emotion/jest"
import React from "react"
import { ReactWrapper } from "enzyme"

import { PageConfig } from "src/autogen/proto"
import { mount } from "src/lib/test_util"
import { spacing } from "src/theme/primitives/spacing"
import Sidebar, { SidebarProps } from "./Sidebar"
import SidebarNav from "./SidebarNav"

expect.extend(matchers)

function renderSideBar(props: Partial<SidebarProps>): ReactWrapper {
  props = {
    appPages: [],
    ...props,
  }
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

  it("uses the default chevron spacing if chevronDownshift is zero", () => {
    const wrapper = renderSideBar({
      chevronDownshift: 0,
      initialSidebarState: PageConfig.SidebarState.COLLAPSED,
    })

    expect(wrapper.find("StyledSidebarCollapsedControl")).toHaveStyleRule(
      "top",
      spacing.sm
    )
  })

  it("uses the given chevron spacing if chevronDownshift is nonzero", () => {
    const wrapper = renderSideBar({
      chevronDownshift: 50,
      initialSidebarState: PageConfig.SidebarState.COLLAPSED,
    })

    expect(wrapper.find("StyledSidebarCollapsedControl")).toHaveStyleRule(
      "top",
      "50px"
    )
  })

  it("renders SidebarNav component", () => {
    const wrapper = renderSideBar({
      appPages: [
        { pageName: "streamlit_app", scriptPath: "streamlit_app.py" },
      ],
    })

    expect(wrapper.find(SidebarNav).exists()).toBe(true)
  })
})
