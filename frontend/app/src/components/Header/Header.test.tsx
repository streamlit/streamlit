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

import * as StreamlitContextProviderModule from "@streamlit/app/src/components/StreamlitContextProvider"
import { render } from "@streamlit/lib"

import Header, { HeaderProps } from "./Header"

const getProps = (propOverrides: Partial<HeaderProps> = {}): HeaderProps => ({
  hasSidebar: false,
  isSidebarOpen: false,
  onToggleSidebar: vi.fn(),
  ...propOverrides,
})

// Helper function to create mock app context with overrides
const getMockAppContext = (
  overrides: Partial<
    ReturnType<typeof StreamlitContextProviderModule.useAppContext>
  > = {}
): ReturnType<typeof StreamlitContextProviderModule.useAppContext> => ({
  showToolbar: true,
  widgetsDisabled: false,
  initialSidebarState: 1,
  pageLinkBaseUrl: "",
  currentPageScriptHash: "",
  onPageChange: vi.fn(),
  navSections: [],
  appPages: [],
  appLogo: null,
  sidebarChevronDownshift: 0,
  expandSidebarNav: false,
  hideSidebarNav: false,
  gitInfo: null,
  ...overrides,
})

// Helper function to setup app context mock
const mockAppContext = (
  overrides: Partial<
    ReturnType<typeof StreamlitContextProviderModule.useAppContext>
  > = {}
): void => {
  vi.spyOn(StreamlitContextProviderModule, "useAppContext").mockReturnValue(
    getMockAppContext(overrides)
  )
}

