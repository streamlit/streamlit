/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { screen } from "@testing-library/react"

import * as isMobile from "@streamlit/lib"
import { mockEndpoints, render } from "@streamlit/lib"
import { IAppPage, PageConfig } from "@streamlit/protobuf"
import { AppContextProps } from "@streamlit/app/src/components/AppContext"
import * as StreamlitContextProviderModule from "@streamlit/app/src/components/StreamlitContextProvider"

import SidebarNav, { Props } from "./SidebarNav"

vi.mock("~lib/util/Hooks", async () => ({
  __esModule: true,
  ...(await vi.importActual("~lib/util/Hooks")),
  useIsOverflowing: vi.fn(),
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
  collapseSidebar: vi.fn(),
  hasSidebarElements: false,
  endpoints: mockEndpoints(),
  onPageChange: vi.fn(),
  navSections: [],
  currentPageScriptHash: "",
  expandSidebarNav: false,
  ...props,
})

function getContextOutput(context: Partial<AppContextProps>): AppContextProps {
  return {
    initialSidebarState: PageConfig.SidebarState.AUTO,
    pageLinkBaseUrl: "",
    currentPageScriptHash: "",
    onPageChange: vi.fn(),
    navSections: [],
    appPages: [],
    appLogo: null,
    sidebarChevronDownshift: 0,
    expandSidebarNav: false,
    hideSidebarNav: false,
    widgetsDisabled: false,
    gitInfo: null,
    showToolbar: true,
    showColoredLine: true,
    ...context,
  }
}

describe("SidebarNav", () => {
  beforeEach(() => {
    vi.spyOn(StreamlitContextProviderModule, "useAppContext").mockReturnValue(
      getContextOutput({})
    )

    vi.spyOn(isMobile, "isMobile").mockReturnValue(false)
  })

  afterEach(() => {
    window.localStorage.clear()
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
      Object.defineProperty(window, "location", {
        value: { ...originalLocation },
        writable: true,
        configurable: true,
      })
    })

    afterEach(() => {
      Object.defineProperty(window, "location", {
        value: originalLocation,
        writable: true,
        configurable: true,
      })
    })

    it("are added to each link", () => {
      const buildAppPageURL = vi
        .fn()
        .mockImplementation((_pageLinkBaseURL: string, page: IAppPage) => {
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
})
