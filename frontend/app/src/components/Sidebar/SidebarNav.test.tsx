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

import {
  useIsOverflowing,
  mockEndpoints,
  IAppPage,
  render,
} from "@streamlit/lib"

import SidebarNav, { Props } from "./SidebarNav"

jest.mock("@streamlit/lib/src/util/Hooks", () => ({
  __esModule: true,
  ...jest.requireActual("@streamlit/lib/src/util/Hooks"),
  useIsOverflowing: jest.fn(),
}))

const mockUseIsOverflowing = useIsOverflowing as jest.MockedFunction<
  typeof useIsOverflowing
>

const getProps = (props: Partial<Props> = {}): Props => ({
  appPages: [
    {
      pageScriptHash: "main_page_hash",
      pageName: "streamlit_app",
      isDefault: true,
    },
    { pageScriptHash: "other_page_hash", pageName: "my_other_page" },
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
    mockUseIsOverflowing.mockReset()

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
          return `http://mock/app/page/${page.pageName}`
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

  it("does not render an icon when not expanded and not overflowing", () => {
    render(<SidebarNav {...getProps({ hasSidebarElements: true })} />)

    const separator = screen.getByTestId("stSidebarNavSeparator")
    expect(separator).toBeInTheDocument()

    const viewButton = screen.queryByTestId("stSidebarNavViewButton")

    expect(viewButton).not.toBeInTheDocument()
  })

  it("renders View more button when not expanded and overflowing", () => {
    mockUseIsOverflowing.mockReturnValueOnce(true)
    render(<SidebarNav {...getProps({ hasSidebarElements: true })} />)

    expect(screen.getByTestId("stSidebarNavSeparator")).toBeInTheDocument()
    expect(screen.queryByTestId("stSidebarNavViewButton")).toHaveTextContent(
      "View more"
    )
  })

  it("renders View less button when expanded and not overflowing", async () => {
    // We need to have useIsOverflowing return true once so the view more button renders.
    // After this click, it returns false.
    mockUseIsOverflowing.mockReturnValueOnce(true)
    render(<SidebarNav {...getProps({ hasSidebarElements: true })} />)

    // Click on the separator to expand the nav component.
    fireEvent.click(screen.getByTestId("stSidebarNavViewButton"))

    const viewLessButton = await screen.findByText("View less")
    expect(viewLessButton).toBeInTheDocument()
  })

  it("renders View less button when expanded and overflowing", async () => {
    // Have useIsOverflowing return true both before and after the nav is
    // expanded.
    mockUseIsOverflowing.mockReturnValueOnce(true).mockReturnValueOnce(true)
    render(<SidebarNav {...getProps({ hasSidebarElements: true })} />)

    // Click on the View more button to expand the nav component.
    fireEvent.click(screen.getByTestId("stSidebarNavViewButton"))

    const viewLessButton = await screen.findByText("View less")
    expect(viewLessButton).toBeInTheDocument()
  })

  it("is unexpanded by default", () => {
    render(<SidebarNav {...getProps({ hasSidebarElements: true })} />)

    const sidebarNavItems = screen.getByTestId("stSidebarNavItems")
    expect(sidebarNavItems).toBeInTheDocument()
    expect(sidebarNavItems).toHaveStyle("max-height: 30vh")
  })

  it("does not expand when you click on the separator if there is no overflow", async () => {
    render(<SidebarNav {...getProps({ hasSidebarElements: true })} />)
    const separator = screen.getByTestId("stSidebarNavSeparator")
    expect(separator).toBeInTheDocument()
    fireEvent.click(separator)

    const sidebarNavItems = await screen.findByTestId("stSidebarNavItems")
    expect(sidebarNavItems).toBeInTheDocument()
    expect(sidebarNavItems).toHaveStyle("max-height: 30vh")
  })

  it("toggles to expanded and back when the View more/less buttons are clicked", async () => {
    mockUseIsOverflowing.mockReturnValueOnce(true)

    render(<SidebarNav {...getProps({ hasSidebarElements: true })} />)

    expect(screen.getByTestId("stSidebarNavSeparator")).toBeInTheDocument()
    // Expand the pages menu
    fireEvent.click(screen.getByTestId("stSidebarNavViewButton"))

    const sidebarNavItems = await screen.findByTestId("stSidebarNavItems")
    expect(sidebarNavItems).toBeInTheDocument()
    expect(sidebarNavItems).toHaveStyle("max-height: none")

    fireEvent.click(screen.getByTestId("stSidebarNavViewButton"))

    const sidebarNavItemsUpdate = await screen.findByTestId(
      "stSidebarNavItems"
    )
    expect(sidebarNavItemsUpdate).toHaveStyle("max-height: 30vh")
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
    expect(links[1]).toHaveStyle("background-color: rgba(151, 166, 195, 0.15)")
  })

  it("changes the text color when the page is active", () => {
    const props = getProps({ currentPageScriptHash: "other_page_hash" })
    render(<SidebarNav {...props} />)

    expect(screen.getByText("my other page")).toHaveStyle("color: #262730")
  })
})
