import { matchers } from "@emotion/jest"
import React from "react"
import { ReactWrapper } from "enzyme"

import { PageConfig } from "src/autogen/proto"
import { mount } from "src/lib/test_util"
import { spacing } from "src/theme/primitives/spacing"
import lightTheme from "src/theme/lightTheme"
import Sidebar, { SidebarProps } from "./Sidebar"
import SidebarNav from "./SidebarNav"

expect.extend(matchers)

function renderSideBar(props: Partial<SidebarProps> = {}): ReactWrapper {
  return mount(
    <Sidebar
      chevronDownshift={0}
      theme={lightTheme}
      appPages={[]}
      onPageChange={jest.fn()}
      currentPageScriptHash={""}
      hasElements
      pageLinkBaseUrl={""}
      hideSidebarNav={false}
      {...props}
    />
  )
}

describe("Sidebar Component", () => {
  it("should render without crashing", () => {
    const wrapper = renderSideBar({})

    expect(wrapper.find("StyledSidebar").exists()).toBe(true)
  })

  it("should render expanded", () => {
    const wrapper = renderSideBar({
      initialSidebarState: PageConfig.SidebarState.EXPANDED,
    })

    expect(wrapper.find("Resizable").prop("isCollapsed")).toBe(false)
  })

  it("should render collapsed", () => {
    const wrapper = renderSideBar({
      initialSidebarState: PageConfig.SidebarState.COLLAPSED,
    })

    expect(wrapper.find("Resizable").prop("isCollapsed")).toBe(true)
  })

  it("should collapse on toggle if expanded", () => {
    const wrapper = renderSideBar({
      initialSidebarState: PageConfig.SidebarState.EXPANDED,
    })

    wrapper
      .find("StyledSidebarCloseButton")
      .find("button")
      .simulate("click")
    expect(wrapper.find("Resizable").prop("isCollapsed")).toBe(true)
  })

  it("should expand on toggle if collapsed", () => {
    const wrapper = renderSideBar({
      initialSidebarState: PageConfig.SidebarState.COLLAPSED,
    })

    wrapper
      .find("StyledSidebarCollapsedControl")
      .find("button")
      .simulate("click")
    expect(wrapper.find("Resizable").prop("isCollapsed")).toBe(false)
  })

  it("chevron does not render if sidebar expanded", () => {
    const wrapper = renderSideBar({
      initialSidebarState: PageConfig.SidebarState.EXPANDED,
    })

    expect(wrapper.find("StyledSidebarCollapsedControl").exists()).toBe(false)
  })

  it("hides scrollbar when hideScrollbar is called", () => {
    const wrapper = renderSideBar({})

    expect(wrapper.find("StyledSidebarContent")).toHaveStyleRule(
      "overflow",
      "overlay"
    )

    wrapper.find(SidebarNav).prop("hideParentScrollbar")(true)
    wrapper.update()

    expect(wrapper.find("StyledSidebarContent")).toHaveStyleRule(
      "overflow",
      "hidden"
    )
  })

  it("has extra top and bottom padding if no SidebarNav is displayed", () => {
    const wrapper = renderSideBar({
      appPages: [{ pageName: "streamlit_app", pageScriptHash: "page_hash" }],
    })

    expect(wrapper.find("StyledSidebarUserContent")).toHaveStyleRule(
      "padding-top",
      "6rem"
    )
  })

  it("has less padding if the SidebarNav is displayed", () => {
    const wrapper = renderSideBar({
      appPages: [
        { pageName: "streamlit_app", pageScriptHash: "page_hash" },
        { pageName: "streamlit_app2", pageScriptHash: "page_hash2" },
      ],
    })

    expect(wrapper.find("StyledSidebarUserContent")).toHaveStyleRule(
      "padding-top",
      spacing.lg
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
    const appPages = [
      { pageName: "streamlit_app", pageScriptHash: "page_hash" },
      { pageName: "streamlit_app2", pageScriptHash: "page_hash2" },
    ]
    const wrapper = renderSideBar({ appPages })

    expect(wrapper.find(SidebarNav).exists()).toBe(true)
    expect(wrapper.find(SidebarNav).prop("appPages")).toEqual(appPages)
    expect(typeof wrapper.find(SidebarNav).prop("onPageChange")).toBe(
      "function"
    )
    expect(
      wrapper.find("StyledSidebarUserContent").prop("hasPageNavAbove")
    ).toBe(true)
  })

  it("can hide SidebarNav with the hideSidebarNav option", () => {
    const appPages = [
      { pageName: "streamlit_app", pageScriptHash: "page_hash" },
      { pageName: "streamlit_app2", pageScriptHash: "page_hash2" },
    ]
    const wrapper = renderSideBar({ appPages, hideSidebarNav: true })

    expect(wrapper.find(SidebarNav).exists()).toBe(false)
    expect(
      wrapper.find("StyledSidebarUserContent").prop("hasPageNavAbove")
    ).toBe(false)
  })
})
