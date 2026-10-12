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
  [
    {
      pageScriptHash: "page_a",
      pageName: "Page A",
      urlPathname: "page_a",
      isDefault: true,
    },
    {
      pageScriptHash: "page_b",
      pageName: "Page B",
      urlPathname: "page_b",
      isDefault: false,
    },
  ],
]

const MULTI_OVERFLOW_SECTIONS: AppPage.$Properties[][] = [
  [
    {
      pageScriptHash: "admin_page",
      pageName: "Admin Page",
      urlPathname: "admin",
      isDefault: false,
      sectionHeader: "Admin",
    },
  ],
  [
    {
      pageScriptHash: "report_page",
      pageName: "Report Page",
      urlPathname: "report",
      isDefault: false,
      sectionHeader: "Reports",
    },
  ],
]

const SECTIONLESS_OVERFLOW: AppPage.$Properties[][] = [
  [
    {
      pageScriptHash: "page_one",
      pageName: "Page One",
      urlPathname: "page_one",
      isDefault: false,
      sectionHeader: "",
    },
  ],
  [
    {
      pageScriptHash: "page_two",
      pageName: "Page Two",
      urlPathname: "page_two",
      isDefault: false,
      sectionHeader: "",
    },
  ],
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
          {...getDefaultProps({
            handlePageChange,
            sections: MIXED_SECTIONS,
          })}
        />
      )

      const popover = await openPopover(user)
      const links = within(popover).getAllByTestId("stTopNavDropdownLink")
      expect(links).toHaveLength(2)

      // Click the external link
      await user.click(within(popover).getByText("external page"))

      // handlePageChange should NOT be called for external links
      expect(handlePageChange).not.toHaveBeenCalled()
    })

    it("calls handlePageChange when clicking an internal link", async () => {
      const handlePageChange = vi.fn()
      const user = userEvent.setup()

      renderWithContexts(
        <TopNavSection
          {...getDefaultProps({
            handlePageChange,
            sections: MIXED_SECTIONS,
          })}
        />
      )

      const popover = await openPopover(user)

      // Click the internal link
      await user.click(within(popover).getByText("internal page"))

      // handlePageChange should be called for internal links
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

      // External link should open in a new tab
      expect(externalLink).toHaveAttribute("href", "https://example.com")
      expect(externalLink).toHaveAttribute("target", "_blank")
      expect(externalLink).toHaveAttribute("rel", "noopener noreferrer")

      // Internal link should NOT have external-link attributes
      expect(internalLink).not.toHaveAttribute("target")
      expect(internalLink).not.toHaveAttribute("rel")
    })
  })

  describe("keyboard menu navigation", () => {
    it("opens with Enter and focuses the first menu item", async () => {
      const user = userEvent.setup()
      renderWithContexts(
        <TopNavSection
          {...getDefaultProps({ sections: TWO_PAGE_SECTION, title: "Group" })}
        />
      )

      const trigger = screen.getByTestId("stTopNavSection")
      trigger.focus()
      await user.keyboard("{Enter}")

      const popover = screen.getByTestId("stTopNavPopover")
      expect(popover).toBeVisible()
      expect(trigger).toHaveAttribute("aria-expanded", "true")
      expect(within(popover).getByText("Page A").closest("a")).toHaveFocus()
    })

    it("opens with ArrowDown and focuses the first menu item", async () => {
      const user = userEvent.setup()
      renderWithContexts(
        <TopNavSection
          {...getDefaultProps({ sections: TWO_PAGE_SECTION, title: "Group" })}
        />
      )

      const trigger = screen.getByTestId("stTopNavSection")
      trigger.focus()
      await user.keyboard("{ArrowDown}")

      const popover = screen.getByTestId("stTopNavPopover")
      expect(within(popover).getByText("Page A").closest("a")).toHaveFocus()
    })

    it("moves focus with arrow keys", async () => {
      const user = userEvent.setup()
      renderWithContexts(
        <TopNavSection
          {...getDefaultProps({ sections: TWO_PAGE_SECTION, title: "Group" })}
        />
      )

      await openPopover(user)
      const pageA = screen.getByText("Page A").closest("a")
      const pageB = screen.getByText("Page B").closest("a")
      expect(pageA).toHaveFocus()

      await user.keyboard("{ArrowDown}")
      expect(pageB).toHaveFocus()

      await user.keyboard("{ArrowUp}")
      expect(pageA).toHaveFocus()
    })

    it("returns focus to the trigger when Escape closes the menu", async () => {
      const user = userEvent.setup()
      renderWithContexts(
        <TopNavSection
          {...getDefaultProps({ sections: TWO_PAGE_SECTION, title: "Group" })}
        />
      )

      const trigger = screen.getByTestId("stTopNavSection")
      await openPopover(user)
      await user.keyboard("{Escape}")

      expect(screen.queryByTestId("stTopNavPopover")).not.toBeInTheDocument()
      expect(trigger).toHaveFocus()
    })

    it("moves focus to the next control when Tab closes the menu", async () => {
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
      await user.keyboard("{Tab}")

      expect(screen.queryByTestId("stTopNavPopover")).not.toBeInTheDocument()
      expect(screen.getByRole("button", { name: "After" })).toHaveFocus()
    })

    it("moves focus to the previous control when Shift+Tab closes the menu", async () => {
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
      await user.keyboard("{Shift>}{Tab}{/Shift}")

      expect(screen.queryByTestId("stTopNavPopover")).not.toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Before" })).toHaveFocus()
    })

    it("opens with ArrowUp and focuses the last menu item", async () => {
      const user = userEvent.setup()
      renderWithContexts(
        <TopNavSection
          {...getDefaultProps({ sections: TWO_PAGE_SECTION, title: "Group" })}
        />
      )

      const trigger = screen.getByTestId("stTopNavSection")
      trigger.focus()
      await user.keyboard("{ArrowUp}")

      expect(screen.getByText("Page B").closest("a")).toHaveFocus()
    })

    it("moves focus with Home and End", async () => {
      const user = userEvent.setup()
      renderWithContexts(
        <TopNavSection
          {...getDefaultProps({ sections: TWO_PAGE_SECTION, title: "Group" })}
        />
      )

      await openPopover(user)
      await user.keyboard("{End}")
      expect(screen.getByText("Page B").closest("a")).toHaveFocus()

      await user.keyboard("{Home}")
      expect(screen.getByText("Page A").closest("a")).toHaveFocus()
    })

    it("activates the focused menuitem with Space", async () => {
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
      await user.keyboard(" ")

      expect(handlePageChange).toHaveBeenCalledWith("page_a")
      expect(screen.queryByTestId("stTopNavPopover")).not.toBeInTheDocument()
    })

    it("exposes menu semantics labelled by the trigger", async () => {
      const user = userEvent.setup()
      renderWithContexts(
        <TopNavSection
          {...getDefaultProps({
            sections: TWO_PAGE_SECTION,
            title: "**Bold** Group",
          })}
        />
      )

      const trigger = screen.getByTestId("stTopNavSection")
      expect(trigger).toHaveAttribute("aria-haspopup", "menu")

      await openPopover(user)
      const menu = screen.getByRole("menu", { name: "Bold Group" })
      expect(menu).toBeVisible()
      expect(menu).toHaveAttribute("aria-labelledby", trigger.id)
      expect(screen.getAllByRole("menuitem")).toHaveLength(2)
    })

    it("links the trigger to the menu with aria-controls when open", async () => {
      const user = userEvent.setup()
      renderWithContexts(
        <TopNavSection
          {...getDefaultProps({ sections: TWO_PAGE_SECTION, title: "Group" })}
        />
      )

      const trigger = screen.getByTestId("stTopNavSection")
      expect(trigger).not.toHaveAttribute("aria-controls")

      const popover = await openPopover(user)
      const menuId = popover.getAttribute("id")
      expect(menuId).toBeTruthy()
      expect(trigger).toHaveAttribute("aria-controls", menuId)
    })

    it("returns focus to the trigger after Tab close and a subsequent click close", async () => {
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

      const trigger = screen.getByTestId("stTopNavSection")
      await openPopover(user)
      await user.keyboard("{Tab}")
      expect(trigger).not.toHaveFocus()

      await user.click(trigger)
      await user.click(trigger)

      expect(screen.queryByTestId("stTopNavPopover")).not.toBeInTheDocument()
      expect(trigger).toHaveFocus()
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
      const outside = screen.getByRole("button", { name: "Outside" })
      await user.click(outside)

      expect(screen.queryByTestId("stTopNavPopover")).not.toBeInTheDocument()
      expect(outside).toHaveFocus()
      expect(screen.getByTestId("stTopNavSection")).not.toHaveFocus()
    })

    it("groups named overflow sections for assistive technology", async () => {
      const user = userEvent.setup()
      renderWithContexts(
        <TopNavSection
          {...getDefaultProps({
            sections: MULTI_OVERFLOW_SECTIONS,
            title: "More",
          })}
        />
      )

      const popover = await openPopover(user)
      expect(
        within(popover).getByRole("group", { name: "Admin" })
      ).toBeVisible()
      expect(
        within(popover).getByRole("group", { name: "Reports" })
      ).toBeVisible()
    })

    it("does not invent headers for sectionless overflow pages", async () => {
      const user = userEvent.setup()
      renderWithContexts(
        <TopNavSection
          {...getDefaultProps({
            sections: SECTIONLESS_OVERFLOW,
            title: "More",
          })}
        />
      )

      const popover = await openPopover(user)
      expect(within(popover).queryByRole("group")).not.toBeInTheDocument()
      expect(within(popover).getAllByText("Page One")).toHaveLength(1)
      expect(within(popover).getAllByText("Page Two")).toHaveLength(1)
      expect(within(popover).getAllByRole("menuitem")).toHaveLength(2)
    })
  })
})
