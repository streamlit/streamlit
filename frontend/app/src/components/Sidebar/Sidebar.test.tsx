/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { ReactElement } from "react"

import {
  fireEvent,
  RenderResult,
  screen,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import {
  mockEndpoints,
  NavigationContextProps,
  SidebarConfigContextProps,
} from "@streamlit/lib"
import { renderWithContexts } from "@streamlit/lib/testing"
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

// Wrapper component to access AppContext values
function SidebarWrapper(props: Partial<SidebarProps> = {}): ReactElement {
  return (
    <Sidebar
      endpoints={mockEndpointProp}
      hasElements
      // Defaulted props for Sidebar itself
      isCollapsed={false}
      onToggleCollapse={vi.fn()}
      widgetsDisabled={false}
      {...props}
    />
  )
}

function renderSidebar(
  props: Partial<SidebarProps> = {},
  options?: {
    sidebarConfigContext?: Partial<SidebarConfigContextProps>
    navigationContext?: Partial<NavigationContextProps>
  }
): RenderResult {
  const navigationContextValues = getNavigationContextOutput(
    options?.navigationContext || {}
  )
  const sidebarConfigContextValues = getSidebarConfigContextOutput(
    options?.sidebarConfigContext || {}
  )
  return renderWithContexts(<SidebarWrapper {...props} />, {
    sidebarConfigContext: sidebarConfigContextValues,
    navigationContext: navigationContextValues,
  })
}

function getSidebarConfigContextOutput(
  context: Partial<SidebarConfigContextProps> = {}
): SidebarConfigContextProps {
  return {
    initialSidebarState: PageConfig.SidebarState.AUTO,
    appLogo: null,
    sidebarChevronDownshift: 0,
    expandSidebarNav: false,
    hideSidebarNav: false,
    ...context,
  }
}

// Helper function to create mock navigation context with overrides
function getNavigationContextOutput(
  context: Partial<NavigationContextProps> = {}
): NavigationContextProps {
  return {
    pageLinkBaseUrl: "",
    currentPageScriptHash: "",
    onPageChange: vi.fn(),
    navSections: [],
    appPages: [],
    ...context,
  }
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
  })

  it("should render without crashing", () => {
    renderSidebar()
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
        renderSidebar(
          { isCollapsed },
          { sidebarConfigContext: { initialSidebarState: state } }
        )

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
      renderSidebar({}, { navigationContext: { appPages: SAMPLE_PAGES } })

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
      renderSidebar(
        {},
        { navigationContext: { appPages: SAMPLE_PAGES_WITH_URLS } }
      )

      expect(screen.getByTestId("stSidebarNav")).toBeInTheDocument()

      const sidebarAppPages = screen.getAllByRole("listitem")
      expect(sidebarAppPages).toHaveLength(2)
      expect(sidebarAppPages[0]).toHaveTextContent("first page")
      expect(sidebarAppPages[1]).toHaveTextContent("second page")
    })

    it("can hide SidebarNav with the hideSidebarNav option", () => {
      renderSidebar(
        {},
        {
          sidebarConfigContext: { hideSidebarNav: true },
          navigationContext: { appPages: SAMPLE_PAGES },
        }
      )

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
      renderSidebar({}, { navigationContext: { appPages } })

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
      renderSidebar(
        {},
        {
          navigationContext: {
            appPages: appPagesWithSection,
            navSections: ["Section 1"],
          },
        }
      )

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
      renderSidebar(
        {},
        {
          navigationContext: {
            appPages: appPagesWithSection,
            navSections: ["Section 1"],
          },
        }
      )

      expect(screen.queryByTestId("stSidebarNav")).not.toBeInTheDocument()
    })
  })

  it("applies scrollbarGutter style to sidebar content", () => {
    renderSidebar()

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
        const sourceSpy = vi.spyOn(mockEndpointProp, "buildMediaURL")
        renderSidebar(
          { isCollapsed: true },
          { sidebarConfigContext: { appLogo: logo } }
        )

        const collapsedLogo = screen.getByTestId("stSidebarLogo")
        expect(collapsedLogo).toBeInTheDocument()
        expect(sourceSpy).toHaveBeenCalledWith(expectedUrl)
      })
    })

    it("renders logo's image param when sidebar expanded", () => {
      const sourceSpy = vi.spyOn(mockEndpointProp, "buildMediaURL")
      renderSidebar(
        {},
        { sidebarConfigContext: { appLogo: testLogos.fullAppLogo } }
      )

      const sidebarLogoContainer = screen.getByTestId("stSidebarHeader")
      expect(sidebarLogoContainer).toBeInTheDocument()

      const sidebarLogo = within(sidebarLogoContainer).getByTestId(
        "stSidebarLogo"
      )
      expect(sidebarLogo).toBeInTheDocument()
      expect(sourceSpy).toHaveBeenCalledWith(LOGO_IMAGE_URL)
    })

    describe("Logo properties", () => {
      it("renders logo without link when no link provided", () => {
        renderSidebar(
          {},
          { sidebarConfigContext: { appLogo: testLogos.imageOnly } }
        )

        const sidebar = screen.getByTestId("stSidebar")
        const sidebarLogo = within(sidebar).getByTestId("stSidebarLogo")

        expect(sidebarLogo).toHaveStyle({ height: "1.5rem" })
        expect(
          within(sidebar).queryByTestId("stLogoLink")
        ).not.toBeInTheDocument()
      })

      it.each([
        {
          description: "medium size",
          logo: testLogos.imageWithLink,
          expectedHeight: "1.5rem",
          expectedHref: EXAMPLE_LINK,
        },
        {
          description: "small size when specified",
          logo: testLogos.logoWithSize,
          expectedHeight: "1.25rem",
          expectedHref: EXAMPLE_LINK,
        },
      ])(
        "renders logo with link and $description",
        ({ logo, expectedHeight, expectedHref }) => {
          renderSidebar({}, { sidebarConfigContext: { appLogo: logo } })

          const sidebar = screen.getByTestId("stSidebar")
          const sidebarLogo = within(sidebar).getByTestId("stSidebarLogo")

          expect(sidebarLogo).toHaveStyle({ height: expectedHeight })

          const sidebarLogoLink = within(sidebar).getByTestId("stLogoLink")
          expect(sidebarLogoLink).toHaveAttribute("href", expectedHref)
        }
      )
    })

    it("sends an CLIENT_ERROR message when the logo source fails to load", () => {
      renderSidebar(
        {},
        { sidebarConfigContext: { appLogo: testLogos.fullAppLogo } }
      )

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
      renderSidebar()

      const sidebar = screen.getByTestId("stSidebar")
      expect(sidebar).toHaveStyle("width: 300px")
    })

    it("should initialize with saved width when localStorage value exists", () => {
      window.localStorage.setItem("sidebarWidth", "320")

      renderSidebar()

      const sidebar = screen.getByTestId("stSidebar")
      expect(sidebar).toHaveStyle("width: 320px")
    })
  })

  describe("Width Initialization Logic", () => {
    beforeEach(() => {
      window.localStorage.clear()
    })

    describe("Priority: Cached > Initial > Default", () => {
      it.each([
        {
          description: "uses default when no cached and no initial",
          cached: null,
          initial: undefined,
          expected: "300px",
        },
        {
          description: "uses cached when cached exists",
          cached: "450",
          initial: undefined,
          expected: "450px",
        },
        {
          description: "uses initial when no cached",
          cached: null,
          initial: 400,
          expected: "400px",
        },
        {
          description: "uses cached over initial when both exist",
          cached: "500",
          initial: 350,
          expected: "500px",
        },
      ])("$description", ({ cached, initial, expected }) => {
        if (cached) {
          window.localStorage.setItem("sidebarWidth", cached)
        }

        renderSidebar(
          {},
          {
            sidebarConfigContext: {
              ...(initial !== undefined && { initialSidebarWidth: initial }),
            },
          }
        )

        expect(screen.getByTestId("stSidebar")).toHaveStyle(
          `width: ${expected}`
        )
      })
    })

    describe("Width Clamping", () => {
      it.each([
        { initial: 150, expected: "200px", description: "clamps to minimum" },
        { initial: 800, expected: "600px", description: "clamps to maximum" },
        { initial: 400, expected: "400px", description: "uses value as-is" },
        { initial: NaN, expected: "300px", description: "handles NaN" },
      ])("$description", ({ initial, expected }) => {
        renderSidebar(
          {},
          { sidebarConfigContext: { initialSidebarWidth: initial } }
        )

        expect(screen.getByTestId("stSidebar")).toHaveStyle(
          `width: ${expected}`
        )
      })
    })

    describe("Cached Width Clamping", () => {
      it.each([
        {
          cached: "1000",
          expected: "600px",
          description: "clamps cached value exceeding maximum",
        },
        {
          cached: "100",
          expected: "200px",
          description: "clamps cached value below minimum",
        },
        {
          cached: "450",
          expected: "450px",
          description: "uses cached value within valid range",
        },
        {
          cached: "200",
          expected: "200px",
          description: "uses cached value at minimum boundary",
        },
        {
          cached: "600",
          expected: "600px",
          description: "uses cached value at maximum boundary",
        },
        {
          cached: "invalid",
          expected: "300px",
          description: "falls back to default when cached value is invalid",
        },
      ])("$description", ({ cached, expected }) => {
        window.localStorage.setItem("sidebarWidth", cached)

        renderSidebar()

        expect(screen.getByTestId("stSidebar")).toHaveStyle(
          `width: ${expected}`
        )
      })
    })
  })
})
