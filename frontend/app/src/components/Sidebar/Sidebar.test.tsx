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

import React, { ReactElement } from "react"

import {
  fireEvent,
  RenderResult,
  screen,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { AppContextProps } from "@streamlit/app/src/components/AppContext"
import * as StreamlitContextProviderModule from "@streamlit/app/src/components/StreamlitContextProvider"
import { mockEndpoints, render } from "@streamlit/lib"
import { Logo, PageConfig } from "@streamlit/protobuf"

import Sidebar, { SidebarProps } from "./Sidebar"

vi.mock("~lib/util/Hooks", async () => ({
  __esModule: true,
  ...(await vi.importActual("~lib/util/Hooks")),
  useIsOverflowing: vi.fn(),
}))

const buildMediaURL = vi.fn((url: string) => url)
const sendClientErrorToHost = vi.fn()
const mockEndpointProp = mockEndpoints({
  buildMediaURL,
  sendClientErrorToHost,
})

function SidebarWrapper(props: Partial<SidebarProps> = {}): ReactElement {
  const context = StreamlitContextProviderModule.useAppContext()
  return (
    <Sidebar
      endpoints={mockEndpointProp}
      hasElements
      // Props from context
      appLogo={context.appLogo}
      appPages={context.appPages}
      navSections={context.navSections}
      onPageChange={context.onPageChange}
      currentPageScriptHash={context.currentPageScriptHash}
      hideSidebarNav={context.hideSidebarNav}
      expandSidebarNav={context.expandSidebarNav}
      // Defaulted props for Sidebar itself
      isCollapsed={false}
      onToggleCollapse={vi.fn()}
      {...props}
    />
  )
}

function renderSidebar(props: Partial<SidebarProps> = {}): RenderResult {
  return render(<SidebarWrapper {...props} />)
}

// Helper function to create mock app context with overrides
function getContextOutput(
  context: Partial<AppContextProps> = {}
): AppContextProps {
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

// Helper function to setup app context mock
function mockAppContext(context: Partial<AppContextProps> = {}): void {
  vi.spyOn(StreamlitContextProviderModule, "useAppContext").mockReturnValue(
    getContextOutput(context)
  )
}

// Test data constants
const LOGO_IMAGE_URL =
  "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png"
const LOGO_ICON_URL = "https://docs.streamlit.io/logo.svg"
const EXAMPLE_LINK = "www.example.com"

const SAMPLE_PAGES = [
  { pageName: "first_page", pageScriptHash: "page_hash" },
  { pageName: "second_page", pageScriptHash: "page_hash2" },
]

const SAMPLE_PAGES_WITH_URLS = [
  {
    pageName: "first page",
    pageScriptHash: "page_hash",
    urlPathname: "first_page",
  },
  {
    pageName: "second page",
    pageScriptHash: "page_hash2",
    urlPathname: "second_page",
  },
]

describe("Sidebar Component", () => {
  beforeEach(() => {
    window.localStorage.clear()
    mockAppContext({})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("should render without crashing", () => {
    renderSidebar({})
    expect(screen.getByTestId("stSidebar")).toBeInTheDocument()
  })

  describe("Collapse/Expand Behavior", () => {
    it.each([
      {
        state: PageConfig.SidebarState.EXPANDED,
        isCollapsed: false,
        expectedAria: "true",
      },
      {
        state: PageConfig.SidebarState.COLLAPSED,
        isCollapsed: true,
        expectedAria: "false",
      },
    ])(
      "should render $state correctly",
      ({ state, isCollapsed, expectedAria }) => {
        mockAppContext({ initialSidebarState: state })
        renderSidebar({ isCollapsed })

        expect(screen.getByTestId("stSidebar")).toHaveAttribute(
          "aria-expanded",
          expectedAria
        )
      }
    )

    it.each([
      {
        initialCollapsed: false,
        expectedToggleValue: true,
        description: "collapse when expanded",
      },
      {
        initialCollapsed: true,
        expectedToggleValue: false,
        description: "expand when collapsed",
      },
    ])(
      "should $description on toggle",
      async ({ initialCollapsed, expectedToggleValue }) => {
        const mockOnToggleCollapse = vi.fn()
        const user = userEvent.setup()

        renderSidebar({
          isCollapsed: initialCollapsed,
          onToggleCollapse: mockOnToggleCollapse,
        })

        // Hover to show collapse button
        await user.hover(screen.getByTestId("stSidebarHeader"))

        // Click the collapse button
        const collapseButton = within(
          screen.getByTestId("stSidebarCollapseButton")
        ).getByRole("button")
        await user.click(collapseButton)

        expect(mockOnToggleCollapse).toHaveBeenCalledWith(expectedToggleValue)
      }
    )
  })

  describe("Collapse Button Visibility", () => {
    it("shows/hides the collapse arrow when hovering over top of sidebar", async () => {
      const user = userEvent.setup()
      mockAppContext({ appPages: SAMPLE_PAGES })
      renderSidebar()

      const collapseButton = screen.getByTestId("stSidebarCollapseButton")

      // Hidden when not hovering
      expect(collapseButton).toHaveStyle("visibility: hidden")

      // Visible when hovering over header
      await user.hover(screen.getByTestId("stSidebarHeader"))
      expect(collapseButton).toHaveStyle("visibility: visible")
    })
  })

  describe("Sidebar Navigation", () => {
    it("renders SidebarNav component when multiple pages exist", () => {
      mockAppContext({ appPages: SAMPLE_PAGES_WITH_URLS })
      renderSidebar()

      expect(screen.getByTestId("stSidebarNav")).toBeInTheDocument()

      const sidebarAppPages = screen.getAllByRole("listitem")
      expect(sidebarAppPages).toHaveLength(2)
      expect(sidebarAppPages[0]).toHaveTextContent("first page")
      expect(sidebarAppPages[1]).toHaveTextContent("second page")
    })

    it("can hide SidebarNav with the hideSidebarNav option", () => {
      mockAppContext({
        hideSidebarNav: true,
        appPages: SAMPLE_PAGES,
      })
      renderSidebar()

      expect(screen.queryByTestId("stSidebarNav")).not.toBeInTheDocument()
    })

    it.each([
      {
        description: "has no top padding if no SidebarNav is displayed",
        appPages: [{ pageName: "streamlit_app", pageScriptHash: "page_hash" }],
        expectedPadding: "0",
      },
      {
        description: "has small padding if the SidebarNav is displayed",
        appPages: SAMPLE_PAGES,
        expectedPadding: "1.5rem",
      },
    ])("$description", ({ appPages, expectedPadding }) => {
      mockAppContext({ appPages })
      renderSidebar()

      expect(screen.getByTestId("stSidebarUserContent")).toHaveStyle(
        `padding-top: ${expectedPadding}`
      )
    })

    it("shows navigation when there is one section with multiple pages", () => {
      const appPagesWithSection = [
        {
          pageName: "page1",
          pageScriptHash: "hash1",
          sectionHeader: "Section 1",
        },
        {
          pageName: "page2",
          pageScriptHash: "hash2",
          sectionHeader: "Section 1",
        },
      ]
      mockAppContext({
        appPages: appPagesWithSection,
        navSections: ["Section 1"],
      })
      renderSidebar()

      expect(screen.getByTestId("stSidebarNav")).toBeInTheDocument()
    })

    it("hides navigation when there is one section with one page", () => {
      const appPagesWithSection = [
        {
          pageName: "page1",
          pageScriptHash: "hash1",
          sectionHeader: "Section 1",
        },
      ]
      mockAppContext({
        appPages: appPagesWithSection,
        navSections: ["Section 1"],
      })
      renderSidebar()

      expect(screen.queryByTestId("stSidebarNav")).not.toBeInTheDocument()
    })
  })

  it("applies scrollbarGutter style to sidebar content", () => {
    renderSidebar({})

    const sidebarContent = screen.getByTestId("stSidebarContent")
    const styles = window.getComputedStyle(sidebarContent)

    expect(styles.scrollbarGutter).toBe("stable both-edges")
  })

  describe("Logo Rendering", () => {
    const testLogos = {
      imageOnly: Logo.create({ image: LOGO_IMAGE_URL }),
      imageWithLink: Logo.create({
        image: LOGO_IMAGE_URL,
        link: EXAMPLE_LINK,
      }),
      fullAppLogo: Logo.create({
        image: LOGO_IMAGE_URL,
        link: EXAMPLE_LINK,
        iconImage: LOGO_ICON_URL,
      }),
      logoWithSize: Logo.create({
        image: LOGO_IMAGE_URL,
        link: EXAMPLE_LINK,
        iconImage: LOGO_ICON_URL,
        size: "small",
      }),
    }

    it("renders spacer if no logo provided", () => {
      renderSidebar()

      const sidebarLogoSpacer = within(
        screen.getByTestId("stSidebar")
      ).getByTestId("stLogoSpacer")
      expect(sidebarLogoSpacer).toBeInTheDocument()
    })

    describe("Logo rendering when collapsed", () => {
      it.each([
        {
          description: "uses iconImage if provided",
          logo: testLogos.fullAppLogo,
          expectedUrl: LOGO_ICON_URL,
        },
        {
          description: "defaults to image if no iconImage",
          logo: testLogos.imageOnly,
          expectedUrl: LOGO_IMAGE_URL,
        },
      ])("$description", ({ logo, expectedUrl }) => {
        mockAppContext({ appLogo: logo })
        const sourceSpy = vi.spyOn(mockEndpointProp, "buildMediaURL")
        renderSidebar({ isCollapsed: true })

        const collapsedLogo = screen.getByTestId("stSidebarLogo")
        expect(collapsedLogo).toBeInTheDocument()
        expect(sourceSpy).toHaveBeenCalledWith(expectedUrl)
      })
    })

    it("renders logo's image param when sidebar expanded", () => {
      mockAppContext({ appLogo: testLogos.fullAppLogo })
      const sourceSpy = vi.spyOn(mockEndpointProp, "buildMediaURL")
      renderSidebar({})

      const sidebarLogoContainer = screen.getByTestId("stSidebarHeader")
      expect(sidebarLogoContainer).toBeInTheDocument()

      const sidebarLogo = within(sidebarLogoContainer).getByTestId(
        "stSidebarLogo"
      )
      expect(sidebarLogo).toBeInTheDocument()
      expect(sourceSpy).toHaveBeenCalledWith(LOGO_IMAGE_URL)
    })

    describe("Logo properties", () => {
      it.each([
        {
          description: "default image has no link & medium size",
          logo: testLogos.imageOnly,
          expectLink: false,
          expectedHeight: "1.5rem",
        },
        {
          description: "image has link if provided",
          logo: testLogos.imageWithLink,
          expectLink: true,
          expectedHeight: "1.5rem",
          expectedHref: EXAMPLE_LINK,
        },
        {
          description: "small size when specified",
          logo: testLogos.logoWithSize,
          expectLink: true,
          expectedHeight: "1.25rem",
          expectedHref: EXAMPLE_LINK,
        },
      ])(
        "renders logo - $description",
        ({ logo, expectLink, expectedHeight, expectedHref }) => {
          mockAppContext({ appLogo: logo })
          renderSidebar()

          const sidebar = screen.getByTestId("stSidebar")
          const sidebarLogo = within(sidebar).getByTestId("stSidebarLogo")

          expect(sidebarLogo).toHaveStyle({ height: expectedHeight })

          if (expectLink) {
            const sidebarLogoLink = within(sidebar).getByTestId("stLogoLink")
            expect(sidebarLogoLink).toHaveAttribute("href", expectedHref)
          } else {
            const sidebarLogoLink = within(sidebar).queryByTestId("stLogoLink")
            expect(sidebarLogoLink).not.toBeInTheDocument()
          }
        }
      )
    })

    it("sends an CLIENT_ERROR message when the logo source fails to load", () => {
      mockAppContext({ appLogo: testLogos.fullAppLogo })
      renderSidebar()

      const sidebarLogo = within(
        screen.getByTestId("stSidebarHeader")
      ).getByTestId("stSidebarLogo")
      expect(sidebarLogo).toBeInTheDocument()

      // Trigger the onerror event for the logo
      fireEvent.error(sidebarLogo)

      expect(sendClientErrorToHost).toHaveBeenCalledWith(
        "Sidebar Logo",
        "Logo source failed to load",
        "onerror triggered",
        LOGO_IMAGE_URL
      )
    })
  })

  describe("Width Persistence", () => {
    beforeEach(() => {
      window.localStorage.clear()
    })

    it("should initialize with default width when no localStorage value exists", () => {
      renderSidebar({})

      const sidebar = screen.getByTestId("stSidebar")
      expect(sidebar).toHaveStyle("width: 256px")
    })

    it("should initialize with saved width when localStorage value exists", () => {
      window.localStorage.setItem("sidebarWidth", "320")

      renderSidebar({})

      const sidebar = screen.getByTestId("stSidebar")
      expect(sidebar).toHaveStyle("width: 320px")
    })
  })
})
