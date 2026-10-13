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

import { screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { mockEndpoints } from "@streamlit/lib"
import { renderWithContexts } from "@streamlit/lib/testing"
import type { AppPage } from "@streamlit/protobuf"

import TopNavSection from "./TopNavSection"

const getDefaultProps = (
  overrides: Partial<React.ComponentProps<typeof TopNavSection>> = {}
): React.ComponentProps<typeof TopNavSection> => ({
  handlePageChange: vi.fn(),
  title: "Section 1",
  sections: [],
  endpoints: mockEndpoints(),
  pageLinkBaseUrl: "",
  currentPageScriptHash: "",
  widgetsDisabled: false,
  ...overrides,
})

const page = (
  hash: string,
  name: string,
  sectionHeader?: string
): AppPage.$Properties => ({
  pageScriptHash: hash,
  pageName: name,
  urlPathname: hash,
  isDefault: false,
  ...(sectionHeader !== undefined ? { sectionHeader } : {}),
})

const MIXED_SECTIONS: AppPage.$Properties[][] = [
  [
    {
      pageScriptHash: "internal_hash",
      pageName: "internal page",
      urlPathname: "internal_page",
      isDefault: true,
    },
    {
      pageScriptHash: "external_hash",
      pageName: "external page",
      urlPathname: "external_page",
      isDefault: false,
      externalUrl: "https://example.com",
    },
  ],
]

const TWO_PAGE_SECTION: AppPage.$Properties[][] = [
  [page("page_a", "Page A"), page("page_b", "Page B")],
]

async function openPopover(
  user: ReturnType<typeof userEvent.setup>
): Promise<HTMLElement> {
  await user.click(screen.getByTestId("stTopNavSection"))
  return screen.getByTestId("stTopNavPopover")
}

describe("TopNavSection", () => {
  describe("external links", () => {
    it("does not call handlePageChange when clicking an external link", async () => {
      const handlePageChange = vi.fn()
      const user = userEvent.setup()
      renderWithContexts(
        <TopNavSection
          {...getDefaultProps({ handlePageChange, sections: MIXED_SECTIONS })}
        />
      )
      const popover = await openPopover(user)
      expect(
        within(popover).getAllByTestId("stTopNavDropdownLink")
      ).toHaveLength(2)
      await user.click(within(popover).getByText("external page"))
      expect(handlePageChange).not.toHaveBeenCalled()
    })

    it("calls handlePageChange when clicking an internal link", async () => {
      const handlePageChange = vi.fn()
      const user = userEvent.setup()
      renderWithContexts(
        <TopNavSection
          {...getDefaultProps({ handlePageChange, sections: MIXED_SECTIONS })}
        />
      )
      const popover = await openPopover(user)
      await user.click(within(popover).getByText("internal page"))
      expect(handlePageChange).toHaveBeenCalledWith("internal_hash")
    })

    it("renders external link with correct href and target attributes", async () => {
      const user = userEvent.setup()
      renderWithContexts(
        <TopNavSection {...getDefaultProps({ sections: MIXED_SECTIONS })} />
      )
      const popover = await openPopover(user)
      const externalLink = within(popover)
        .getByText("external page")
        .closest("a")
      const internalLink = within(popover)
        .getByText("internal page")
        .closest("a")
      expect(externalLink).toHaveAttribute("href", "https://example.com")
      expect(externalLink).toHaveAttribute("target", "_blank")
      expect(externalLink).toHaveAttribute("rel", "noopener noreferrer")
      expect(internalLink).not.toHaveAttribute("target")
      expect(internalLink).not.toHaveAttribute("rel")
    })
  })

  describe("keyboard menu navigation", () => {
    it("opens with Enter, ArrowDown, and ArrowUp and focuses the chosen item", async () => {
      const user = userEvent.setup()
      const { unmount } = renderWithContexts(
        <TopNavSection
          {...getDefaultProps({ sections: TWO_PAGE_SECTION, title: "Group" })}
        />
      )
      const trigger = screen.getByTestId("stTopNavSection")
      trigger.focus()
      await user.keyboard("{Enter}")
      expect(screen.getByText("Page A").closest("a")).toHaveFocus()
      unmount()

      renderWithContexts(
        <TopNavSection
          {...getDefaultProps({ sections: TWO_PAGE_SECTION, title: "Group" })}
        />
      )
      screen.getByTestId("stTopNavSection").focus()
      await user.keyboard("{ArrowDown}")
      expect(screen.getByText("Page A").closest("a")).toHaveFocus()
      await user.keyboard("{Escape}")
      screen.getByTestId("stTopNavSection").focus()
      await user.keyboard("{ArrowUp}")
      expect(screen.getByText("Page B").closest("a")).toHaveFocus()
    })

    it("moves focus with arrows, Home, and End; Space activates", async () => {
      const handlePageChange = vi.fn()
      const user = userEvent.setup()
      renderWithContexts(
        <TopNavSection
          {...getDefaultProps({
            sections: TWO_PAGE_SECTION,
            title: "Group",
            handlePageChange,
          })}
        />
      )
      await openPopover(user)
      await user.keyboard("{ArrowDown}")
      expect(screen.getByText("Page B").closest("a")).toHaveFocus()
      await user.keyboard("{Home}")
      expect(screen.getByText("Page A").closest("a")).toHaveFocus()
      await user.keyboard("{End}")
      expect(screen.getByText("Page B").closest("a")).toHaveFocus()
      await user.keyboard(" ")
      expect(handlePageChange).toHaveBeenCalledWith("page_b")
    })

    it("closes with Escape, Tab, and Shift+Tab and routes focus", async () => {
      const user = userEvent.setup()
      renderWithContexts(
        <div>
          <button type="button">Before</button>
          <TopNavSection
            {...getDefaultProps({
              sections: TWO_PAGE_SECTION,
              title: "Group",
            })}
          />
          <button type="button">After</button>
        </div>
      )
      await openPopover(user)
      await user.keyboard("{Escape}")
      expect(screen.queryByTestId("stTopNavPopover")).not.toBeInTheDocument()
      expect(screen.getByTestId("stTopNavSection")).toHaveFocus()

      await openPopover(user)
      await user.keyboard("{Tab}")
      expect(screen.queryByTestId("stTopNavPopover")).not.toBeInTheDocument()
      expect(screen.getByRole("button", { name: "After" })).toHaveFocus()

      await openPopover(user)
      await user.keyboard("{Shift>}{Tab}{/Shift}")
      expect(screen.queryByTestId("stTopNavPopover")).not.toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Before" })).toHaveFocus()
    })

    it("skips aria-hidden overflow neighbors when Tab closes the menu", async () => {
      const user = userEvent.setup()
      renderWithContexts(
        <div>
          <a href="/visible" data-testid="visible-nav">
            Visible Page
          </a>
          <a href="/hidden" data-testid="hidden-nav">
            Hidden Page
          </a>
          <TopNavSection
            {...getDefaultProps({
              sections: TWO_PAGE_SECTION,
              title: "2 more",
            })}
          />
          <button type="button">After</button>
        </div>
      )
      const hiddenNav = screen.getByTestId("hidden-nav")
      const hiddenWrapper = document.createElement("div")
      hiddenWrapper.setAttribute("aria-hidden", "true")
      hiddenNav.parentElement?.insertBefore(hiddenWrapper, hiddenNav)
      hiddenWrapper.appendChild(hiddenNav)

      await openPopover(user)
      await user.keyboard("{Shift>}{Tab}{/Shift}")
      expect(screen.getByTestId("visible-nav")).toHaveFocus()

      await openPopover(user)
      await user.keyboard("{Tab}")
      expect(screen.getByRole("button", { name: "After" })).toHaveFocus()
    })

    it("blocks keyboard activation when widgets are disabled", async () => {
      const handlePageChange = vi.fn()
      const user = userEvent.setup()
      renderWithContexts(
        <TopNavSection
          {...getDefaultProps({
            sections: TWO_PAGE_SECTION,
            title: "Group",
            handlePageChange,
            widgetsDisabled: true,
          })}
        />
      )
      await openPopover(user)
      expect(screen.getByText("Page A").closest("a")).toHaveAttribute(
        "aria-disabled",
        "true"
      )
      await user.keyboard(" ")
      await user.keyboard("{Enter}")
      expect(handlePageChange).not.toHaveBeenCalled()
    })

    it("exposes menu ARIA and named overflow groups", async () => {
      const user = userEvent.setup()
      renderWithContexts(
        <TopNavSection
          {...getDefaultProps({
            sections: [
              [page("admin", "Admin Page", "Admin")],
              [page("report", "Report Page", "Reports")],
            ],
            title: "More",
          })}
        />
      )
      const trigger = screen.getByTestId("stTopNavSection")
      expect(trigger).toHaveAttribute("aria-haspopup", "menu")
      const popover = await openPopover(user)
      expect(trigger).toHaveAttribute("aria-controls", popover.id)
      expect(popover).toHaveAttribute("role", "menu")
      expect(popover).toHaveAccessibleName("More")
      expect(
        within(popover).getByRole("group", { name: "Admin" })
      ).toBeVisible()
    })

    it("does not invent headers for sectionless overflow pages", async () => {
      const user = userEvent.setup()
      renderWithContexts(
        <TopNavSection
          {...getDefaultProps({
            sections: [
              [page("page_one", "Page One", "")],
              [page("page_two", "Page Two", "")],
            ],
            title: "More",
          })}
        />
      )
      const popover = await openPopover(user)
      expect(within(popover).queryByRole("group")).not.toBeInTheDocument()
      expect(within(popover).getAllByRole("menuitem")).toHaveLength(2)
    })

    it("keeps groups distinct when section headers differ only by whitespace", async () => {
      const user = userEvent.setup()
      renderWithContexts(
        <TopNavSection
          {...getDefaultProps({
            sections: [
              [page("admin", "Admin Page", "Admin")],
              [page("spaced", "Spaced Page", " Admin")],
            ],
            title: "More",
          })}
        />
      )
      const popover = await openPopover(user)
      expect(within(popover).getAllByRole("group")).toHaveLength(2)
      expect(within(popover).getByText("Admin Page")).toBeVisible()
      expect(within(popover).getByText("Spaced Page")).toBeVisible()
    })

    it("keeps the focused page tabbable when earlier pages leave the menu", async () => {
      const user = userEvent.setup()
      const three = [
        [
          page("page_a", "Page A"),
          page("page_b", "Page B"),
          page("page_c", "Page C"),
        ],
      ]
      const { rerender } = renderWithContexts(
        <TopNavSection
          {...getDefaultProps({ sections: three, title: "Group" })}
        />
      )
      await openPopover(user)
      await user.keyboard("{ArrowDown}")
      expect(screen.getByText("Page B").closest("a")).toHaveFocus()

      rerender(
        <TopNavSection
          {...getDefaultProps({
            sections: [[page("page_b", "Page B"), page("page_c", "Page C")]],
            title: "Group",
          })}
        />
      )
      expect(screen.getByText("Page B").closest("a")).toHaveFocus()
      await user.keyboard("{ArrowDown}")
      expect(screen.getByText("Page C").closest("a")).toHaveFocus()

      // Named multi-page section: dropping the first page must not remount the group.
      rerender(
        <TopNavSection
          {...getDefaultProps({
            sections: [
              [
                page("page_a", "Page A", "Admin"),
                page("page_b", "Page B", "Admin"),
              ],
              [page("page_c", "Page C", "Reports")],
            ],
            title: "2 more",
          })}
        />
      )
      await user.keyboard("{Escape}")
      await openPopover(user)
      await user.keyboard("{ArrowDown}")
      expect(screen.getByText("Page B").closest("a")).toHaveFocus()
      rerender(
        <TopNavSection
          {...getDefaultProps({
            sections: [
              [page("page_b", "Page B", "Admin")],
              [page("page_c", "Page C", "Reports")],
            ],
            title: "2 more",
          })}
        />
      )
      expect(screen.getByText("Page B").closest("a")).toHaveFocus()
    })

    it("moves focus to the preceding control when overflow empties while open", async () => {
      const user = userEvent.setup()
      const { rerender } = renderWithContexts(
        <div>
          <button type="button">Visible Page</button>
          <TopNavSection
            {...getDefaultProps({
              sections: TWO_PAGE_SECTION,
              title: "2 more",
            })}
          />
        </div>
      )
      await openPopover(user)
      expect(screen.getByText("Page A").closest("a")).toHaveFocus()

      rerender(
        <div>
          <button type="button">Visible Page</button>
          <TopNavSection
            {...getDefaultProps({ sections: [], title: "2 more" })}
          />
        </div>
      )
      expect(screen.queryByTestId("stTopNavSection")).not.toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: "Visible Page" })
      ).toHaveFocus()
    })

    it("leaves focus on an outside click target when the menu closes", async () => {
      const user = userEvent.setup()
      renderWithContexts(
        <div>
          <TopNavSection
            {...getDefaultProps({
              sections: TWO_PAGE_SECTION,
              title: "Group",
            })}
          />
          <button type="button">Outside</button>
        </div>
      )
      await openPopover(user)
      await user.click(screen.getByRole("button", { name: "Outside" }))
      expect(screen.queryByTestId("stTopNavPopover")).not.toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Outside" })).toHaveFocus()
    })
  })
})
