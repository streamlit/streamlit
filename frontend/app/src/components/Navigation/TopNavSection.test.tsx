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
import { IAppPage } from "@streamlit/protobuf"

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

const MIXED_SECTIONS: IAppPage[][] = [
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
})
