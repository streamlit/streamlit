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

import {
  memo,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { Pagination as PaginationProto, streamlit } from "@streamlit/protobuf"

import { shouldWidthStretch } from "~lib/components/core/Layout/utils"
import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledArrowButton,
  StyledPaginationButton,
  StyledPaginationButtonGroup,
  StyledPaginationContainer,
} from "./styled-components"

export interface Props {
  disabled: boolean
  element: PaginationProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
  widthConfig: streamlit.IWidthConfig | undefined | null
}

type PageItem =
  | { type: "page"; page: number }
  | { type: "ellipsis"; position: "start" | "end" }

/** Helper to create a page item. */
const pageItem = (page: number): PageItem => ({ type: "page", page })

/** Helper to create an ellipsis item. */
const ellipsisItem = (position: "start" | "end"): PageItem => ({
  type: "ellipsis",
  position,
})

/**
 * Calculate which pages to show based on current page, total pages, and max visible.
 * Returns an array of page numbers and "ellipsis" markers.
 */
function calculateVisiblePages(
  currentPage: number,
  numPages: number,
  maxVisible: number
): PageItem[] {
  // Show only arrows (no page numbers)
  if (maxVisible === 0) {
    return []
  }

  // Show only current page
  if (maxVisible === 1) {
    return [pageItem(currentPage)]
  }

  // Show current and last (or first and last if current is at edge)
  if (maxVisible === 2) {
    if (currentPage === 1) {
      return numPages > 1
        ? [pageItem(1), ellipsisItem("end"), pageItem(numPages)]
        : [pageItem(1)]
    }
    if (currentPage === numPages) {
      return numPages > 1
        ? [pageItem(1), ellipsisItem("start"), pageItem(numPages)]
        : [pageItem(1)]
    }
    // Current is in middle - show current and last
    return [pageItem(currentPage), ellipsisItem("end"), pageItem(numPages)]
  }

  // maxVisible=3 with consistent width (always 5 items total)
  if (maxVisible === 3 && numPages > 4) {
    if (currentPage <= 3) {
      // Near start: [1] [2] [3] ... [last]
      return [
        pageItem(1),
        pageItem(2),
        pageItem(3),
        ellipsisItem("end"),
        pageItem(numPages),
      ]
    }
    if (currentPage >= numPages - 2) {
      // Near end: [1] ... [last-2] [last-1] [last]
      return [
        pageItem(1),
        ellipsisItem("start"),
        pageItem(numPages - 2),
        pageItem(numPages - 1),
        pageItem(numPages),
      ]
    }
    // Middle: [1] ... [current] ... [last]
    return [
      pageItem(1),
      ellipsisItem("start"),
      pageItem(currentPage),
      ellipsisItem("end"),
      pageItem(numPages),
    ]
  }

  // All pages fit
  if (numPages <= maxVisible) {
    return Array.from({ length: numPages }, (_, i) => pageItem(i + 1))
  }

  // For maxVisible >= 3: always show first, last, and current page
  // With ellipses as needed
  const pages: PageItem[] = []

  // Determine if we need ellipses
  const needLeftEllipsis = currentPage > 3
  const needRightEllipsis = currentPage < numPages - 2

  // Calculate how many middle slots we have (excluding first, last, and ellipses)
  const ellipsisCount =
    (needLeftEllipsis ? 1 : 0) + (needRightEllipsis ? 1 : 0)
  const middleSlots = Math.max(1, maxVisible - 2 - ellipsisCount)

  // Always show first page
  pages.push(pageItem(1))

  if (needLeftEllipsis) {
    pages.push(ellipsisItem("start"))
  }

  // Calculate the range of middle pages, ensuring current page is included
  let middleStart: number
  let middleEnd: number

  if (!needLeftEllipsis) {
    // Near the start: show pages 2, 3, ... ensuring current is included
    middleStart = 2
    middleEnd = Math.max(
      currentPage,
      Math.min(numPages - 1, 2 + middleSlots - 1)
    )
    // Adjust if we have more slots
    if (middleEnd - middleStart + 1 < middleSlots) {
      middleEnd = Math.min(numPages - 1, middleStart + middleSlots - 1)
    }
  } else if (!needRightEllipsis) {
    // Near the end: show pages before last, ensuring current is included
    middleEnd = numPages - 1
    middleStart = Math.min(currentPage, Math.max(2, numPages - middleSlots))
    // Adjust if we have more slots
    if (middleEnd - middleStart + 1 < middleSlots) {
      middleStart = Math.max(2, middleEnd - middleSlots + 1)
    }
  } else {
    // In the middle: center around current page
    const half = Math.floor((middleSlots - 1) / 2)
    middleStart = Math.max(2, currentPage - half)
    middleEnd = Math.min(numPages - 1, middleStart + middleSlots - 1)
    // Adjust if we hit bounds
    if (middleEnd === numPages - 1) {
      middleStart = Math.max(2, middleEnd - middleSlots + 1)
    }
    if (middleStart === 2) {
      middleEnd = Math.min(numPages - 1, middleStart + middleSlots - 1)
    }
  }

  // Add middle pages
  for (let i = middleStart; i <= middleEnd; i++) {
    pages.push(pageItem(i))
  }

  if (needRightEllipsis) {
    pages.push(ellipsisItem("end"))
  }

  // Always show last page
  if (numPages > 1) {
    pages.push(pageItem(numPages))
  }

  return pages
}

