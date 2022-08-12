import React from "react"
import { mount } from "src/lib/test_util"
import lightTheme from "src/theme/lightTheme"
import { SidebarProps } from "./Sidebar"
import ThemedSidebar from "./ThemedSidebar"

function getProps(
  props: Partial<SidebarProps> = {}
): Omit<SidebarProps, "chevronDownshift" | "theme"> {
  return {
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

    // @ts-ignore
    expect(updatedTheme.colors.bgColor).toBe(lightTheme.colors.secondaryBg)
    // @ts-ignore
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
