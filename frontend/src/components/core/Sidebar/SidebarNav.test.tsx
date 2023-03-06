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
import React from "react"
import * as reactDeviceDetect from "react-device-detect"
import { act } from "react-dom/test-utils"

import { useIsOverflowing } from "src/lib/Hooks"
import { mount, shallow } from "src/lib/test_util"
import { BaseUriParts } from "src/lib/UriUtil"

import SidebarNav, { Props } from "./SidebarNav"
import {
  StyledSidebarNavItems,
  StyledSidebarNavSeparatorContainer,
  StyledSidebarNavLink,
  StyledSidebarLinkText,
  StyledSidebarNavButton,
} from "./styled-components"

expect.extend(matchers)

jest.mock("src/lib/Hooks", () => ({
  __esModule: true,
  // @ts-ignore
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
  collapseNav: true,
  hasSidebarElements: false,
  hideParentScrollbar: jest.fn(),
  onPageChange: jest.fn(),
  pageLinkBaseUrl: "",
  ...props,
})

const mockClickEvent = new MouseEvent("click") as any

describe("SidebarNav", () => {
  afterEach(() => {
    mockUseIsOverflowing.mockReset()

    // @ts-ignore
    reactDeviceDetect.isMobile = false
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
      // @ts-ignore
      delete window.location
      window.location = { ...originalLocation }
    })

    afterEach(() => {
      window.location = originalLocation
    })

    it("are added to each link", () => {
      const wrapper = shallow(<SidebarNav {...getProps()} />)

      expect(
        wrapper.find("StyledSidebarNavLink").map(node => node.props().href)
      ).toEqual(["http://localhost/", "http://localhost/my_other_page"])
    })

    it("work with non-default port", () => {
      window.location.port = "3000"
      const wrapper = shallow(<SidebarNav {...getProps()} />)

      expect(
        wrapper.find("StyledSidebarNavLink").map(node => node.props().href)
      ).toEqual([
        "http://localhost:3000/",
        "http://localhost:3000/my_other_page",
      ])
    })

    it("work with non-default baseUrlPaths", () => {
      const getBaseUriParts = (): Partial<BaseUriParts> => ({
        basePath: "foo/bar",
        host: "example.com",
      })

      const mockUseContext = jest
        .spyOn(React, "useContext")
        .mockImplementation(() => ({ getBaseUriParts }))

      const wrapper = shallow(<SidebarNav {...getProps()} />)

      expect(
        wrapper.find("StyledSidebarNavLink").map(node => node.props().href)
      ).toEqual([
        "http://example.com/foo/bar/",
        "http://example.com/foo/bar/my_other_page",
      ])

      mockUseContext.mockRestore()
    })

    it("work with non-default port and non-default baseUrlPaths", () => {
      window.location.port = "3000"
      const getBaseUriParts = (): Partial<BaseUriParts> => ({
        basePath: "foo/bar",
        host: "localhost",
      })

      const mockUseContext = jest
        .spyOn(React, "useContext")
        .mockImplementation(() => ({ getBaseUriParts }))

      const wrapper = shallow(<SidebarNav {...getProps()} />)

      expect(
        wrapper.find("StyledSidebarNavLink").map(node => node.props().href)
      ).toEqual([
        "http://localhost:3000/foo/bar/",
        "http://localhost:3000/foo/bar/my_other_page",
      ])

      mockUseContext.mockRestore()
    })

    it("is built using the pageLinkBaseUrl if one is set", () => {
      window.location.port = "3000"

      const wrapper = shallow(
        <SidebarNav
          {...getProps({
            pageLinkBaseUrl: "https://share.streamlit.io/vdonato/foo/bar",
          })}
        />
      )

      expect(
        wrapper.find("StyledSidebarNavLink").map(node => node.props().href)
      ).toEqual([
        "https://share.streamlit.io/vdonato/foo/bar/",
        "https://share.streamlit.io/vdonato/foo/bar/my_other_page",
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

  it("doesn't render the StyledSidebarNavButton if pages <= 6", () => {
    const wrapper = shallow(
      <SidebarNav
        {...getProps({
          hasSidebarElements: true,
          appPages: [
            { pageName: "my_first_page" },
            { pageName: "my_second_page" },
            { pageName: "my_third_page" },
            { pageName: "my_fourth_page" },
            { pageName: "my_fifth_page" },
          ],
        })}
      />
    )

    expect(
      wrapper
        .find(StyledSidebarNavSeparatorContainer)
        .find(StyledSidebarNavButton)
        .exists()
    ).toBe(false)
  })

  it("renders the correct StyledSidebarNavButton when collapsed", () => {
    const wrapper = shallow(
      <SidebarNav
        {...getProps({
          hasSidebarElements: true,
          appPages: [
            { pageName: "my_first_page" },
            { pageName: "my_second_page" },
            { pageName: "my_third_page" },
            { pageName: "my_fourth_page" },
            { pageName: "my_fifth_page" },
            { pageName: "my_sixth_page" },
            { pageName: "my_seventh_page" },
            { pageName: "my_eight_page" },
          ],
        })}
      />
    )

    expect(wrapper.find(StyledSidebarNavButton).text()).toBe("2 More")
  })

  it("renders the correct StyledSidebarNavButton when expanded", () => {
    // We need to have useIsOverflowing return true once so that we can click
    // on the separator to expand the nav component. After this click, it
    // returns false.
    mockUseIsOverflowing.mockReturnValueOnce(true)
    const wrapper = shallow(
      <SidebarNav
        {...getProps({
          hasSidebarElements: true,
          appPages: [
            { pageName: "my_first_page" },
            { pageName: "my_second_page" },
            { pageName: "my_third_page" },
            { pageName: "my_fourth_page" },
            { pageName: "my_fifth_page" },
            { pageName: "my_sixth_page" },
            { pageName: "my_seventh_page" },
            { pageName: "my_eight_page" },
          ],
        })}
      />
    )

    wrapper.find(StyledSidebarNavButton).prop("onClick")!(mockClickEvent)
    expect(wrapper.find(StyledSidebarNavButton).text()).toBe("View less")
  })

  it("shows only 6 nav items if collapseNav is true", () => {
    const wrapper = mount(
      <SidebarNav
        {...getProps({
          hasSidebarElements: false,
          collapseNav: true,
          appPages: [
            { pageName: "my_first_page" },
            { pageName: "my_second_page" },
            { pageName: "my_third_page" },
            { pageName: "my_fourth_page" },
            { pageName: "my_fifth_page" },
            { pageName: "my_sixth_page" },
            { pageName: "my_seventh_page" },
            { pageName: "my_eight_page" },
          ],
        })}
      />
    )

    expect(wrapper.find("StyledSidebarNavLinkContainer")).toHaveLength(6)
  })

  it("shows all nav items if collapseNav is false", () => {
    const wrapper = mount(
      <SidebarNav
        {...getProps({
          hasSidebarElements: false,
          collapseNav: false,
          appPages: [
            { pageName: "my_first_page" },
            { pageName: "my_second_page" },
            { pageName: "my_third_page" },
            { pageName: "my_fourth_page" },
            { pageName: "my_fifth_page" },
            { pageName: "my_sixth_page" },
            { pageName: "my_seventh_page" },
            { pageName: "my_eight_page" },
          ],
        })}
      />
    )

    expect(wrapper.find("StyledSidebarNavLinkContainer")).toHaveLength(8)
  })

  it("is expanded by default if no widgets are present on the sidebar", () => {
    const wrapper = mount(
      <SidebarNav
        {...getProps({ hasSidebarElements: false, collapseNav: false })}
      />
    )

    expect(wrapper.prop("hasSidebarElements")).toBe(false)
    expect(wrapper.find("StyledSidebarNavItems li")).toHaveLength(2)
  })

  it("toggles to expanded and back when the StyledSidebarNavButton is clicked", () => {
    mockUseIsOverflowing.mockReturnValueOnce(true)

    // Need mount > shallow here so that toHaveStyleRule can be used.
    const wrapper = mount(
      <SidebarNav
        {...getProps({
          hasSidebarElements: true,
          appPages: [
            { pageName: "my_first_page" },
            { pageName: "my_second_page" },
            { pageName: "my_third_page" },
            { pageName: "my_fourth_page" },
            { pageName: "my_fifth_page" },
            { pageName: "my_sixth_page" },
            { pageName: "my_seventh_page" },
            { pageName: "my_eight_page" },
          ],
        })}
      />
    )

    act(() => {
      wrapper.find(StyledSidebarNavButton).prop("onClick")!(mockClickEvent)
    })
    wrapper.update()

    expect(wrapper.find("StyledSidebarNavItems li")).toHaveLength(8)

    act(() => {
      wrapper.find(StyledSidebarNavButton).prop("onClick")!(mockClickEvent)
    })
    wrapper.update()

    expect(wrapper.find("StyledSidebarNavItems li")).toHaveLength(6)
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

  it("toggles to expanded and back when the StyledSidebarNavButton is clicked", () => {
    mockUseIsOverflowing.mockReturnValueOnce(true)

    // Need mount > shallow here so that toHaveStyleRule can be used.
    const wrapper = mount(
      <SidebarNav
        {...getProps({
          hasSidebarElements: true,
          appPages: [
            { pageName: "my_first_page" },
            { pageName: "my_second_page" },
            { pageName: "my_third_page" },
            { pageName: "my_fourth_page" },
            { pageName: "my_fifth_page" },
            { pageName: "my_sixth_page" },
            { pageName: "my_seventh_page" },
            { pageName: "my_eight_page" },
          ],
        })}
      />
    )

    act(() => {
      wrapper.find(StyledSidebarNavButton).prop("onClick")!(mockClickEvent)
    })
    wrapper.update()

    expect(wrapper.find(StyledSidebarNavItems).prop("isExpanded")).toBe(true)
    expect(wrapper.find(StyledSidebarNavItems)).toHaveStyleRule(
      "max-height",
      "75vh"
    )

    act(() => {
      wrapper.find(StyledSidebarNavButton).prop("onClick")!(mockClickEvent)
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
    // @ts-ignore
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
