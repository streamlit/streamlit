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

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { matchers } from "@emotion/jest"
import { ExpandMore, ExpandLess } from "@emotion-icons/material-outlined"
import React from "react"
import * as reactDeviceDetect from "react-device-detect"
import { act } from "react-dom/test-utils"

import Icon from "src/components/shared/Icon"
import { useIsOverflowing } from "src/lib/util/Hooks"
import { mount, shallow } from "src/lib/test_util"
import { mockEndpoints } from "src/lib/mocks/mocks"
import { IAppPage } from "src/autogen/proto"

import SidebarNav, { Props } from "./SidebarNav"
import {
  StyledSidebarNavItems,
  StyledSidebarNavSeparatorContainer,
  StyledSidebarNavLink,
  StyledSidebarLinkText,
} from "./styled-components"

expect.extend(matchers)

jest.mock("src/lib/Hooks", () => ({
  __esModule: true,
  ...jest.requireActual("src/lib/Hooks"),
  useIsOverflowing: jest.fn(),
}))

const mockUseIsOverflowing = useIsOverflowing as jest.MockedFunction<
  typeof useIsOverflowing
>

const getProps = (props: Partial<Props> = {}): Props => ({
  appPages: [
    { pageScriptHash: "main_page_hash", pageName: "streamlit_app" },
    { pageScriptHash: "other_page_hash", pageName: "my_other_page" },
  ],
  collapseSidebar: jest.fn(),
  currentPageScriptHash: "",
  hasSidebarElements: false,
  hideParentScrollbar: jest.fn(),
  onPageChange: jest.fn(),
  pageLinkBaseUrl: "",
  endpoints: mockEndpoints(),
  ...props,
})

const mockClickEvent = new MouseEvent("click") as any

