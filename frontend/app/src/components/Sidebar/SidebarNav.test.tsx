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

import * as reactDeviceDetect from "react-device-detect"
import { fireEvent, screen } from "@testing-library/react"

import { IAppPage, mockEndpoints, render } from "@streamlit/lib"

import SidebarNav, { Props } from "./SidebarNav"

jest.mock("@streamlit/lib/src/util/Hooks", () => ({
  __esModule: true,
  ...jest.requireActual("@streamlit/lib/src/util/Hooks"),
  useIsOverflowing: jest.fn(),
}))

const getProps = (props: Partial<Props> = {}): Props => ({
  appPages: [
    {
      pageScriptHash: "main_page_hash",
      pageName: "streamlit app",
      urlPathname: "streamlit_app",
      isDefault: true,
    },
    {
      pageScriptHash: "other_page_hash",
      pageName: "my other page",
      urlPathname: "my_other_page",
    },
  ],
  navSections: [],
  collapseSidebar: jest.fn(),
  currentPageScriptHash: "",
  hasSidebarElements: false,
  onPageChange: jest.fn(),
  endpoints: mockEndpoints(),
  ...props,
})

describe("SidebarNav", () => {
  afterEach(() => {
    // @ts-expect-error
    reactDeviceDetect.isMobile = false
  })

  it("replaces underscores with spaces in pageName", () => {
    render(<SidebarNav {...getProps()} />)

    expect(screen.getByText("streamlit app")).toBeInTheDocument()
    expect(screen.getByText("my other page")).toBeInTheDocument()
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
        .mockImplementation((pageLinkBaseURL: string, page: IAppPage) => {
          return `http://mock/app/page/${page.urlPathname}`
        })
      const props = getProps({ endpoints: mockEndpoints({ buildAppPageURL }) })

      render(<SidebarNav {...props} />)

      const links = screen.getAllByRole("link")
      expect(links).toHaveLength(2)

      expect(links[0]).toHaveAttribute(
        "href",
        "http://mock/app/page/streamlit_app"
      )
      expect(links[1]).toHaveAttribute(
        "href",
        "http://mock/app/page/my_other_page"
      )
    })
  })

  it("does not add separator below if there are no sidebar elements", () => {
    render(<SidebarNav {...getProps({ hasSidebarElements: false })} />)
    expect(
      screen.queryByTestId("stSidebarNavSeparator")
    ).not.toBeInTheDocument()
  })

  it("adds separator below if the sidebar also has elements", () => {
    render(<SidebarNav {...getProps({ hasSidebarElements: true })} />)
    expect(screen.getByTestId("stSidebarNavSeparator")).toBeInTheDocument()
  })

  it("renders View more button when there are 13 elements", () => {
    render(
      <SidebarNav
        {...getProps({
          hasSidebarElements: true,
          appPages: [
            {
              pageScriptHash: "main_page_hash",
              pageName: "streamlit app",
              urlPathname: "streamlit_app",
              isDefault: true,
            },
          ].concat(
            Array.from({ length: 12 }, (_, index) => ({
              pageScriptHash: `other_page_hash${index}`,
              pageName: `my other page${index}`,
              urlPathname: `my_other_page${index}`,
              isDefault: false,
            }))
          ),
        })}
      />
    )

    expect(screen.getByTestId("stSidebarNavSeparator")).toBeInTheDocument()
    expect(screen.getByTestId("stSidebarNavViewButton")).toHaveTextContent(
      "View 3 more"
    )
  })

  it("renders View more button when there are more than 13 elements", () => {
    render(
      <SidebarNav
        {...getProps({
          hasSidebarElements: true,
          appPages: [
            {
              pageScriptHash: "main_page_hash",
              pageName: "streamlit app",
              urlPathname: "streamlit_app",
              isDefault: true,
            },
          ].concat(
            Array.from({ length: 13 }, (_, index) => ({
              pageScriptHash: `other_page_hash${index}`,
              pageName: `my other page${index}`,
              urlPathname: `my_other_page${index}`,
              isDefault: false,
            }))
          ),
        })}
      />
    )

    expect(screen.getByTestId("stSidebarNavSeparator")).toBeInTheDocument()
    expect(screen.getByTestId("stSidebarNavViewButton")).toHaveTextContent(
      "View 4 more"
    )
  })

  it("does not render View more button when there are < 13 elements", () => {
    render(
      <SidebarNav
        {...getProps({
          hasSidebarElements: true,
          appPages: [
            {
              pageScriptHash: "main_page_hash",
              pageName: "streamlit app",
              urlPathname: "streamlit_app",
              isDefault: true,
            },
          ].concat(
            Array.from({ length: 11 }, (_, index) => ({
              pageScriptHash: `other_page_hash${index}`,
              pageName: `my other page${index}`,
              urlPathname: `my_other_page${index}`,
              isDefault: false,
            }))
          ),
        })}
      />
    )

    expect(
      screen.queryByTestId("stSidebarNavViewButton")
    ).not.toBeInTheDocument()
    expect(screen.getAllByTestId("stSidebarNavLink")).toHaveLength(12)
  })

  it("renders View less button when visible and expanded", async () => {
    render(
      <SidebarNav
        {...getProps({
          hasSidebarElements: true,
          appPages: [
            {
              pageScriptHash: "main_page_hash",
              pageName: "streamlit app",
              urlPathname: "streamlit_app",
              isDefault: true,
            },
          ].concat(
            Array.from({ length: 13 }, (_, index) => ({
              pageScriptHash: `other_page_hash${index}`,
              pageName: `my other page${index}`,
              urlPathname: `my_other_page${index}`,
              isDefault: false,
            }))
          ),
        })}
      />
    )

    // Click on the separator to expand the nav component.
    fireEvent.click(screen.getByTestId("stSidebarNavViewButton"))

    const viewLessButton = await screen.findByText("View less")
    expect(viewLessButton).toBeInTheDocument()
  })

  it("is unexpanded by default, displaying 10 links when > 12 pages", () => {
    render(
      <SidebarNav
        {...getProps({
          hasSidebarElements: true,
          appPages: [
            {
              pageScriptHash: "main_page_hash",
              pageName: "streamlit app",
              urlPathname: "streamlit_app",
              isDefault: true,
            },
          ].concat(
            Array.from({ length: 13 }, (_, index) => ({
              pageScriptHash: `other_page_hash${index}`,
              pageName: `my other page${index}`,
              urlPathname: `my_other_page${index}`,
              isDefault: false,
            }))
          ),
        })}
      />
    )

    const navLinks = screen.getAllByTestId("stSidebarNavLink")
    expect(navLinks).toHaveLength(10)
  })

  it("toggles to expanded and back when the View more/less buttons are clicked", () => {
    render(
      <SidebarNav
        {...getProps({
          hasSidebarElements: true,
          appPages: [
            {
              pageScriptHash: "main_page_hash",
              pageName: "streamlit app",
              urlPathname: "streamlit_app",
              isDefault: true,
            },
          ].concat(
            Array.from({ length: 13 }, (_, index) => ({
              pageScriptHash: `other_page_hash${index}`,
              pageName: `my other page${index}`,
              urlPathname: `my_other_page${index}`,
              isDefault: false,
            }))
          ),
        })}
      />
    )

    expect(screen.getByTestId("stSidebarNavSeparator")).toBeInTheDocument()
    expect(screen.getAllByTestId("stSidebarNavLink")).toHaveLength(10)
    // Expand the pages menu
    fireEvent.click(screen.getByTestId("stSidebarNavViewButton"))

    expect(screen.getAllByTestId("stSidebarNavLink")).toHaveLength(14)
    // Collapse the pages menu
    fireEvent.click(screen.getByTestId("stSidebarNavViewButton"))
    expect(screen.getAllByTestId("stSidebarNavLink")).toHaveLength(10)
  })

  it("displays partial sections", () => {
    render(
      <SidebarNav
        {...getProps({
          hasSidebarElements: true,
          navSections: ["section 1", "section 2"],
          appPages: [
            {
              pageScriptHash: "main_page_hash",
              pageName: "streamlit app",
              urlPathname: "streamlit_app",
              isDefault: true,
              sectionHeader: "section 1",
            },
          ].concat(
            Array.from({ length: 13 }, (_, index) => ({
              pageScriptHash: `other_page_hash${index}`,
              pageName: `my other page${index}`,
              urlPathname: `my_other_page${index}`,
              isDefault: false,
              sectionHeader: `section ${(index % 2) + 1}`,
            }))
          ),
        })}
      />
    )

    expect(screen.getByTestId("stSidebarNavSeparator")).toBeInTheDocument()
    expect(screen.getAllByTestId("stSidebarNavLink")).toHaveLength(10)
    expect(screen.getAllByTestId("stNavSectionHeader")).toHaveLength(2)

    // Expand the pages menu
    fireEvent.click(screen.getByTestId("stSidebarNavViewButton"))

    expect(screen.getAllByTestId("stSidebarNavLink")).toHaveLength(14)
    expect(screen.getAllByTestId("stNavSectionHeader")).toHaveLength(2)
    // Collapse the pages menu
    fireEvent.click(screen.getByTestId("stSidebarNavViewButton"))
    expect(screen.getAllByTestId("stSidebarNavLink")).toHaveLength(10)
    expect(screen.getAllByTestId("stNavSectionHeader")).toHaveLength(2)
  })

  it("will not display a section if no pages in it are visible", () => {
    // First section has 6 pages, second section has 4 pages, third section has 4 pages
    // Since 6+4 = 10, only the first two sections should be visible
    render(
      <SidebarNav
        {...getProps({
          hasSidebarElements: true,
          navSections: ["section 1", "section 2", "section 3"],
          appPages: [
            {
              pageScriptHash: "main_page_hash",
              pageName: "streamlit app",
              urlPathname: "streamlit_app",
              isDefault: true,
              sectionHeader: "section 1",
            },
          ].concat(
            Array.from({ length: 13 }, (_, index) => ({
              pageScriptHash: `other_page_hash${index}`,
              pageName: `my other page${index}`,
              urlPathname: `my_other_page${index}`,
              isDefault: false,
              sectionHeader: `section ${(index % 3) + 1}`,
            }))
          ),
        })}
      />
    )

    expect(screen.getByTestId("stSidebarNavSeparator")).toBeInTheDocument()
    expect(screen.getAllByTestId("stSidebarNavLink")).toHaveLength(10)
    expect(screen.getAllByTestId("stNavSectionHeader")).toHaveLength(2)

    // Expand the pages menu
    fireEvent.click(screen.getByTestId("stSidebarNavViewButton"))

    expect(screen.getAllByTestId("stSidebarNavLink")).toHaveLength(14)
    expect(screen.getAllByTestId("stNavSectionHeader")).toHaveLength(3)
    // Collapse the pages menu
    fireEvent.click(screen.getByTestId("stSidebarNavViewButton"))
    expect(screen.getAllByTestId("stSidebarNavLink")).toHaveLength(10)
    expect(screen.getAllByTestId("stNavSectionHeader")).toHaveLength(2)
  })

  it("passes the pageScriptHash to onPageChange if a link is clicked", () => {
    const props = getProps()
    render(<SidebarNav {...props} />)

    const links = screen.getAllByTestId("stSidebarNavLink")
    fireEvent.click(links[1])

    expect(props.onPageChange).toHaveBeenCalledWith("other_page_hash")
    expect(props.collapseSidebar).not.toHaveBeenCalled()
  })

  it("collapses sidebar on page change when on mobile", () => {
    // @ts-expect-error
    reactDeviceDetect.isMobile = true

    const props = getProps()
    render(<SidebarNav {...props} />)

    const links = screen.getAllByTestId("stSidebarNavLink")
    fireEvent.click(links[1])

    expect(props.onPageChange).toHaveBeenCalledWith("other_page_hash")
    expect(props.collapseSidebar).toHaveBeenCalled()
  })

  it("handles default and custom page icons", () => {
    const props = getProps({
      appPages: [
        { pageName: "streamlit_app" },
        { pageName: "my_other_page", icon: "🦈" },
      ],
    })

    render(<SidebarNav {...props} />)

    const links = screen.getAllByTestId("stSidebarNavLink")
    expect(links).toHaveLength(2)
    expect(links[1]).toHaveTextContent("🦈")
  })

  it("indicates the current page as active", () => {
    const props = getProps({ currentPageScriptHash: "other_page_hash" })
    render(<SidebarNav {...props} />)

    const links = screen.getAllByTestId("stSidebarNavLink")
    expect(links).toHaveLength(2)

    // isActive prop used to style background color, so check that
    expect(links[0]).toHaveStyle("background-color: transparent")
    expect(links[1]).toHaveStyle("background-color: rgba(151, 166, 195, 0.25)")
  })
})
