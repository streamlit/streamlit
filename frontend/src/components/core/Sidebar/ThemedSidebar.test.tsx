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
import { mount } from "src/lib/test_util"
import lightTheme from "src/theme/emotionLightTheme"
import { mockEndpoints } from "src/lib/mocks/mocks"
import { SidebarProps } from "./Sidebar"
import ThemedSidebar from "./ThemedSidebar"

function getProps(
  props: Partial<SidebarProps> = {}
): Omit<SidebarProps, "chevronDownshift" | "theme"> {
  return {
    endpoints: mockEndpoints(),
    appPages: [],
    onPageChange: jest.fn(),
    currentPageScriptHash: "page_hash",
    hasElements: true,
    hideSidebarNav: false,
    pageLinkBaseUrl: "",
    ...props,
  }
}

describe("ThemedSidebar Component", () => {
  it("should render without crashing", () => {
    const wrapper = mount(<ThemedSidebar {...getProps()} />)

    expect(wrapper.find("Sidebar").exists()).toBe(true)
  })

  it("should switch bgColor and secondaryBgColor", () => {
    const wrapper = mount(<ThemedSidebar {...getProps()} />)

    const updatedTheme = wrapper.find("Sidebar").prop("theme")

    // @ts-expect-error
    expect(updatedTheme.colors.bgColor).toBe(lightTheme.colors.secondaryBg)
    // @ts-expect-error
    expect(updatedTheme.inSidebar).toBe(true)
  })

  it("plumbs appPages, currentPageName, and onPageChange to main Sidebar component", () => {
    const appPages = [
      { pageName: "streamlit_app", scriptPath: "streamlit_app.py" },
    ]
    const wrapper = mount(<ThemedSidebar {...getProps({ appPages })} />)

    expect(wrapper.find("Sidebar").prop("appPages")).toEqual(appPages)
    expect(wrapper.find("Sidebar").prop("currentPageScriptHash")).toBe(
      "page_hash"
    )
    expect(typeof wrapper.find("Sidebar").prop("onPageChange")).toBe(
      "function"
    )
  })
})