describe("SidebarNav", () => {
  afterEach(() => {
    mockUseIsOverflowing.mockReset()

    // @ts-expect-error
    reactDeviceDetect.isMobile = false
  })

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

    const links = wrapper
      .find(StyledSidebarNavLink)
      .find(StyledSidebarLinkText)

    expect(links.at(0).text()).toBe("streamlit app")
    expect(links.at(1).text()).toBe("my other page")
  })

  describe("page links", () => {
    const { location: originalLocation } = window

    beforeEach(() => {
      // Replace window.location with a mutable object that otherwise has
      // the same contents so that we can change port below.
      // @ts-expect-error
      delete window.location
      window.location = { ...originalLocation }
    })

    afterEach(() => {
      window.location = originalLocation
    })

    it("are added to each link", () => {
      const buildAppPageURL = jest
        .fn()
        .mockImplementation(
          (pageLinkBaseURL: string, page: IAppPage, pageIndex: number) => {
            return `http://mock/app/page/${page.pageName}.${pageIndex}`
          }
        )
      const props = getProps({ endpoints: mockEndpoints({ buildAppPageURL }) })

      const wrapper = shallow(<SidebarNav {...props} />)

      expect(
        wrapper.find("StyledSidebarNavLink").map(node => node.props().href)
      ).toEqual([
        "http://mock/app/page/streamlit_app.0",
        "http://mock/app/page/my_other_page.1",
      ])
    })
  })

  it("does not add separator below if there are no sidebar elements", () => {
    const wrapper = shallow(
      <SidebarNav {...getProps({ hasSidebarElements: false })} />
    )
    expect(wrapper.find(StyledSidebarNavSeparatorContainer).exists()).toBe(
      false
    )
  })

  it("adds separator below if the sidebar also has elements", () => {
    const wrapper = shallow(
      <SidebarNav {...getProps({ hasSidebarElements: true })} />
    )
    expect(wrapper.find(StyledSidebarNavSeparatorContainer).exists()).toBe(
      true
    )
  })

  it("does not render an icon when not expanded and not overflowing", () => {
    const wrapper = shallow(
      <SidebarNav {...getProps({ hasSidebarElements: true })} />
    )
    expect(
      wrapper.find(StyledSidebarNavSeparatorContainer).find(Icon).exists()
    ).toBe(false)
  })

  it("renders ExpandMore icon when not expanded and overflowing", () => {
    mockUseIsOverflowing.mockReturnValueOnce(true)
    const wrapper = shallow(
      <SidebarNav {...getProps({ hasSidebarElements: true })} />
    )

    expect(
      wrapper.find(StyledSidebarNavSeparatorContainer).find(Icon).props()
    ).toHaveProperty("content", ExpandMore)
  })

  it("renders ExpandLess icon when expanded and not overflowing", () => {
    // We need to have useIsOverflowing return true once so that we can click
    // on the separator to expand the nav component. After this click, it
    // returns false.
    mockUseIsOverflowing.mockReturnValueOnce(true)
    const wrapper = shallow(
      <SidebarNav {...getProps({ hasSidebarElements: true })} />
    )

    wrapper.find(StyledSidebarNavSeparatorContainer).prop("onClick")!(
      mockClickEvent
    )
    expect(
      wrapper.find(StyledSidebarNavSeparatorContainer).find(Icon).props()
    ).toHaveProperty("content", ExpandLess)
  })

  it("renders ExpandLess icon when expanded and overflowing", () => {
    // Have useIsOverflowing return true both before and after the nav is
    // expanded.
    mockUseIsOverflowing.mockReturnValueOnce(true).mockReturnValueOnce(true)
    const wrapper = shallow(
      <SidebarNav {...getProps({ hasSidebarElements: true })} />
    )

    wrapper.find(StyledSidebarNavSeparatorContainer).prop("onClick")!(
      mockClickEvent
    )
    expect(
      wrapper.find(StyledSidebarNavSeparatorContainer).find(Icon).props()
    ).toHaveProperty("content", ExpandLess)
  })

  it("changes cursor to pointer above separator when overflowing", () => {
    mockUseIsOverflowing.mockReturnValueOnce(true)
    // Need mount > shallow here so that toHaveStyleRule can be used.
    const wrapper = mount(
      <SidebarNav {...getProps({ hasSidebarElements: true })} />
    )

    expect(wrapper.find(StyledSidebarNavSeparatorContainer)).toHaveStyleRule(
      "cursor",
      "pointer"
    )
  })

  it("is unexpanded by default", () => {
    // Need mount > shallow here so that toHaveStyleRule can be used.
    const wrapper = mount(
      <SidebarNav {...getProps({ hasSidebarElements: true })} />
    )

    expect(wrapper.find(StyledSidebarNavItems).prop("isExpanded")).toBe(false)
    expect(wrapper.find("StyledSidebarNavItems")).toHaveStyleRule(
      "max-height",
      "33vh"
    )
  })

  it("does not expand when you click on the separator if there is no overflow", () => {
    const wrapper = shallow(
      <SidebarNav {...getProps({ hasSidebarElements: true })} />
    )

    wrapper.find(StyledSidebarNavSeparatorContainer).prop("onClick")!(
      mockClickEvent
    )
    expect(wrapper.find(StyledSidebarNavItems).prop("isExpanded")).toBe(false)
  })

  it("toggles to expanded and back when the separator is clicked", () => {
    mockUseIsOverflowing.mockReturnValueOnce(true)

    // Need mount > shallow here so that toHaveStyleRule can be used.
    const wrapper = mount(
      <SidebarNav {...getProps({ hasSidebarElements: true })} />
    )

    act(() => {
      wrapper.find(StyledSidebarNavSeparatorContainer).prop("onClick")!(
        mockClickEvent
      )
    })
    wrapper.update()

    expect(wrapper.find(StyledSidebarNavItems).prop("isExpanded")).toBe(true)
    expect(wrapper.find(StyledSidebarNavItems)).toHaveStyleRule(
      "max-height",
      "75vh"
    )

    act(() => {
      wrapper.find(StyledSidebarNavSeparatorContainer).prop("onClick")!(
        mockClickEvent
      )
    })
    wrapper.update()

    expect(wrapper.find(StyledSidebarNavItems).prop("isExpanded")).toBe(false)
    expect(wrapper.find(StyledSidebarNavItems)).toHaveStyleRule(
      "max-height",
      "33vh"
    )
  })

  it("passes the pageScriptHash to onPageChange if a link is clicked", () => {
    const props = getProps()
    const wrapper = shallow(<SidebarNav {...props} />)

    const preventDefault = jest.fn()
    const links = wrapper.find(StyledSidebarNavLink)
    links.at(1).simulate("click", { preventDefault })

    expect(preventDefault).toHaveBeenCalled()
    expect(props.onPageChange).toHaveBeenCalledWith("other_page_hash")
    expect(props.collapseSidebar).not.toHaveBeenCalled()
  })

  it("collapses sidebar on page change when on mobile", () => {
    // @ts-expect-error
    reactDeviceDetect.isMobile = true

    const props = getProps()
    const wrapper = shallow(<SidebarNav {...props} />)

    const preventDefault = jest.fn()
    const links = wrapper.find(StyledSidebarNavLink)
    links.at(1).simulate("click", { preventDefault })

    expect(preventDefault).toHaveBeenCalled()
    expect(props.onPageChange).toHaveBeenCalledWith("other_page_hash")
    expect(props.collapseSidebar).toHaveBeenCalled()
  })

  it("calls hideParentScrollbar onMouseOut", () => {
    const props = getProps()
    const wrapper = shallow(<SidebarNav {...props} />)

    wrapper.find(StyledSidebarNavItems).simulate("mouseOut")

    expect(props.hideParentScrollbar).toHaveBeenCalledWith(false)
  })

  it("does not call hideParentScrollbar on mouseOver if not overflowing", () => {
    const props = getProps()
    const wrapper = shallow(<SidebarNav {...props} />)

    wrapper.find(StyledSidebarNavItems).simulate("mouseOver")

    expect(props.hideParentScrollbar).not.toHaveBeenCalled()
  })

  it("does call hideParentScrollbar on mouseOver if overflowing", () => {
    mockUseIsOverflowing.mockReturnValueOnce(true)
    const props = getProps()
    const wrapper = shallow(<SidebarNav {...props} />)

    wrapper.find(StyledSidebarNavItems).simulate("mouseOver")

    expect(props.hideParentScrollbar).toHaveBeenCalledWith(true)
  })

  it("handles default and custom page icons", () => {
    const props = getProps({
      appPages: [
        { pageName: "streamlit_app" },
        { pageName: "my_other_page", icon: "🦈" },
      ],
    })

    const wrapper = shallow(<SidebarNav {...props} />)

    expect(
      wrapper.find(StyledSidebarNavLink).at(1).find("EmojiIcon").dive().text()
    ).toBe("🦈")
  })

  it("indicates the current page as active", () => {
    const props = getProps({ currentPageScriptHash: "other_page_hash" })

    const wrapper = shallow(<SidebarNav {...props} />)

    expect(wrapper.find(StyledSidebarNavLink).at(0).prop("isActive")).toBe(
      false
    )
    expect(wrapper.find(StyledSidebarNavLink).at(1).prop("isActive")).toBe(
      true
    )
  })

  it("changes the text color when the page is active", () => {
    const props = getProps({ currentPageScriptHash: "other_page_hash" })

    const wrapper = mount(<SidebarNav {...props} />)
    const activeLink = wrapper.find(StyledSidebarNavLink).at(1)

    expect(activeLink.find(StyledSidebarLinkText)).toHaveStyleRule(
      "color",
      "#31333F"
    )
  })
})
