/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
import {
  screen,
  fireEvent,
  within,
  RenderResult,
} from "@testing-library/react"

import {
  render,
  mockEndpoints,
  emotionLightTheme,
  PageConfig,
} from "@streamlit/lib"
import Sidebar, { SidebarProps } from "./Sidebar"

jest.mock("@streamlit/lib/src/util/Hooks", () => ({
  __esModule: true,
  ...jest.requireActual("@streamlit/lib/src/util/Hooks"),
  useIsOverflowing: jest.fn(),
}))

function renderSidebar(props: Partial<SidebarProps> = {}): RenderResult {
  return render(
    <Sidebar
      endpoints={mockEndpoints()}
      chevronDownshift={0}
      theme={emotionLightTheme}
      appPages={[]}
      onPageChange={jest.fn()}
      currentPageScriptHash={""}
      hasElements
      hideSidebarNav={false}
      {...props}
    />
  )
}

describe("Sidebar Component", () => {
  it("should render without crashing", () => {
    renderSidebar({})

    expect(screen.getByTestId("stSidebar")).toBeInTheDocument()
  })

  it("should render expanded", () => {
    renderSidebar({
      initialSidebarState: PageConfig.SidebarState.EXPANDED,
    })

    expect(screen.getByTestId("stSidebar")).toHaveAttribute(
      "aria-expanded",
      "true"
    )
  })

  it("should render collapsed", () => {
    renderSidebar({
      initialSidebarState: PageConfig.SidebarState.COLLAPSED,
    })

    expect(screen.getByTestId("stSidebar")).toHaveAttribute(
      "aria-expanded",
      "false"
    )
  })

  it("should collapse on toggle if expanded", () => {
    renderSidebar({
      initialSidebarState: PageConfig.SidebarState.EXPANDED,
    })

    expect(screen.getByTestId("stSidebar")).toHaveAttribute(
      "aria-expanded",
      "true"
    )

    // Click the close sidebar <
    fireEvent.mouseOver(screen.getByTestId("stSidebarHeader"))
    fireEvent.click(screen.getByRole("button"))

    expect(screen.getByTestId("stSidebar")).toHaveAttribute(
      "aria-expanded",
      "false"
    )
  })

  it("should expand on toggle if collapsed", () => {
    renderSidebar({
      initialSidebarState: PageConfig.SidebarState.COLLAPSED,
    })

    expect(screen.getByTestId("stSidebar")).toHaveAttribute(
      "aria-expanded",
      "false"
    )

    // Click the expand sidebar > button
    const expandButton = within(
      screen.getByTestId("collapsedControl")
    ).getByRole("button")
    fireEvent.click(expandButton)

    expect(screen.getByTestId("stSidebar")).toHaveAttribute(
      "aria-expanded",
      "true"
    )
  })

  it("chevron does not render if sidebar expanded", () => {
    renderSidebar({
      initialSidebarState: PageConfig.SidebarState.EXPANDED,
    })

    expect(screen.queryByTestId("collapsedControl")).not.toBeInTheDocument()
  })

  it("shows/hides the collapse arrow when hovering over top of sidebar", () => {
    const appPages = [
      { pageName: "first_page", pageScriptHash: "page_hash" },
      { pageName: "second_page", pageScriptHash: "page_hash2" },
    ]
    renderSidebar({ appPages })

    // Hidden when not hovering near the top of sidebar
    expect(screen.getByTestId("stSidebarCollapseButton")).toHaveStyle(
      "display: none"
    )

    // Hover over the sidebar header
    fireEvent.mouseOver(screen.getByTestId("stSidebarHeader"))

    // Displays the collapse <
    expect(screen.getByTestId("stSidebarCollapseButton")).toHaveStyle(
      "display: auto"
    )
  })

  it("has no top padding if no SidebarNav is displayed", () => {
    renderSidebar({
      appPages: [{ pageName: "streamlit_app", pageScriptHash: "page_hash" }],
    })

    expect(screen.getByTestId("stSidebarUserContent")).toHaveStyle(
      "padding-top: 0"
    )
  })

  it("has small padding if the SidebarNav is displayed", () => {
    renderSidebar({
      appPages: [
        { pageName: "streamlit_app", pageScriptHash: "page_hash" },
        { pageName: "streamlit_app2", pageScriptHash: "page_hash2" },
      ],
    })

    expect(screen.getByTestId("stSidebarUserContent")).toHaveStyle(
      "padding-top: 1.5rem"
    )
  })

  it("uses the default chevron spacing if chevronDownshift is zero", () => {
    renderSidebar({
      chevronDownshift: 0,
      initialSidebarState: PageConfig.SidebarState.COLLAPSED,
    })

    expect(screen.getByTestId("collapsedControl")).toHaveStyle("top: 0.5rem")
  })

  it("uses the given chevron spacing if chevronDownshift is nonzero", () => {
    renderSidebar({
      chevronDownshift: 50,
      initialSidebarState: PageConfig.SidebarState.COLLAPSED,
    })

    expect(screen.getByTestId("collapsedControl")).toHaveStyle("top: 50px")
  })

  it("renders SidebarNav component", () => {
    const appPages = [
      { pageName: "first_page", pageScriptHash: "page_hash" },
      { pageName: "second_page", pageScriptHash: "page_hash2" },
    ]
    renderSidebar({ appPages })

    expect(screen.getByTestId("stSidebarNav")).toBeInTheDocument()

    const sidebarAppPages = screen.getAllByRole("listitem")
    expect(sidebarAppPages).toHaveLength(2)
    expect(sidebarAppPages[0]).toHaveTextContent("first page")
    expect(sidebarAppPages[1]).toHaveTextContent("second page")
  })

  it("can hide SidebarNav with the hideSidebarNav option", () => {
    const appPages = [
      { pageName: "streamlit_app", pageScriptHash: "page_hash" },
      { pageName: "streamlit_app2", pageScriptHash: "page_hash2" },
    ]
    renderSidebar({ appPages, hideSidebarNav: true })

    expect(screen.queryByTestId("stSidebarNav")).not.toBeInTheDocument()
    expect(screen.getByTestId("stSidebarUserContent")).toHaveStyle(
      "padding-top: 0"
    )
  })
})
