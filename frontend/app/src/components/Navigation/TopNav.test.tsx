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

import { screen } from "@testing-library/react"

import { mockEndpoints, NavigationContextProps } from "@streamlit/lib"
import { renderWithContexts } from "@streamlit/lib/testing"
import { IAppPage } from "@streamlit/protobuf"

import TopNav, { Props } from "./TopNav"

// Mock rc-overflow to render all items without responsive behavior
vi.mock("rc-overflow", () => ({
  default: ({
    data,
    renderItem,
    itemKey,
  }: {
    data: unknown[]
    renderItem: (item: unknown, info: unknown) => React.ReactNode
    itemKey: (item: unknown) => string
  }) => (
    <div data-testid="mock-overflow">
      {data.map(item => (
        <div key={itemKey(item)}>{renderItem(item, {})}</div>
      ))}
    </div>
  ),
}))

const getProps = (props: Partial<Props> = {}): Props => ({
  endpoints: mockEndpoints(),
  widgetsDisabled: false,
  ...props,
})

function getNavigationContextOutput(
  context: Partial<NavigationContextProps>
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

function renderTopNav(
  props: Partial<Props> = {},
  overrides?: {
    navigationContext?: Partial<NavigationContextProps>
  }
): ReturnType<typeof renderWithContexts> {
  const navigationContextValues = getNavigationContextOutput(
    overrides?.navigationContext || {}
  )

  return renderWithContexts(<TopNav {...getProps(props)} />, {
    navigationContext: navigationContextValues,
  })
}

describe("TopNav", () => {
  describe("hidden pages", () => {
    it("does not render hidden pages in the navigation", () => {
      const appPages: IAppPage[] = [
        {
          pageScriptHash: "visible_hash_1",
          pageName: "visible page 1",
          urlPathname: "visible_page_1",
          isDefault: true,
          isHidden: false,
        },
        {
          pageScriptHash: "hidden_hash",
          pageName: "hidden page",
          urlPathname: "hidden_page",
          isDefault: false,
          isHidden: true,
        },
        {
          pageScriptHash: "visible_hash_2",
          pageName: "visible page 2",
          urlPathname: "visible_page_2",
          isDefault: false,
          isHidden: false,
        },
      ]

      renderTopNav(
        {},
        {
          navigationContext: { appPages },
        }
      )

      const links = screen.getAllByTestId("stTopNavLink")
      expect(links).toHaveLength(2)
      expect(screen.getByText("visible page 1")).toBeVisible()
      expect(screen.getByText("visible page 2")).toBeVisible()
      expect(screen.queryByText("hidden page")).not.toBeInTheDocument()
    })

    it("does not render hidden pages in sections", () => {
      const appPages: IAppPage[] = [
        {
          pageScriptHash: "visible_hash_1",
          pageName: "visible page 1",
          urlPathname: "visible_page_1",
          isDefault: true,
          sectionHeader: "Section 1",
          isHidden: false,
        },
        {
          pageScriptHash: "hidden_hash",
          pageName: "hidden page",
          urlPathname: "hidden_page",
          isDefault: false,
          sectionHeader: "Section 1",
          isHidden: true,
        },
        {
          pageScriptHash: "visible_hash_2",
          pageName: "visible page 2",
          urlPathname: "visible_page_2",
          isDefault: false,
          sectionHeader: "Section 1",
          isHidden: false,
        },
      ]

      renderTopNav(
        {},
        {
          navigationContext: {
            appPages,
            navSections: ["Section 1"],
          },
        }
      )

      // Section should be rendered as a dropdown since all visible pages are in a section
      const sectionDropdown = screen.getByTestId("stTopNavSection")
      expect(sectionDropdown).toBeInTheDocument()
      expect(sectionDropdown).toHaveTextContent("Section 1")
    })

    it("does not render section when all pages in section are hidden", () => {
      const appPages: IAppPage[] = [
        {
          pageScriptHash: "visible_hash_1",
          pageName: "visible page 1",
          urlPathname: "visible_page_1",
          isDefault: true,
          sectionHeader: "Visible Section",
          isHidden: false,
        },
        {
          pageScriptHash: "visible_hash_2",
          pageName: "visible page 2",
          urlPathname: "visible_page_2",
          isDefault: false,
          sectionHeader: "Visible Section",
          isHidden: false,
        },
        {
          pageScriptHash: "hidden_hash_1",
          pageName: "hidden page 1",
          urlPathname: "hidden_page_1",
          isDefault: false,
          sectionHeader: "Hidden Section",
          isHidden: true,
        },
        {
          pageScriptHash: "hidden_hash_2",
          pageName: "hidden page 2",
          urlPathname: "hidden_page_2",
          isDefault: false,
          sectionHeader: "Hidden Section",
          isHidden: true,
        },
      ]

      renderTopNav(
        {},
        {
          navigationContext: {
            appPages,
            navSections: ["Visible Section", "Hidden Section"],
          },
        }
      )

      // Only the visible section should be rendered
      const sectionDropdowns = screen.getAllByTestId("stTopNavSection")
      expect(sectionDropdowns).toHaveLength(1)
      expect(sectionDropdowns[0]).toHaveTextContent("Visible Section")
      expect(screen.queryByText("Hidden Section")).not.toBeInTheDocument()
    })

    it("renders individual pages when not in sections", () => {
      const appPages: IAppPage[] = [
        {
          pageScriptHash: "visible_hash_1",
          pageName: "page 1",
          urlPathname: "page_1",
          isDefault: true,
          isHidden: false,
        },
        {
          pageScriptHash: "visible_hash_2",
          pageName: "page 2",
          urlPathname: "page_2",
          isDefault: false,
          isHidden: false,
        },
        {
          pageScriptHash: "hidden_hash",
          pageName: "hidden page",
          urlPathname: "hidden_page",
          isDefault: false,
          isHidden: true,
        },
      ]

      renderTopNav(
        {},
        {
          navigationContext: { appPages },
        }
      )

      // Should render 2 individual nav links, not a section dropdown
      const links = screen.getAllByTestId("stTopNavLink")
      expect(links).toHaveLength(2)
      expect(screen.queryByTestId("stTopNavSection")).not.toBeInTheDocument()
    })
  })

  describe("section header markdown", () => {
    it("renders markdown in section titles", () => {
      const appPages: IAppPage[] = [
        {
          pageScriptHash: "hash_1",
          pageName: "page 1",
          urlPathname: "page_1",
          isDefault: true,
          sectionHeader: "**Bold** section",
          isHidden: false,
        },
        {
          pageScriptHash: "hash_2",
          pageName: "page 2",
          urlPathname: "page_2",
          isDefault: false,
          sectionHeader: "**Bold** section",
          isHidden: false,
        },
      ]

      renderTopNav(
        {},
        {
          navigationContext: {
            appPages,
            navSections: ["**Bold** section"],
          },
        }
      )

      const sectionDropdown = screen.getByTestId("stTopNavSection")
      expect(sectionDropdown.querySelector("strong")).toHaveTextContent("Bold")
      // Links in section titles should be disabled
      expect(
        sectionDropdown.querySelector(".stMarkdown a, .stStreamlitMarkdown a")
      ).toBeNull()
    })
  })
})
