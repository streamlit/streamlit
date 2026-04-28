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

import { MutableRefObject } from "react"

import { screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { Pagination as PaginationProto } from "@streamlit/protobuf"

import * as UseResizeObserver from "~lib/hooks/useResizeObserver"
import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import Pagination, { getPaginationItems, Props } from "./Pagination"

const getProps = (
  elementProps: Partial<PaginationProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: PaginationProto.create({
    id: "pagination-1",
    numPages: 10,
    default: 1,
    disabled: false,
    maxVisiblePages: 7,
    ...elementProps,
  }),
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
  widthConfig: {
    useContent: true,
  },
  ...widgetProps,
})

const getPageButtons = (): HTMLElement[] => {
  const pagination = screen.getByTestId("stPagination")
  return within(pagination).getAllByRole("button", { name: /^Page / })
}

describe("Pagination widget", () => {
  beforeEach(() => {
    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      values: [],
      elementRef: { current: null } as MutableRefObject<HTMLDivElement | null>,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("page item truncation", () => {
    it("shows all pages when the page count fits", () => {
      expect(
        getPaginationItems({
          currentPage: 1,
          maxVisiblePages: 5,
          numPages: 5,
        })
      ).toEqual([
        { type: "page", page: 1 },
        { type: "page", page: 2 },
        { type: "page", page: 3 },
        { type: "page", page: 4 },
        { type: "page", page: 5 },
      ])
    })

    it("keeps first, current, and last page for wider truncation", () => {
      expect(
        getPaginationItems({
          currentPage: 6,
          maxVisiblePages: 5,
          numPages: 10,
        })
      ).toEqual([
        { type: "page", page: 1 },
        { type: "ellipsis", key: "1-5" },
        { type: "page", page: 5 },
        { type: "page", page: 6 },
        { type: "page", page: 7 },
        { type: "ellipsis", key: "7-10" },
        { type: "page", page: 10 },
      ])
    })

    it("shows only the current page when maxVisiblePages is 1", () => {
      expect(
        getPaginationItems({
          currentPage: 5,
          maxVisiblePages: 1,
          numPages: 10,
        })
      ).toEqual([{ type: "page", page: 5 }])
    })

    it("shows no page buttons when maxVisiblePages is 0", () => {
      expect(
        getPaginationItems({
          currentPage: 5,
          maxVisiblePages: 0,
          numPages: 10,
        })
      ).toEqual([])
    })
  })

  describe("rendering", () => {
    it("renders without crashing", () => {
      const props = getProps()
      render(<Pagination {...props} />)

      const pagination = screen.getByTestId("stPagination")
      expect(pagination).toBeVisible()
      expect(pagination).toHaveClass("stPagination")
    })

    it("renders arrows and truncated pages", () => {
      const props = getProps({ value: 6, setValue: true, maxVisiblePages: 5 })
      render(<Pagination {...props} />)

      expect(
        screen.getByRole("button", { name: "Previous page" })
      ).toBeVisible()
      expect(screen.getByRole("button", { name: "Next page" })).toBeVisible()
      expect(screen.getByRole("button", { name: "Page 6" })).toHaveAttribute(
        "aria-current",
        "page"
      )
      expect(screen.getAllByTestId("stPaginationEllipsis")).toHaveLength(2)
    })

    it("applies responsive page reduction", () => {
      vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
        values: [140],
        elementRef: {
          current: null,
        } as MutableRefObject<HTMLDivElement | null>,
      })
      const props = getProps({ value: 5, setValue: true, maxVisiblePages: 7 })

      render(<Pagination {...props} />)

      expect(getPageButtons()).toHaveLength(1)
      expect(screen.getByRole("button", { name: "Page 5" })).toBeVisible()
      expect(
        screen.queryByRole("button", { name: "Page 10" })
      ).not.toBeInTheDocument()
    })
  })

  describe("interaction", () => {
    it("sets widget value when a page is clicked", async () => {
      const user = userEvent.setup()
      const props = getProps()
      vi.spyOn(props.widgetMgr, "setIntValue")

      render(<Pagination {...props} />)
      await user.click(screen.getByRole("button", { name: "Page 3" }))

      expect(props.widgetMgr.setIntValue).toHaveBeenCalledWith(
        props.element,
        3,
        { fromUi: true },
        undefined
      )
    })

    it("moves to the next and previous pages", async () => {
      const user = userEvent.setup()
      const props = getProps({ value: 5, setValue: true })
      vi.spyOn(props.widgetMgr, "setIntValue")

      render(<Pagination {...props} />)
      await user.click(screen.getByRole("button", { name: "Next page" }))
      await user.click(screen.getByRole("button", { name: "Previous page" }))

      expect(props.widgetMgr.setIntValue).toHaveBeenCalledWith(
        props.element,
        6,
        { fromUi: true },
        undefined
      )
      expect(props.widgetMgr.setIntValue).toHaveBeenCalledWith(
        props.element,
        4,
        { fromUi: true },
        undefined
      )
    })

    it("disables boundary arrows", () => {
      const props = getProps({ value: 1, setValue: true })
      render(<Pagination {...props} />)

      expect(
        screen.getByRole("button", { name: "Previous page" })
      ).toBeDisabled()
      expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled()
    })

    it("does not update state when disabled", async () => {
      const user = userEvent.setup()
      const props = getProps({ disabled: true }, { disabled: true })
      vi.spyOn(props.widgetMgr, "setIntValue")

      render(<Pagination {...props} />)
      await user.click(screen.getByRole("button", { name: "Page 3" }))

      expect(props.widgetMgr.setIntValue).not.toHaveBeenCalledWith(
        props.element,
        3,
        { fromUi: true },
        undefined
      )
    })

    it("passes fragmentId to widget state updates", async () => {
      const user = userEvent.setup()
      const props = getProps({}, { fragmentId: "myFragmentId" })
      vi.spyOn(props.widgetMgr, "setIntValue")

      render(<Pagination {...props} />)
      await user.click(screen.getByRole("button", { name: "Page 2" }))

      expect(props.widgetMgr.setIntValue).toHaveBeenCalledWith(
        props.element,
        2,
        { fromUi: true },
        "myFragmentId"
      )
    })
  })
})