describe("Header", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders a Header without crashing", () => {
    render(<Header {...getProps()} />)

    expect(screen.getByTestId("stHeader")).toBeInTheDocument()
  })

  describe("Toolbar visibility", () => {
    it("renders toolbar when showToolbar is true and rightContent exists", () => {
      mockAppContext({ showToolbar: true })
      render(<Header {...getProps({ rightContent: <div>Right</div> })} />)

      expect(screen.getByTestId("stToolbar")).toBeVisible()
    })

    it("renders toolbar with navigation when showToolbar is false but navigation exists", () => {
      mockAppContext({ showToolbar: false })
      render(<Header {...getProps({ navigation: <div>Nav</div> })} />)

      expect(screen.getByTestId("stToolbar")).toBeInTheDocument()
    })

    it("does not render toolbar when no content exists", () => {
      mockAppContext({ showToolbar: true })
      render(<Header {...getProps()} />)

      expect(screen.queryByTestId("stToolbar")).not.toBeInTheDocument()
    })
  })

  describe("Right content visibility", () => {
    it("does not show right content when showToolbar is false", () => {
      mockAppContext({ showToolbar: false })
      const rightContent = <div data-testid="test-right">Right Content</div>
      render(<Header {...getProps({ rightContent })} />)

      expect(screen.queryByTestId("test-right")).not.toBeInTheDocument()
    })

    it("renders right content in the right section when showToolbar is true", () => {
      mockAppContext({ showToolbar: true })
      const rightContent = <div data-testid="test-right">Right Content</div>
      render(<Header {...getProps({ rightContent })} />)

      expect(screen.getByTestId("test-right")).toBeInTheDocument()
      expect(screen.getByTestId("stToolbar")).toContainElement(
        screen.getByTestId("test-right")
      )
    })
  })

  describe("Background color", () => {
    it.each([
      {
        description:
          "transparent background when header is completely empty to blend seamlessly into page",
        props: {},
        hasTransparentBg: true,
      },
      {
        description:
          "solid background when navigation exists to provide contrast for user interaction",
        props: { navigation: <div>Nav</div> },
        hasTransparentBg: false,
      },
      {
        description:
          "solid background when logo exists (sidebar closed) to ensure brand visibility",
        props: {
          logoComponent: <div data-testid="test-logo">Logo</div>,
          isSidebarOpen: false,
        },
        hasTransparentBg: false,
      },
    ])("renders with $description", ({ props, hasTransparentBg }) => {
      render(<Header {...getProps(props)} />)
      const header = screen.getByTestId("stHeader")

      if (hasTransparentBg) {
        expect(header).toHaveStyle("background-color: rgba(0, 0, 0, 0)")
      } else {
        expect(header).not.toHaveStyle("background-color: rgba(0, 0, 0, 0)")
      }
    })
  })

  describe("Content rendering", () => {
    it("renders navigation content in the toolbar", () => {
      const navigationContent = <div data-testid="test-nav">Navigation</div>
      render(<Header {...getProps({ navigation: navigationContent })} />)

      expect(screen.getByTestId("test-nav")).toBeInTheDocument()
      expect(screen.getByTestId("stToolbar")).toContainElement(
        screen.getByTestId("test-nav")
      )
    })

    it("renders logo in the toolbar when provided", () => {
      const logo = <div data-testid="test-logo">Logo</div>
      render(<Header {...getProps({ logoComponent: logo })} />)

      expect(screen.getByTestId("test-logo")).toBeInTheDocument()
      expect(screen.getByTestId("stToolbar")).toContainElement(
        screen.getByTestId("test-logo")
      )
    })
  })

  describe("Sidebar functionality", () => {
    it.each([
      {
        description:
          "renders sidebar expand button when sidebar exists and is closed",
        hasSidebar: true,
        isSidebarOpen: false,
        shouldRender: true,
      },
      {
        description:
          "does not render sidebar expand button when sidebar doesn't exist",
        hasSidebar: false,
        isSidebarOpen: false,
        shouldRender: false,
      },
      {
        description:
          "does not render sidebar expand button when sidebar is open",
        hasSidebar: true,
        isSidebarOpen: true,
        shouldRender: false,
      },
    ])("$description", ({ hasSidebar, isSidebarOpen, shouldRender }) => {
      render(<Header {...getProps({ hasSidebar, isSidebarOpen })} />)

      const expandButton = screen.queryByTestId("stExpandSidebarButton")
      if (shouldRender) {
        expect(expandButton).toBeInTheDocument()
      } else {
        expect(expandButton).not.toBeInTheDocument()
      }
    })

    it("calls onToggleSidebar when expand button is clicked", () => {
      const onToggleSidebar = vi.fn()
      render(
        <Header
          {...getProps({
            hasSidebar: true,
            isSidebarOpen: false,
            onToggleSidebar,
          })}
        />
      )

      const expandButton = screen.getByTestId("stExpandSidebarButton")
      expandButton.click()

      expect(onToggleSidebar).toHaveBeenCalled()
    })
  })

  describe("Embed mode behavior", () => {
    describe("When embed=true (showToolbar=false)", () => {
      beforeEach(() => {
        mockAppContext({ showToolbar: false })
      })

      it("should show logo when provided and sidebar is closed", () => {
        const logo = <div data-testid="test-logo">Logo</div>
        render(
          <Header
            {...getProps({
              logoComponent: logo,
              hasSidebar: true,
              isSidebarOpen: false,
            })}
          />
        )

        expect(screen.getByTestId("test-logo")).toBeInTheDocument()
        expect(screen.getByTestId("stToolbar")).toBeInTheDocument()
      })

      it("should show sidebar expand button when sidebar exists and is closed", () => {
        render(
          <Header {...getProps({ hasSidebar: true, isSidebarOpen: false })} />
        )

        expect(screen.getByTestId("stExpandSidebarButton")).toBeInTheDocument()
        expect(screen.getByTestId("stToolbar")).toBeInTheDocument()
      })

      it("should show navigation when provided", () => {
        const navigation = <div data-testid="test-nav">Navigation</div>
        render(<Header {...getProps({ navigation })} />)

        expect(screen.getByTestId("test-nav")).toBeInTheDocument()
        expect(screen.getByTestId("stToolbar")).toBeInTheDocument()
      })

      it("should NOT show rightContent (toolbar/app menu) even if provided", () => {
        const rightContent = <div data-testid="test-right">Toolbar</div>
        render(<Header {...getProps({ rightContent })} />)

        expect(screen.queryByTestId("test-right")).not.toBeInTheDocument()
        // But toolbar should still not render because no other content exists
        expect(screen.queryByTestId("stToolbar")).not.toBeInTheDocument()
      })

      it("should show all left-side content together", () => {
        const logo = <div data-testid="test-logo">Logo</div>
        const navigation = <div data-testid="test-nav">Navigation</div>
        const rightContent = <div data-testid="test-right">Toolbar</div>

        render(
          <Header
            {...getProps({
              logoComponent: logo,
              hasSidebar: true,
              isSidebarOpen: false,
              navigation,
              rightContent,
            })}
          />
        )

        expect(screen.getByTestId("stToolbar")).toBeInTheDocument()
        expect(screen.getByTestId("test-logo")).toBeInTheDocument()
        expect(screen.getByTestId("stExpandSidebarButton")).toBeInTheDocument()
        expect(screen.getByTestId("test-nav")).toBeInTheDocument()
        expect(screen.queryByTestId("test-right")).not.toBeInTheDocument()
      })
    })

    describe("When embed=true&embed_options=show_toolbar (showToolbar=true)", () => {
      beforeEach(() => {
        mockAppContext({ showToolbar: true })
      })

      it("should show all content including rightContent", () => {
        const logo = <div data-testid="test-logo">Logo</div>
        const navigation = <div data-testid="test-nav">Navigation</div>
        const rightContent = <div data-testid="test-right">Toolbar</div>

        render(
          <Header
            {...getProps({
              logoComponent: logo,
              hasSidebar: true,
              isSidebarOpen: false,
              navigation,
              rightContent,
            })}
          />
        )

        expect(screen.getByTestId("stToolbar")).toBeInTheDocument()
        expect(screen.getByTestId("test-logo")).toBeInTheDocument()
        expect(screen.getByTestId("stExpandSidebarButton")).toBeInTheDocument()
        expect(screen.getByTestId("test-nav")).toBeInTheDocument()
        expect(screen.getByTestId("test-right")).toBeInTheDocument()
      })
    })

    describe("Background transparency logic", () => {
      const testCases = [
        {
          description:
            "transparent background when header has no content to create seamless page integration",
          props: {},
          expectTransparent: true,
          expectToolbar: false,
        },
        {
          description:
            "solid background when logo is shown to provide brand contrast and readability",
          props: {
            logoComponent: <div data-testid="test-logo">Logo</div>,
            isSidebarOpen: false,
          },
          expectTransparent: false,
          expectToolbar: true,
        },
        {
          description:
            "solid background when sidebar expand button is shown to define clickable area",
          props: { hasSidebar: true, isSidebarOpen: false },
          expectTransparent: false,
          expectToolbar: true,
        },
        {
          description:
            "solid background when navigation is shown to provide clear container for nav elements",
          props: { navigation: <div data-testid="test-nav">Navigation</div> },
          expectTransparent: false,
          expectToolbar: true,
        },
      ]

      it.each(testCases)(
        "should have $description",
        ({ props, expectTransparent, expectToolbar }) => {
          render(<Header {...getProps(props)} />)

          const header = screen.getByTestId("stHeader")
          if (expectTransparent) {
            expect(header).toHaveStyle("background-color: rgba(0, 0, 0, 0)")
          } else {
            expect(header).not.toHaveStyle(
              "background-color: rgba(0, 0, 0, 0)"
            )
          }

          const toolbar = screen.queryByTestId("stToolbar")
          if (expectToolbar) {
            expect(toolbar).toBeInTheDocument()
          } else {
            expect(toolbar).not.toBeInTheDocument()
          }
        }
      )

      it("should have solid background when rightContent is shown (and showToolbar=true)", () => {
        mockAppContext({ showToolbar: true })
        const rightContent = <div data-testid="test-right">Toolbar</div>
        render(<Header {...getProps({ rightContent })} />)

        const header = screen.getByTestId("stHeader")
        expect(header).not.toHaveStyle("background-color: rgba(0, 0, 0, 0)")
        expect(screen.getByTestId("stToolbar")).toBeInTheDocument()
      })
    })

    describe("Edge cases", () => {
      const edgeCases = [
        {
          description: "not show logo when sidebar is open",
          props: {
            logoComponent: <div data-testid="test-logo">Logo</div>,
            hasSidebar: true,
            isSidebarOpen: true,
          },
          expectLogo: false,
          expectToolbar: false,
        },
        {
          description: "not show expand button when sidebar is already open",
          props: { hasSidebar: true, isSidebarOpen: true },
          expectExpandButton: false,
          expectToolbar: false,
        },
        {
          description: "not show expand button when no sidebar exists",
          props: { hasSidebar: false, isSidebarOpen: false },
          expectExpandButton: false,
          expectToolbar: false,
        },
      ]

      it.each(edgeCases)(
        "should $description",
        ({ props, expectLogo, expectExpandButton, expectToolbar }) => {
          render(<Header {...getProps(props)} />)

          if (expectLogo !== undefined) {
            const logo = screen.queryByTestId("test-logo")
            if (expectLogo) {
              expect(logo).toBeInTheDocument()
            } else {
              expect(logo).not.toBeInTheDocument()
            }
          }

          if (expectExpandButton !== undefined) {
            const expandButton = screen.queryByTestId("stExpandSidebarButton")
            if (expectExpandButton) {
              expect(expandButton).toBeInTheDocument()
            } else {
              expect(expandButton).not.toBeInTheDocument()
            }
          }

          const toolbar = screen.queryByTestId("stToolbar")
          if (expectToolbar) {
            expect(toolbar).toBeInTheDocument()
          } else {
            expect(toolbar).not.toBeInTheDocument()
          }
        }
      )
    })
  })
})
