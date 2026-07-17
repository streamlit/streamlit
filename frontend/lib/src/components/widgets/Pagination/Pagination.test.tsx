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
import { userEvent } from "@testing-library/user-event"

import { Pagination as PaginationProto } from "@streamlit/protobuf"

import * as useResizeObserverModule from "~lib/hooks/useResizeObserver"
import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import Pagination, { Props } from "./Pagination"

const getProps = (
  elementProps: Partial<PaginationProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: PaginationProto.create({
    id: "pagination-1",
    numPages: 10,
    default: 1,
    disabled: false,
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

const getPaginationWidget = (): HTMLElement =>
  screen.getByTestId("stPagination")

const getPrevButton = (): HTMLElement => screen.getByTestId("stPaginationPrev")

const getNextButton = (): HTMLElement => screen.getByTestId("stPaginationNext")

const getPageButtons = (): HTMLElement[] =>
  screen.queryAllByTestId(/stPaginationPage/)

const getActivePageButton = (): HTMLElement | null =>
  screen.queryByTestId("stPaginationPageActive")

describe("Pagination widget", () => {
  describe("Rendering", () => {
    it("renders without crashing", () => {
      const props = getProps()
      render(<Pagination {...props} />)

      const widget = getPaginationWidget()
      expect(widget).toBeVisible()
      expect(widget).toHaveClass("stPagination")
    })

    it("renders prev and next buttons", () => {
      const props = getProps()
      render(<Pagination {...props} />)

      expect(getPrevButton()).toBeVisible()
      expect(getNextButton()).toBeVisible()
    })

    it("renders page buttons", () => {
      const props = getProps({ numPages: 5 })
      render(<Pagination {...props} />)

      const pageButtons = getPageButtons()
      expect(pageButtons.length).toBeGreaterThan(0)
    })

    it("highlights current page", () => {
      const props = getProps({ numPages: 5, default: 3 })
      render(<Pagination {...props} />)

      const activeButton = getActivePageButton()
      expect(activeButton).toBeVisible()
      expect(activeButton).toHaveTextContent("3")
    })

    it("shows all pages when numPages is small", () => {
      const props = getProps({ numPages: 5 })
      render(<Pagination {...props} />)

      expect(screen.getByRole("button", { name: "Page 1" })).toBeVisible()
      expect(screen.getByRole("button", { name: "Page 5" })).toBeVisible()
    })

    it("shows ellipsis for large page counts", () => {
      // Set maxVisiblePages to trigger truncation with ellipsis
      const props = getProps({ numPages: 20, default: 10, maxVisiblePages: 7 })
      render(<Pagination {...props} />)

      const ellipses = screen.queryAllByTestId("stPaginationEllipsis")
      expect(ellipses.length).toBeGreaterThan(0)
    })
  })

  describe("Navigation", () => {
    it("disables prev button on first page", () => {
      const props = getProps({ numPages: 10, default: 1 })
      render(<Pagination {...props} />)

      expect(getPrevButton()).toBeDisabled()
    })

    it("disables next button on last page", () => {
      const props = getProps({ numPages: 10, default: 10 })
      render(<Pagination {...props} />)

      expect(getNextButton()).toBeDisabled()
    })

    it("enables both buttons on middle pages", () => {
      const props = getProps({ numPages: 10, default: 5 })
      render(<Pagination {...props} />)

      expect(getPrevButton()).not.toBeDisabled()
      expect(getNextButton()).not.toBeDisabled()
    })

    it("navigates to next page on next click", async () => {
      const user = userEvent.setup()
      const props = getProps({ numPages: 10, default: 1 })
      vi.spyOn(props.widgetMgr, "setIntValue")

      render(<Pagination {...props} />)

      await user.click(getNextButton())

      expect(props.widgetMgr.setIntValue).toHaveBeenCalledWith(
        props.element,
        2,
        { fromUi: true },
        undefined
      )
    })

    it("navigates to prev page on prev click", async () => {
      const user = userEvent.setup()
      const props = getProps({ numPages: 10, default: 5 })
      vi.spyOn(props.widgetMgr, "setIntValue")

      render(<Pagination {...props} />)

      await user.click(getPrevButton())

      expect(props.widgetMgr.setIntValue).toHaveBeenCalledWith(
        props.element,
        4,
        { fromUi: true },
        undefined
      )
    })

    it("navigates to specific page on page button click", async () => {
      const user = userEvent.setup()
      const props = getProps({ numPages: 5, default: 1 })
      vi.spyOn(props.widgetMgr, "setIntValue")

      render(<Pagination {...props} />)

      const page3Button = screen.getByRole("button", { name: "Page 3" })
      await user.click(page3Button)

      expect(props.widgetMgr.setIntValue).toHaveBeenCalledWith(
        props.element,
        3,
        { fromUi: true },
        undefined
      )
    })
  })

  describe("Disabled state", () => {
    it("disables all buttons when disabled prop is true", () => {
      const props = getProps({ numPages: 5, default: 3 }, { disabled: true })
      render(<Pagination {...props} />)

      expect(getPrevButton()).toBeDisabled()
      expect(getNextButton()).toBeDisabled()

      const pageButtons = getPageButtons()
      pageButtons.forEach(button => {
        expect(button).toBeDisabled()
      })
    })

    it("disables all buttons when element.disabled is true", () => {
      // Note: In actual use, ElementNodeRenderer sets widgetProps.disabled
      // based on element.disabled, so we test the combined effect
      const props = getProps(
        { numPages: 5, default: 3, disabled: true },
        { disabled: true }
      )
      render(<Pagination {...props} />)

      expect(getPrevButton()).toBeDisabled()
      expect(getNextButton()).toBeDisabled()
    })
  })

  describe("Accessibility", () => {
    it("has navigation role on button group", () => {
      const props = getProps()
      render(<Pagination {...props} />)

      const navigation = screen.getByRole("navigation")
      expect(navigation).toBeVisible()
    })

    it("has aria-labels on buttons", () => {
      const props = getProps({ numPages: 5 })
      render(<Pagination {...props} />)

      expect(getPrevButton()).toHaveAttribute("aria-label", "Previous page")
      expect(getNextButton()).toHaveAttribute("aria-label", "Next page")
      expect(screen.getByRole("button", { name: "Page 1" })).toBeVisible()
    })

    it("marks current page with aria-current", () => {
      const props = getProps({ numPages: 5, default: 3 })
      render(<Pagination {...props} />)

      const activeButton = getActivePageButton()
      expect(activeButton).toHaveAttribute("aria-current", "page")
    })
  })

  describe("Edge cases", () => {
    it("handles single page", () => {
      const props = getProps({ numPages: 1, default: 1 })
      render(<Pagination {...props} />)

      expect(getPrevButton()).toBeDisabled()
      expect(getNextButton()).toBeDisabled()

      const activeButton = getActivePageButton()
      expect(activeButton).toHaveTextContent("1")
    })

    it("handles max_visible_pages=0 (arrows only)", () => {
      const props = getProps({ numPages: 10, default: 5, maxVisiblePages: 0 })
      render(<Pagination {...props} />)

      expect(getPrevButton()).toBeVisible()
      expect(getNextButton()).toBeVisible()

      const pageButtons = getPageButtons()
      expect(pageButtons).toHaveLength(0)
    })

    it("handles max_visible_pages=1 (current page only)", () => {
      const props = getProps({ numPages: 10, default: 5, maxVisiblePages: 1 })
      render(<Pagination {...props} />)

      const pageButtons = getPageButtons()
      expect(pageButtons).toHaveLength(1)
      expect(pageButtons[0]).toHaveTextContent("5")
    })

    it("handles max_visible_pages=2 with current page at start", () => {
      const props = getProps({ numPages: 10, default: 1, maxVisiblePages: 2 })
      render(<Pagination {...props} />)

      expect(getPageButtons().map(b => b.textContent)).toEqual(["1", "10"])
      expect(screen.queryAllByTestId("stPaginationEllipsis")).toHaveLength(1)
    })

    it("handles max_visible_pages=2 with current page at end", () => {
      const props = getProps({ numPages: 10, default: 10, maxVisiblePages: 2 })
      render(<Pagination {...props} />)

      expect(getPageButtons().map(b => b.textContent)).toEqual(["1", "10"])
      expect(screen.queryAllByTestId("stPaginationEllipsis")).toHaveLength(1)
      expect(getActivePageButton()).toHaveTextContent("10")
    })

    it("handles max_visible_pages=2 with current page in middle", () => {
      const props = getProps({ numPages: 10, default: 5, maxVisiblePages: 2 })
      render(<Pagination {...props} />)

      expect(getPageButtons().map(b => b.textContent)).toEqual(["5", "10"])
      expect(getActivePageButton()).toHaveTextContent("5")
    })

    it("handles max_visible_pages=3 with current page near start", () => {
      const props = getProps({ numPages: 10, default: 2, maxVisiblePages: 3 })
      render(<Pagination {...props} />)

      expect(getPageButtons().map(b => b.textContent)).toEqual([
        "1",
        "2",
        "3",
        "10",
      ])
      expect(screen.queryAllByTestId("stPaginationEllipsis")).toHaveLength(1)
    })

    it("handles max_visible_pages=3 with current page near end", () => {
      const props = getProps({ numPages: 10, default: 9, maxVisiblePages: 3 })
      render(<Pagination {...props} />)

      expect(getPageButtons().map(b => b.textContent)).toEqual([
        "1",
        "8",
        "9",
        "10",
      ])
    })

    it("handles max_visible_pages=3 with current page in middle", () => {
      const props = getProps({ numPages: 10, default: 5, maxVisiblePages: 3 })
      render(<Pagination {...props} />)

      expect(getPageButtons().map(b => b.textContent)).toEqual([
        "1",
        "5",
        "10",
      ])
      // Both start and end ellipses should be present.
      expect(screen.queryAllByTestId("stPaginationEllipsis")).toHaveLength(2)
    })

    it("renders correctly with current page near end and maxVisible >= 4", () => {
      const props = getProps({ numPages: 20, default: 19, maxVisiblePages: 5 })
      render(<Pagination {...props} />)

      const pageButtons = getPageButtons()
      expect(pageButtons[0]).toHaveTextContent("1")
      expect(pageButtons[pageButtons.length - 1]).toHaveTextContent("20")
      expect(screen.queryAllByTestId("stPaginationEllipsis")).toHaveLength(1)
      expect(getActivePageButton()).toHaveTextContent("19")
    })

    it("renders correctly with current page near start and maxVisible >= 4", () => {
      const props = getProps({ numPages: 20, default: 2, maxVisiblePages: 5 })
      render(<Pagination {...props} />)

      const pageButtons = getPageButtons()
      expect(pageButtons[0]).toHaveTextContent("1")
      expect(pageButtons[pageButtons.length - 1]).toHaveTextContent("20")
      expect(screen.queryAllByTestId("stPaginationEllipsis")).toHaveLength(1)
      expect(getActivePageButton()).toHaveTextContent("2")
    })

    it("renders correctly with current page in middle and maxVisible >= 4", () => {
      const props = getProps({ numPages: 20, default: 10, maxVisiblePages: 5 })
      render(<Pagination {...props} />)

      const pageButtons = getPageButtons()
      expect(pageButtons[0]).toHaveTextContent("1")
      expect(pageButtons[pageButtons.length - 1]).toHaveTextContent("20")
      expect(screen.queryAllByTestId("stPaginationEllipsis")).toHaveLength(2)
      expect(getActivePageButton()).toHaveTextContent("10")
    })
  })

  describe("Set value behavior", () => {
    it("uses element.value when set_value is true", () => {
      const props = getProps({
        numPages: 10,
        default: 1,
        value: 7,
        setValue: true,
      })
      render(<Pagination {...props} />)

      expect(getActivePageButton()).toHaveTextContent("7")
    })

    it("clamps element.value to numPages upper bound", () => {
      const props = getProps({
        numPages: 5,
        default: 1,
        value: 99,
        setValue: true,
      })
      render(<Pagination {...props} />)

      expect(getActivePageButton()).toHaveTextContent("5")
    })

    it("clamps element.value to 1 lower bound", () => {
      const props = getProps({
        numPages: 5,
        default: 3,
        value: -2,
        setValue: true,
      })
      render(<Pagination {...props} />)

      expect(getActivePageButton()).toHaveTextContent("1")
    })
  })

  describe("Responsive sizing", () => {
    // Mocks the container width reported by useResizeObserver.
    // These tests verify the responsive layout logic, not exact pixel calculations.
    // The width values are intentionally chosen to exercise distinct layout branches:
    // - 10000px: large enough to show all buttons (tests full maxVisible)
    // - 180px: triggers maxVisible=2 collapse (fittable count ~3-4)
    // - 120px: triggers maxVisible=1 (current page only)
    // - 40px: triggers maxVisible=0 (no page buttons)
    // If theme tokens change significantly, tests may need recalibration, but they'll
    // fail with clear output (wrong button count) rather than silently passing.
    let resizeObserverSpy: ReturnType<typeof vi.spyOn>

    const mockContainerWidth = (width: number): void => {
      resizeObserverSpy = vi
        .spyOn(useResizeObserverModule, "useResizeObserver")
        .mockReturnValue({
          values: [width],
          elementRef: { current: null },
        })
    }

    afterEach(() => {
      resizeObserverSpy?.mockRestore()
    })

    it("uses full max visible when container width is large", () => {
      mockContainerWidth(10000)
      const props = getProps({ numPages: 20, default: 10, maxVisiblePages: 7 })
      render(<Pagination {...props} />)

      // maxVisible=7 in the middle renders: [1] ... [9] [10] [11] ... [20]
      expect(getPageButtons().map(b => b.textContent)).toEqual([
        "1",
        "9",
        "10",
        "11",
        "20",
      ])
      expect(screen.queryAllByTestId("stPaginationEllipsis")).toHaveLength(2)
    })

    it("collapses to maxVisible=2 layout when fittable count is 3 or 4", () => {
      mockContainerWidth(180)
      const props = getProps({ numPages: 20, default: 1, maxVisiblePages: 10 })
      render(<Pagination {...props} />)

      // maxVisible=2 with current=1 renders: [1] ... [20]
      expect(screen.queryAllByTestId("stPaginationEllipsis")).toHaveLength(1)
      expect(getPageButtons().map(b => b.textContent)).toEqual(["1", "20"])
    })

    it("shows only the current page when fittable count is 1 or 2", () => {
      mockContainerWidth(120)
      const props = getProps({ numPages: 20, default: 5, maxVisiblePages: 10 })
      render(<Pagination {...props} />)

      const pageButtons = getPageButtons()
      expect(pageButtons).toHaveLength(1)
      expect(pageButtons[0]).toHaveTextContent("5")
    })

    it("shows no page buttons when fittable count is zero", () => {
      mockContainerWidth(40)
      const props = getProps({ numPages: 20, default: 5, maxVisiblePages: 10 })
      render(<Pagination {...props} />)

      expect(getPageButtons()).toHaveLength(0)
      expect(getPrevButton()).toBeVisible()
      expect(getNextButton()).toBeVisible()
    })
  })

  describe("Widget state", () => {
    it("sets initial value on mount", () => {
      const props = getProps({ numPages: 10, default: 5 })
      vi.spyOn(props.widgetMgr, "setIntValue")

      render(<Pagination {...props} />)

      expect(props.widgetMgr.setIntValue).toHaveBeenCalledWith(
        props.element,
        5,
        { fromUi: false },
        undefined
      )
    })

    it("passes fragmentId to widgetMgr", async () => {
      const user = userEvent.setup()
      const props = getProps(
        { numPages: 5, default: 1 },
        { fragmentId: "test-fragment" }
      )
      vi.spyOn(props.widgetMgr, "setIntValue")

      render(<Pagination {...props} />)

      await user.click(getNextButton())

      expect(props.widgetMgr.setIntValue).toHaveBeenCalledWith(
        props.element,
        2,
        { fromUi: true },
        "test-fragment"
      )
    })
  })
})
