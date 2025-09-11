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
import { userEvent } from "@testing-library/user-event"

import { AppContextProps } from "@streamlit/app/src/components/AppContext"
import * as StreamlitContextProviderModule from "@streamlit/app/src/components/StreamlitContextProvider"
import * as isMobile from "@streamlit/lib"
import { mockEndpoints, render } from "@streamlit/lib"
import { IAppPage, PageConfig } from "@streamlit/protobuf"

import SidebarNav, { Props } from "./SidebarNav"

vi.mock("~lib/util/Hooks", async () => ({
  __esModule: true,
  ...(await vi.importActual("~lib/util/Hooks")),
  useIsOverflowing: vi.fn(),
}))

/**
 * Generates the main/default page for testing purposes
 */
const generateMainPage = (sectionHeaders?: string[]): IAppPage => ({
  pageScriptHash: "main_page_hash",
  pageName: "streamlit app",
  urlPathname: "streamlit_app",
  isDefault: true,
  ...(sectionHeaders && { sectionHeader: sectionHeaders[0] }),
})

/**
 * Generates the naming suffix for additional pages.
 * Maintains backward compatibility by omitting suffix for the first page when totalPages === 2
 */
const generatePageSuffix = (pageIndex: number, totalPages: number): string => {
  return pageIndex === 0 && totalPages === 2 ? "" : pageIndex.toString()
}

/**
 * Generates a section header for a page based on the provided headers array
 */
const generateSectionHeader = (
  pageIndex: number,
  sectionHeaders: string[]
): string => {
  return sectionHeaders[(pageIndex + 1) % sectionHeaders.length]
}

/**
 * Generates an additional page for testing purposes
 */
const generateAdditionalPage = (
  pageIndex: number,
  totalPages: number,
  options: {
    sectionHeaders?: string[]
    icons?: boolean
  }
): IAppPage => {
  const { sectionHeaders, icons } = options
  const suffix = generatePageSuffix(pageIndex, totalPages)

  return {
    pageScriptHash: `other_page_hash${suffix}`,
    pageName: `my other page${suffix}`,
    urlPathname: `my_other_page${suffix}`,
    isDefault: false,
    ...(sectionHeaders && {
      sectionHeader: generateSectionHeader(pageIndex, sectionHeaders),
    }),
    ...(icons && pageIndex === 0 ? { icon: "🐧" } : {}),
  }
}

/**
 * Generates a collection of app pages for testing purposes
 * @param totalPages - Total number of pages to generate (minimum 1)
 * @param options - Configuration options for page generation
 * @param options.sectionHeaders - Array of section headers to cycle through
 * @param options.icons - Whether to add icons to the first additional page
 */
const generateAppPages = (
  totalPages: number,
  options: {
    sectionHeaders?: string[]
    icons?: boolean
  } = {}
): IAppPage[] => {
  const { sectionHeaders } = options
  const pages: IAppPage[] = [generateMainPage(sectionHeaders)]

  // Generate additional pages (totalPages - 1)
  for (let i = 0; i < totalPages - 1; i++) {
    pages.push(generateAdditionalPage(i, totalPages, options))
  }

  return pages
}

/**
 * Generates a collection of app pages for testing purposes based on section counts.
 */
const createAppPagesForSections = (sectionPageCounts: {
  [key: string]: number
}): IAppPage[] => {
  const pages: IAppPage[] = []
  let pageIndex = 0
  Object.entries(sectionPageCounts).forEach(([sectionHeader, count]) => {
    for (let i = 0; i < count; i++) {
      const pageName = `${sectionHeader} page ${i + 1}`
      pages.push({
        pageScriptHash: `hash_${pageName.replace(/ /g, "_")}`,
        pageName: pageName,
        urlPathname: pageName.replace(/ /g, "_"),
        sectionHeader: sectionHeader,
        isDefault: pageIndex === 0,
      })
      pageIndex++
    }
  })
  return pages
}

