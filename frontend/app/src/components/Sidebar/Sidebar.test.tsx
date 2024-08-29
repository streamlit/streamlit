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
  fireEvent,
  RenderResult,
  screen,
  within,
} from "@testing-library/react"

import {
  emotionLightTheme,
  Logo,
  mockEndpoints,
  PageConfig,
  render,
} from "@streamlit/lib"

import Sidebar, { SidebarProps } from "./Sidebar"

jest.mock("@streamlit/lib/src/util/Hooks", () => ({
  __esModule: true,
  ...jest.requireActual("@streamlit/lib/src/util/Hooks"),
  useIsOverflowing: jest.fn(),
}))

const mockEndpointProp = mockEndpoints()

function renderSidebar(props: Partial<SidebarProps> = {}): RenderResult {
  return render(
    <Sidebar
      endpoints={mockEndpointProp}
      chevronDownshift={0}
      theme={emotionLightTheme}
      appLogo={null}
      appPages={[]}
      navSections={[]}
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
    const sidebarCollapseButton = within(
      screen.getByTestId("stSidebarCollapseButton")
    ).getByRole("button")
    fireEvent.click(sidebarCollapseButton)

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
      screen.getByTestId("stSidebarCollapsedControl")
    ).getByRole("button")
    fireEvent.click(expandButton)

    expect(screen.getByTestId("stSidebar")).toHaveAttribute(
      "aria-expanded",
      "true"
    )
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
      "display: inline"
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

    expect(screen.getByTestId("stSidebarCollapsedControl")).toHaveStyle(
      "top: 1.25rem"
    )
  })

  it("uses the given chevron spacing if chevronDownshift is nonzero", () => {
    renderSidebar({
      chevronDownshift: 50,
      initialSidebarState: PageConfig.SidebarState.COLLAPSED,
    })

    expect(screen.getByTestId("stSidebarCollapsedControl")).toHaveStyle(
      "top: 50px"
    )
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
  })

  describe("handles appLogo rendering", () => {
    const imageOnly = Logo.create({
      image:
        "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png",
    })

    const imageWithLink = Logo.create({
      image:
        "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png",
      link: "www.example.com",
    })

    const fullAppLogo = Logo.create({
      image:
        "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png",
      link: "www.example.com",
      iconImage: "https://docs.streamlit.io/logo.svg",
    })

    const logoWithSize = Logo.create({
      image:
        "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png",
      link: "www.example.com",
      iconImage: "https://docs.streamlit.io/logo.svg",
      size: "small",
    })

    it("renders spacer if no logo provided", () => {
      renderSidebar({ appLogo: null })
      const sidebarLogoSpacer = within(
        screen.getByTestId("stSidebar")
      ).getByTestId("stLogoSpacer")
      expect(sidebarLogoSpacer).toBeInTheDocument()
    })

    it("renders logo when sidebar collapsed - uses iconImage if provided", () => {
      const sourceSpy = jest.spyOn(mockEndpointProp, "buildMediaURL")
      renderSidebar({
        initialSidebarState: PageConfig.SidebarState.COLLAPSED,
        appLogo: fullAppLogo,
      })
      const openSidebarContainer = screen.getByTestId(
        "stSidebarCollapsedControl"
      )
      expect(openSidebarContainer).toBeInTheDocument()
      const collapsedLogo = within(openSidebarContainer).getByTestId("stLogo")
      expect(collapsedLogo).toBeInTheDocument()
      expect(sourceSpy).toHaveBeenCalledWith(
        "https://docs.streamlit.io/logo.svg"
      )
    })

    it("renders logo when sidebar collapsed - defaults to image if no iconImage", () => {
      const sourceSpy = jest.spyOn(mockEndpointProp, "buildMediaURL")
      renderSidebar({
        initialSidebarState: PageConfig.SidebarState.COLLAPSED,
        appLogo: imageOnly,
      })
      const openSidebarContainer = screen.getByTestId(
        "stSidebarCollapsedControl"
      )
      expect(openSidebarContainer).toBeInTheDocument()
      const collapsedLogo = within(openSidebarContainer).getByTestId("stLogo")
      expect(collapsedLogo).toBeInTheDocument()
      expect(sourceSpy).toHaveBeenCalledWith(
        "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png"
      )
    })

    it("renders logo's image param when sidebar expanded", () => {
      const sourceSpy = jest.spyOn(mockEndpointProp, "buildMediaURL")
      renderSidebar({ appLogo: fullAppLogo })
      const sidebarLogoContainer = screen.getByTestId("stSidebarHeader")
      expect(sidebarLogoContainer).toBeInTheDocument()
      const sidebarLogo = within(sidebarLogoContainer).getByTestId("stLogo")
      expect(sidebarLogo).toBeInTheDocument()
      expect(sourceSpy).toHaveBeenCalledWith(
        "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png"
      )
    })

    it("renders logo - default image has no link & medium size", () => {
      renderSidebar({ appLogo: imageOnly })
      const sidebarLogoLink = within(
        screen.getByTestId("stSidebar")
      ).queryByTestId("stLogoLink")
      expect(sidebarLogoLink).not.toBeInTheDocument()
      const sidebarLogo = within(screen.getByTestId("stSidebar")).getByTestId(
        "stLogo"
      )
      expect(sidebarLogo).toHaveStyle({ height: "1.5rem" })
    })

    it("renders logo - image has link if provided", () => {
      renderSidebar({ appLogo: imageWithLink })
      const sidebarLogoLink = within(
        screen.getByTestId("stSidebar")
      ).getByTestId("stLogoLink")
      expect(sidebarLogoLink).toHaveAttribute("href", "www.example.com")
      const sidebarLogo = within(screen.getByTestId("stSidebar")).getByTestId(
        "stLogo"
      )
      expect(sidebarLogo).toHaveStyle({ height: "1.5rem" })
    })

    it("renders logo - small size when specified", () => {
      renderSidebar({ appLogo: logoWithSize })
      const sidebarLogo = within(screen.getByTestId("stSidebar")).getByTestId(
        "stLogo"
      )
      expect(sidebarLogo).toHaveStyle({ height: "1.25rem" })
    })

    it("sets maxWidth of logo based on sidebar width", () => {
      renderSidebar({ appLogo: imageWithLink })
      const sidebarWidth = window.getComputedStyle(
        screen.getByTestId("stSidebar")
      ).width
      const sidebarLogo = within(screen.getByTestId("stSidebar")).getByTestId(
        "stLogo"
      )
      // L & R padding (twoXL) + R margin (sm) + collapse button (2.25rem)
      expect(sidebarLogo).toHaveStyle(
        `max-width: calc(${sidebarWidth} - 2 * 1.5rem - 0.5rem - 2.25rem)`
      )
    })
  })
})
