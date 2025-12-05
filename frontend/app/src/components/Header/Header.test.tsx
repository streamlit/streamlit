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

import { render } from "@streamlit/lib/testing"

import Header, { HeaderProps } from "./Header"

const getProps = (propOverrides: Partial<HeaderProps> = {}): HeaderProps => ({
  hasSidebar: false,
  isSidebarOpen: false,
  onToggleSidebar: vi.fn(),
  showToolbar: true,
  ...propOverrides,
})

describe("Header", () => {
  it("renders a Header without crashing", () => {
    render(<Header {...getProps()} />)

    expect(screen.getByTestId("stHeader")).toBeInTheDocument()
  })

  describe("Toolbar visibility", () => {
    it("renders toolbar when showToolbar is true and rightContent exists", () => {
      render(
        <Header
          {...getProps({ showToolbar: true, rightContent: <div>Right</div> })}
        />
      )

      expect(screen.getByTestId("stToolbar")).toBeVisible()
    })

    it("renders toolbar with navigation when showToolbar is false but navigation exists", () => {
      render(
        <Header
          {...getProps({ showToolbar: false, navigation: <div>Nav</div> })}
        />
      )

      expect(screen.getByTestId("stToolbar")).toBeInTheDocument()
    })

    it("does not render toolbar when no content exists", () => {
      render(<Header {...getProps({ showToolbar: true })} />)

      expect(screen.queryByTestId("stToolbar")).not.toBeInTheDocument()
    })
  })

  describe("Right content visibility", () => {
    it("does not show right content when showToolbar is false", () => {
      const rightContent = <div data-testid="test-right">Right Content</div>
      render(<Header {...getProps({ showToolbar: false, rightContent })} />)

      expect(screen.queryByTestId("test-right")).not.toBeInTheDocument()
    })

    it("renders right content in the right section when showToolbar is true", () => {
      const rightContent = <div data-testid="test-right">Right Content</div>
      render(<Header {...getProps({ showToolbar: true, rightContent })} />)

      expect(screen.getByTestId("test-right")).toBeInTheDocument()
      expect(screen.getByTestId("stToolbar")).toContainElement(
        screen.getByTestId("test-right")
      )
    })
  })

  describe("Background color", () => {
    it("renders with transparent background when header is completely empty", () => {
      render(<Header {...getProps({})} />)
      const header = screen.getByTestId("stHeader")
      expect(header).toHaveStyle("background-color: rgba(0, 0, 0, 0)")
    })

    it.each([
      {
        description: "navigation exists",
        props: { navigation: <div>Nav</div> },
      },
      {
        description: "logo exists (sidebar closed)",
        props: {
          logoComponent: <div data-testid="test-logo">Logo</div>,
          isSidebarOpen: false,
        },
      },
    ])("renders with solid background when $description", ({ props }) => {
      render(<Header {...getProps(props)} />)
      const header = screen.getByTestId("stHeader")
      expect(header).not.toHaveStyle("background-color: rgba(0, 0, 0, 0)")
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
    it("renders sidebar expand button when sidebar exists and is closed", () => {
      render(
        <Header {...getProps({ hasSidebar: true, isSidebarOpen: false })} />
      )
      expect(screen.queryByTestId("stExpandSidebarButton")).toBeInTheDocument()
    })

    it.each([
      {
        description: "sidebar doesn't exist",
        hasSidebar: false,
        isSidebarOpen: false,
      },
      {
        description: "sidebar is open",
        hasSidebar: true,
        isSidebarOpen: true,
      },
    ])(
      "does not render sidebar expand button when $description",
      ({ hasSidebar, isSidebarOpen }) => {
        render(<Header {...getProps({ hasSidebar, isSidebarOpen })} />)
        expect(
          screen.queryByTestId("stExpandSidebarButton")
        ).not.toBeInTheDocument()
      }
    )

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
      it("should show logo when provided and sidebar is closed", () => {
        const logo = <div data-testid="test-logo">Logo</div>
        render(
          <Header
            {...getProps({
              showToolbar: false,
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
          <Header
            {...getProps({
              showToolbar: false,
              hasSidebar: true,
              isSidebarOpen: false,
            })}
          />
        )

        expect(screen.getByTestId("stExpandSidebarButton")).toBeInTheDocument()
        expect(screen.getByTestId("stToolbar")).toBeInTheDocument()
      })

      it("should show navigation when provided", () => {
        const navigation = <div data-testid="test-nav">Navigation</div>
        render(<Header {...getProps({ showToolbar: false, navigation })} />)

        expect(screen.getByTestId("test-nav")).toBeInTheDocument()
        expect(screen.getByTestId("stToolbar")).toBeInTheDocument()
      })

      it("should NOT show rightContent (toolbar/app menu) even if provided", () => {
        const rightContent = <div data-testid="test-right">Toolbar</div>
        render(<Header {...getProps({ showToolbar: false, rightContent })} />)

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
              showToolbar: false,
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
      it("should show all content including rightContent", () => {
        const logo = <div data-testid="test-logo">Logo</div>
        const navigation = <div data-testid="test-nav">Navigation</div>
        const rightContent = <div data-testid="test-right">Toolbar</div>

        render(
          <Header
            {...getProps({
              showToolbar: true,
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
      it("should have transparent background and no toolbar when header has no content", () => {
        render(<Header {...getProps({})} />)

        const header = screen.getByTestId("stHeader")
        expect(header).toHaveStyle("background-color: rgba(0, 0, 0, 0)")
        expect(screen.queryByTestId("stToolbar")).not.toBeInTheDocument()
      })

      it.each([
        {
          description: "logo is shown",
          props: {
            logoComponent: <div data-testid="test-logo">Logo</div>,
            isSidebarOpen: false,
          },
        },
        {
          description: "sidebar expand button is shown",
          props: { hasSidebar: true, isSidebarOpen: false },
        },
        {
          description: "navigation is shown",
          props: { navigation: <div data-testid="test-nav">Navigation</div> },
        },
        {
          description: "rightContent is shown (and showToolbar=true)",
          props: {
            showToolbar: true,
            rightContent: <div data-testid="test-right">Toolbar</div>,
          },
        },
      ])(
        "should have solid background and toolbar when $description",
        ({ props }) => {
          render(<Header {...getProps(props)} />)

          const header = screen.getByTestId("stHeader")
          expect(header).not.toHaveStyle("background-color: rgba(0, 0, 0, 0)")
          expect(screen.getByTestId("stToolbar")).toBeInTheDocument()
        }
      )
    })

    describe("Edge cases", () => {
      it("should not show logo or toolbar when sidebar is open", () => {
        render(
          <Header
            {...getProps({
              logoComponent: <div data-testid="test-logo">Logo</div>,
              hasSidebar: true,
              isSidebarOpen: true,
            })}
          />
        )

        expect(screen.queryByTestId("test-logo")).not.toBeInTheDocument()
        expect(screen.queryByTestId("stToolbar")).not.toBeInTheDocument()
      })

      it.each([
        {
          description: "sidebar is already open",
          props: { hasSidebar: true, isSidebarOpen: true },
        },
        {
          description: "no sidebar exists",
          props: { hasSidebar: false, isSidebarOpen: false },
        },
      ])(
        "should not show expand button or toolbar when $description",
        ({ props }) => {
          render(<Header {...getProps(props)} />)

          expect(
            screen.queryByTestId("stExpandSidebarButton")
          ).not.toBeInTheDocument()
          expect(screen.queryByTestId("stToolbar")).not.toBeInTheDocument()
        }
      )
    })
  })
})