function getStateFromWidgetMgr(
  widgetMgr: WidgetStateManager,
  element: PaginationProto
): number | undefined {
  return widgetMgr.getIntValue(element)
}

function getDefaultStateFromProto(element: PaginationProto): number {
  return element.default || 1
}

function getCurrStateFromProto(element: PaginationProto): number {
  // When setValue is true, element.value contains the current page
  return element.value || element.default || 1
}

function updateWidgetMgrState(
  element: PaginationProto,
  widgetMgr: WidgetStateManager,
  valueWithSource: ValueWithSource<number>,
  fragmentId: string | undefined
): void {
  widgetMgr.setIntValue(
    element,
    valueWithSource.value,
    { fromUi: valueWithSource.fromUi },
    fragmentId
  )
}

function Pagination(props: Readonly<Props>): ReactElement {
  const { disabled, element, fragmentId, widgetMgr, widthConfig } = props
  const { numPages } = element
  const maxVisiblePages = element.maxVisiblePages ?? 7

  const [hookValue, setValueWithSource] = useBasicWidgetState<
    number,
    PaginationProto
  >({
    getStateFromWidgetMgr,
    getDefaultStateFromProto,
    getCurrStateFromProto,
    updateWidgetMgrState,
    element,
    widgetMgr,
    fragmentId,
    formClearBehavior: "resetValueOnly",
  })

  // Use element.value as source of truth when set_value is true
  const currentPage = element.setValue ? element.value : hookValue

  const containerWidth = shouldWidthStretch(widthConfig)

  // Responsive behavior: track container width and reduce visible pages if needed
  const containerRef = useRef<HTMLDivElement>(null)
  const [effectiveMaxVisible, setEffectiveMaxVisible] =
    useState(maxVisiblePages)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (!entry) return

      const availableWidth = entry.contentRect.width
      // Each button is roughly 32px + 4px gap = 36px
      // Arrows take 2 * 32px = 64px
      const buttonWidth = 36
      const arrowsWidth = 64
      const availableForPages = availableWidth - arrowsWidth
      const maxFittable = Math.max(
        0,
        Math.floor(availableForPages / buttonWidth)
      )
      setEffectiveMaxVisible(Math.min(maxVisiblePages, maxFittable))
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [maxVisiblePages])

  const visiblePages = useMemo(
    () => calculateVisiblePages(currentPage, numPages, effectiveMaxVisible),
    [currentPage, numPages, effectiveMaxVisible]
  )

  const handlePageClick = useCallback(
    (page: number): void => {
      if (page >= 1 && page <= numPages && page !== currentPage) {
        setValueWithSource({ value: page, fromUi: true })
      }
    },
    [currentPage, numPages, setValueWithSource]
  )

  const handlePrevClick = useCallback((): void => {
    if (currentPage > 1) {
      setValueWithSource({ value: currentPage - 1, fromUi: true })
    }
  }, [currentPage, setValueWithSource])

  const handleNextClick = useCallback((): void => {
    if (currentPage < numPages) {
      setValueWithSource({ value: currentPage + 1, fromUi: true })
    }
  }, [currentPage, numPages, setValueWithSource])

  const isPrevDisabled = disabled || currentPage === 1
  const isNextDisabled = disabled || currentPage === numPages

  return (
    <StyledPaginationContainer
      ref={containerRef}
      className="stPagination"
      data-testid="stPagination"
      containerWidth={containerWidth}
    >
      <StyledPaginationButtonGroup role="navigation" aria-label="Pagination">
        {/* Previous button */}
        <StyledArrowButton
          type="button"
          onClick={handlePrevClick}
          disabled={isPrevDisabled}
          aria-label="Previous page"
          data-testid="stPaginationPrev"
        >
          <DynamicIcon iconValue=":material/chevron_left:" size="lg" />
        </StyledArrowButton>

        {/* Page buttons */}
        {visiblePages.map(item => {
          if (item.type === "ellipsis") {
            return (
              <StyledPaginationButton
                key={`ellipsis-${item.position}`}
                type="button"
                isEllipsis
                disabled={disabled}
                aria-hidden="true"
                tabIndex={-1}
                data-testid="stPaginationEllipsis"
              >
                &hellip;
              </StyledPaginationButton>
            )
          }

          const isSelected = item.page === currentPage
          return (
            <StyledPaginationButton
              key={item.page}
              type="button"
              isSelected={isSelected}
              disabled={disabled}
              onClick={() => handlePageClick(item.page)}
              aria-label={`Page ${item.page}`}
              aria-current={isSelected ? "page" : undefined}
              data-testid={
                isSelected ? "stPaginationPageActive" : "stPaginationPage"
              }
            >
              {item.page}
            </StyledPaginationButton>
          )
        })}

        {/* Next button */}
        <StyledArrowButton
          type="button"
          onClick={handleNextClick}
          disabled={isNextDisabled}
          aria-label="Next page"
          data-testid="stPaginationNext"
        >
          <DynamicIcon iconValue=":material/chevron_right:" size="lg" />
        </StyledArrowButton>
      </StyledPaginationButtonGroup>
    </StyledPaginationContainer>
  )
}

export default memo(Pagination)
