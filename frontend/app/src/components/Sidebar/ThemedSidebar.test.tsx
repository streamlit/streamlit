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
import { screen } from "@testing-library/react"
import { emotionLightTheme, render, mockEndpoints } from "@streamlit/lib"
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
    ...props,
  }
}

describe("ThemedSidebar Component", () => {
  it("should render without crashing", () => {
    render(<ThemedSidebar {...getProps()} />)

    expect(screen.getByTestId("stSidebar")).toBeInTheDocument()
  })

  it("should switch bgColor and secondaryBgColor", () => {
    render(<ThemedSidebar {...getProps()} />)

    expect(screen.getByTestId("stSidebar")).toHaveStyle({
      backgroundColor: emotionLightTheme.colors.secondaryBg,
    })
  })

  it("plumbs appPages to main Sidebar component", () => {
    const appPages = [
      { pageName: "streamlit_app", scriptPath: "streamlit_app.py" },
      { pageName: "other_app_page", scriptPath: "other_app_page.py" },
    ]
    render(<ThemedSidebar {...getProps({ appPages })} />)

    // Check Sidebar & SidebarNav render
    expect(screen.getByTestId("stSidebar")).toBeInTheDocument()
    expect(screen.getByTestId("stSidebarNav")).toBeInTheDocument()

    // Check the app pages passed
    expect(screen.getByText("streamlit app")).toBeInTheDocument()
    expect(screen.getByText("other app page")).toBeInTheDocument()
  })
})