const getProps = (props: Partial<Props> = {}): Props => ({
  appPages: generateAppPages(2),
  collapseSidebar: vi.fn(),
  hasSidebarElements: false,
  endpoints: mockEndpoints(),
  onPageChange: vi.fn(),
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
        value: originalLocation,
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
          appPages: generateAppPages(13),
        })}
      />
    )

    expect(screen.getByTestId("stSidebarNavSeparator")).toBeInTheDocument()
    expect(screen.getByTestId("stSidebarNavViewButton")).toHaveTextContent(
      "View 3 more"
    )
  })

  it("does not render View less button when explicitly asked to expand", () => {
    render(
      <SidebarNav
        {...getProps({
          hasSidebarElements: true,
          expandSidebarNav: true,
          appPages: generateAppPages(13),
        })}
      />
    )

    expect(screen.getByTestId("stSidebarNavSeparator")).toBeInTheDocument()
    expect(
      screen.queryByTestId("stSidebarNavViewButton")
    ).not.toBeInTheDocument()
  })

  it("renders View more button when there are more than 13 elements", () => {
    render(
      <SidebarNav
        {...getProps({
          hasSidebarElements: true,
          appPages: generateAppPages(14),
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
          appPages: generateAppPages(12),
        })}
      />
    )

    expect(
      screen.queryByTestId("stSidebarNavViewButton")
    ).not.toBeInTheDocument()
    expect(screen.getAllByTestId("stSidebarNavLink")).toHaveLength(12)
  })

  it("renders View less button when expanded", async () => {
    const user = userEvent.setup()
    render(
      <SidebarNav
        {...getProps({
          hasSidebarElements: true,
          appPages: generateAppPages(14),
        })}
      />
    )

    // Click on the separator to expand the nav component.
    await user.click(screen.getByTestId("stSidebarNavViewButton"))

    const viewLessButton = await screen.findByText("View less")
    expect(viewLessButton).toBeInTheDocument()
  })

  it("renders View less button when user prefers expansion", () => {
    window.localStorage.setItem("sidebarNavState", "expanded")

    render(
      <SidebarNav
        {...getProps({
          hasSidebarElements: true,
          appPages: generateAppPages(14),
        })}
      />
    )

    const viewLessButton = screen.getByText("View less")
    expect(viewLessButton).toBeInTheDocument()
    const navLinks = screen.getAllByTestId("stSidebarNavLink")
    expect(navLinks).toHaveLength(14)
  })

  it("is unexpanded by default, displaying 10 links when > 12 pages", () => {
    render(
      <SidebarNav
        {...getProps({
          hasSidebarElements: true,
          appPages: generateAppPages(14),
        })}
      />
    )

    const navLinks = screen.getAllByTestId("stSidebarNavLink")
    expect(navLinks).toHaveLength(10)
  })

  it("toggles to expanded and back when the View more/less buttons are clicked", async () => {
    const user = userEvent.setup()
    render(
      <SidebarNav
        {...getProps({
          hasSidebarElements: true,
          appPages: generateAppPages(14),
        })}
      />
    )

    expect(screen.getByTestId("stSidebarNavSeparator")).toBeInTheDocument()
    expect(screen.getAllByTestId("stSidebarNavLink")).toHaveLength(10)
    // Expand the pages menu
    await user.click(screen.getByTestId("stSidebarNavViewButton"))

    expect(screen.getAllByTestId("stSidebarNavLink")).toHaveLength(14)
    // Collapse the pages menu
    await user.click(screen.getByTestId("stSidebarNavViewButton"))
    expect(screen.getAllByTestId("stSidebarNavLink")).toHaveLength(10)
  })

  it("displays partial sections", async () => {
    const user = userEvent.setup()
    render(
      <SidebarNav
        {...getProps({
          hasSidebarElements: true,
          appPages: generateAppPages(14, {
            sectionHeaders: ["section 1", "section 2"],
          }),
        })}
      />
    )

    expect(screen.getByTestId("stSidebarNavSeparator")).toBeInTheDocument()
    // 10 links are visible, 7 from section 1 and 3 from section 2
    expect(screen.getAllByTestId("stSidebarNavLink")).toHaveLength(10)
    expect(screen.getAllByTestId("stNavSectionHeader")).toHaveLength(2)

    // Collapse the first section
    const section1Header = screen.getAllByTestId("stNavSectionHeader")[0]
    await user.click(section1Header)

    // Now all 7 links from section 2 should be visible
    expect(screen.getAllByTestId("stSidebarNavLink")).toHaveLength(7)

    // Expand the first section again
    await user.click(section1Header)
    expect(screen.getAllByTestId("stSidebarNavLink")).toHaveLength(10)

    // Expand the pages menu
    await user.click(screen.getByTestId("stSidebarNavViewButton"))

    expect(screen.getAllByTestId("stSidebarNavLink")).toHaveLength(14)
    expect(screen.getAllByTestId("stNavSectionHeader")).toHaveLength(2)

    // Collapse the pages menu
    await user.click(screen.getByTestId("stSidebarNavViewButton"))
    expect(screen.getAllByTestId("stSidebarNavLink")).toHaveLength(10)
    expect(screen.getAllByTestId("stNavSectionHeader")).toHaveLength(2)
  })

  it("restores section expansion state from localStorage", () => {
    const pageLinkBaseUrl = "test_app"
    vi.spyOn(StreamlitContextProviderModule, "useAppContext").mockReturnValue(
      getContextOutput({ pageLinkBaseUrl })
    )
    window.localStorage.setItem(
      `stSidebarSectionsState-${pageLinkBaseUrl}`,
      JSON.stringify({ "section 1": false, "section 2": true })
    )

    render(
      <SidebarNav
        {...getProps({
          hasSidebarElements: true,
          appPages: generateAppPages(14, {
            sectionHeaders: ["section 1", "section 2"],
          }),
        })}
      />
    )

    // Section 1 should be collapsed, so only pages from section 2 are visible
    // There are 7 pages in section 2
    expect(screen.getAllByTestId("stSidebarNavLink")).toHaveLength(7)
  })

  it("handles view more/less button visibility based on expanded sections", async () => {
    const user = userEvent.setup()

    const sectionPageCounts = {
      "Section 1": 10,
      "Section 2": 5,
      "Section 3": 5,
    }
    const appPages = createAppPagesForSections(sectionPageCounts)
    const navSections = Object.keys(sectionPageCounts)

    vi.spyOn(StreamlitContextProviderModule, "useAppContext").mockReturnValue(
      getContextOutput({ navSections })
    )

    render(
      <SidebarNav
        {...getProps({
          hasSidebarElements: true,
          appPages,
        })}
      />
    )

    // Initially, all sections are expanded, 20 pages total.
    // The view should be collapsed with a "View more" button.
    const viewButton = screen.getByTestId("stSidebarNavViewButton")
    expect(viewButton).toHaveTextContent("View 10 more") // 20 total - 10 shown
    expect(screen.getAllByTestId("stSidebarNavLink")).toHaveLength(10)

    const section1Header = screen.getByText("Section 1").closest("header")

    if (!section1Header) {
      throw new Error("Section 1 header not found")
    }

    // Collapse Section 1 (10 pages)
    await user.click(section1Header)

    // Now only 10 pages are "visible" in expanded sections (S2 + S3).
    // This is below the threshold of 12, so the view more button should disappear.
    expect(
      screen.queryByTestId("stSidebarNavViewButton")
    ).not.toBeInTheDocument()
    // And all 10 pages from S2 and S3 should be visible.
    expect(screen.getAllByTestId("stSidebarNavLink")).toHaveLength(10)

    // Expand Section 1 again
    await user.click(section1Header)

    // Back to 20 visible pages, so "View more" re-appears.
    const newViewButton = screen.getByTestId("stSidebarNavViewButton")
    expect(newViewButton).toHaveTextContent("View 10 more")
    expect(screen.getAllByTestId("stSidebarNavLink")).toHaveLength(10)
  })

  it("will not display a section if no pages in it are visible", async () => {
    const user = userEvent.setup()
    // First section has 5 pages, second section has 5 pages, third section has 4 pages
    // Since 5+5 = 10, only the first two sections should be visible
    render(
      <SidebarNav
        {...getProps({
          hasSidebarElements: true,
          appPages: generateAppPages(14, {
            sectionHeaders: ["section 1", "section 2", "section 3"],
          }),
        })}
      />
    )

    expect(screen.getByTestId("stSidebarNavSeparator")).toBeInTheDocument()
    expect(screen.getAllByTestId("stSidebarNavLink")).toHaveLength(10)
    expect(screen.getAllByTestId("stNavSectionHeader")).toHaveLength(2)

    // Expand the pages menu
    await user.click(screen.getByTestId("stSidebarNavViewButton"))

    expect(screen.getAllByTestId("stSidebarNavLink")).toHaveLength(14)
    expect(screen.getAllByTestId("stNavSectionHeader")).toHaveLength(3)
    // Collapse the pages menu
    await user.click(screen.getByTestId("stSidebarNavViewButton"))
    expect(screen.getAllByTestId("stSidebarNavLink")).toHaveLength(10)
    expect(screen.getAllByTestId("stNavSectionHeader")).toHaveLength(2)
  })

  it("passes the pageScriptHash to onPageChange if a link is clicked", async () => {
    const onPageChange = vi.fn()
    const user = userEvent.setup()
    const props = getProps({ onPageChange })
    render(<SidebarNav {...props} />)

    const links = screen.getAllByTestId("stSidebarNavLink")
    await user.click(links[1])

    // Check the onPageChange func from props is called with the correct pageScriptHash
    expect(onPageChange).toHaveBeenCalledWith("other_page_hash")
    expect(props.collapseSidebar).not.toHaveBeenCalled()
  })

  it("collapses sidebar on page change when on mobile", async () => {
    const onPageChange = vi.fn()
    const user = userEvent.setup()
    vi.spyOn(isMobile, "isMobile").mockReturnValue(true)

    const props = getProps({ onPageChange })
    render(<SidebarNav {...props} />)

    const links = screen.getAllByTestId("stSidebarNavLink")
    await user.click(links[1])

    // Check the onPageChange func from props is called with the correct pageScriptHash
    expect(onPageChange).toHaveBeenCalledWith("other_page_hash")
    expect(props.collapseSidebar).toHaveBeenCalled()
  })

  it("handles default and custom page icons", () => {
    const props = getProps({
      appPages: generateAppPages(2, { icons: true }),
    })

    render(<SidebarNav {...props} />)

    const links = screen.getAllByTestId("stSidebarNavLink")
    expect(links).toHaveLength(2)
    expect(links[1]).toHaveTextContent("🐧")
  })

  it("indicates the current page as active", () => {
    const appPages = generateAppPages(2)
    const props = getProps({
      appPages,
      currentPageScriptHash: appPages[1].pageScriptHash as string,
    })
    render(<SidebarNav {...props} />)

    const links = screen.getAllByTestId("stSidebarNavLink")
    expect(links).toHaveLength(2)

    // isActive prop used to style background color, so check that
    expect(links[0]).toHaveStyle("background-color: rgba(0, 0, 0, 0)")
    expect(links[1]).toHaveStyle("background-color: rgba(151, 166, 195, 0.25)")
  })
})
