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

import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { mockEndpoints, type NavigationContextProps } from "@streamlit/lib"
import { renderWithContexts } from "@streamlit/lib/testing"
import type { AppPage } from "@streamlit/protobuf"

import TopNav, { type Props, TopNavOverflowItem } from "./TopNav"

/**
 * Index after which the rc-overflow mock marks items aria-hidden, like real
 * collapsed items. Null keeps every item visible.
 */
const overflowMockState = vi.hoisted(() => ({
  collapseAfterIndex: null as number | null,
}))

// Mock rc-overflow without real layout measurement, but still render through
// itemComponent so TopNavOverflowItem wiring is covered.
vi.mock("rc-overflow", () => ({
  default: ({
    data,
    renderItem,
    itemKey,
    component: Component = "div",
    itemComponent: ItemComponent = "div",
    ...rest
  }: {
    data: unknown[]
    renderItem: (item: unknown, info: unknown) => React.ReactNode
    itemKey: (item: unknown) => string
    component?: React.ElementType
    itemComponent?: React.ElementType
    [key: string]: unknown
  }) => (
    <Component {...rest}>
      {data.map((item, index) => {
        const isCollapsed =
          overflowMockState.collapseAfterIndex !== null &&
          index > overflowMockState.collapseAfterIndex
        return (
          <ItemComponent
            key={itemKey(item)}
            {...(isCollapsed ? { "aria-hidden": true } : {})}
          >
            {renderItem(item, { index })}
          </ItemComponent>
        )
      })}
    </Component>
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
    overrides?.navigationContext ?? {}
  )

  return renderWithContexts(<TopNav {...getProps(props)} />, {
    navigationContext: navigationContextValues,
  })
}

describe("TopNavOverflowItem", () => {
  it.each([true, "true"] as const)(
    "sets inert when aria-hidden is %s",
    ariaHidden => {
      // rc-overflow sets aria-hidden on collapsed item hosts; pass it here to
      // test the host in isolation.
      const { container } = render(
        <TopNavOverflowItem {...{ "aria-hidden": ariaHidden }}>
          <a href="/page">Page</a>
        </TopNavOverflowItem>
      )
      expect(container.firstElementChild).toHaveAttribute("inert")
    }
  )

  it.each([false, undefined] as const)(
    "leaves hosts active when aria-hidden is %s",
    ariaHidden => {
      const props =
        ariaHidden === undefined ? {} : { "aria-hidden": ariaHidden }
      const { container } = render(
        <TopNavOverflowItem {...props}>
          <a href="/page">Page</a>
        </TopNavOverflowItem>
      )
      expect(container.firstElementChild).not.toHaveAttribute("inert")
    }
  )

  it("sets inert on aria-hidden hosts and removes it when they are shown", () => {
    const { container, rerender } = render(
      <TopNavOverflowItem {...{ "aria-hidden": true as const }}>
        <a href="/page">Page</a>
      </TopNavOverflowItem>
    )
    expect(container.firstElementChild).toHaveAttribute("inert")

    rerender(
      <TopNavOverflowItem>
        <a href="/page">Page</a>
      </TopNavOverflowItem>
    )
    expect(container.firstElementChild).not.toHaveAttribute("inert")
  })
})

describe("TopNav", () => {
  afterEach(() => {
    overflowMockState.collapseAfterIndex = null
  })

  it("exposes a named navigation landmark", () => {
    const appPages: AppPage.$Properties[] = [
      {
        pageScriptHash: "page_1",
        pageName: "page 1",
        urlPathname: "page_1",
        isDefault: true,
      },
      {
        pageScriptHash: "page_2",
        pageName: "page 2",
        urlPathname: "page_2",
        isDefault: false,
      },
    ]

    renderTopNav({}, { navigationContext: { appPages } })

    const nav = screen.getByRole("navigation", { name: "App pages" })
    expect(nav).toHaveAttribute("data-testid", "stTopNav")
  })

  it("marks collapsed overflow links inert and leaves visible links active", () => {
    // jsdom does not skip inert hosts on Tab, so assert the host contract here.
    overflowMockState.collapseAfterIndex = 0
    const appPages: AppPage.$Properties[] = [
      {
        pageScriptHash: "page_1",
        pageName: "page 1",
        urlPathname: "page_1",
        isDefault: true,
      },
      {
        pageScriptHash: "page_2",
        pageName: "page 2",
        urlPathname: "page_2",
        isDefault: false,
      },
    ]

    renderTopNav({}, { navigationContext: { appPages } })

    const links = screen.getAllByTestId("stTopNavLink")
    expect(links).toHaveLength(2)

    expect(links[0].closest("[aria-hidden]")).toBeNull()
    expect(links[0].closest("[inert]")).toBeNull()

    const collapsedHost = links[1].closest("[aria-hidden='true']")
    expect(collapsedHost).not.toBeNull()
    expect(collapsedHost).toHaveAttribute("inert")
  })

  describe("hidden pages", () => {
    it("does not render hidden pages in the navigation", () => {
      const appPages: AppPage.$Properties[] = [
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
      const appPages: AppPage.$Properties[] = [
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
      const appPages: AppPage.$Properties[] = [
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
      const appPages: AppPage.$Properties[] = [
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
      const appPages: AppPage.$Properties[] = [
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

  describe("external links", () => {
    it("does not call onPageChange when clicking an external link", async () => {
      const onPageChange = vi.fn()
      const user = userEvent.setup()
      const appPages: AppPage.$Properties[] = [
        {
          pageScriptHash: "internal_hash",
          pageName: "internal page",
          urlPathname: "internal_page",
          isDefault: true,
          isHidden: false,
        },
        {
          pageScriptHash: "external_hash",
          pageName: "external page",
          urlPathname: "external_page",
          isDefault: false,
          isHidden: false,
          externalUrl: "https://example.com",
        },
      ]

      renderTopNav(
        {},
        {
          navigationContext: { appPages, onPageChange },
        }
      )

      const links = screen.getAllByTestId("stTopNavLink")
      expect(links).toHaveLength(2)

      // Click the external link
      await user.click(links[1])

      // onPageChange should NOT be called for external links
      expect(onPageChange).not.toHaveBeenCalled()
    })

    it("does not render hidden external pages in the navigation", () => {
      const appPages: AppPage.$Properties[] = [
        {
          pageScriptHash: "visible_internal_hash",
          pageName: "visible internal",
          urlPathname: "visible_internal",
          isDefault: true,
          isHidden: false,
        },
        {
          pageScriptHash: "visible_external_hash",
          pageName: "visible external",
          urlPathname: "visible_external",
          isDefault: false,
          isHidden: false,
          externalUrl: "https://visible.example.com",
        },
        {
          pageScriptHash: "hidden_external_hash",
          pageName: "hidden external",
          urlPathname: "hidden_external",
          isDefault: false,
          isHidden: true,
          externalUrl: "https://hidden.example.com",
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
      expect(screen.getByText("visible internal")).toBeVisible()
      expect(screen.getByText("visible external")).toBeVisible()
      expect(screen.queryByText("hidden external")).not.toBeInTheDocument()
    })
  })
})
