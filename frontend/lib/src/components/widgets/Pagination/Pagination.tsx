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

import { memo, ReactElement, useCallback, useMemo } from "react"

import { Pagination as PaginationProto, streamlit } from "@streamlit/protobuf"

import { shouldWidthStretch } from "~lib/components/core/Layout/utils"
import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useResizeObserver } from "~lib/hooks/useResizeObserver"
import { convertRemToPx } from "~lib/theme/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledArrowButton,
  StyledEllipsis,
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

/**
 * Default cap when max_visible_pages=None from Python to prevent rendering
 * a huge number of buttons on first paint before responsive sizing kicks in.
 */
const DEFAULT_MAX_VISIBLE_FALLBACK = 50

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

  // All pages fit - no ellipsis needed (must be checked before maxVisible=2/3 special cases)
  if (numPages <= maxVisible) {
    return Array.from({ length: numPages }, (_, i) => pageItem(i + 1))
  }

  // Show current and last (or first and last if current is at edge)
  if (maxVisible === 2) {
    if (currentPage === 1) {
      return [pageItem(1), ellipsisItem("end"), pageItem(numPages)]
    }
    if (currentPage === numPages) {
      return [pageItem(1), ellipsisItem("start"), pageItem(numPages)]
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
  // When max_visible_pages=None from Python, the proto field is unset.
  // Use numPages as the target so all pages are eligible to be shown.
  // The responsive sizing will still constrain based on container width.
  const maxVisiblePages = element.maxVisiblePages ?? numPages

  const theme = useEmotionTheme()

  // Derive pixel constants from theme for accurate responsive sizing under custom rem/zoom
  // Button width: theme.spacing.threeXL (32px) + theme.spacing.twoXS (4px gap) = 36px effective
  // Arrow width: 2 * theme.spacing.threeXL (32px) + theme.spacing.twoXS (4px gap) = 68px
  const buttonWidthPx = useMemo(
    () =>
      convertRemToPx(theme.spacing.threeXL) +
      convertRemToPx(theme.spacing.twoXS),
    [theme.spacing.threeXL, theme.spacing.twoXS]
  )
  const arrowsWidthPx = useMemo(
    () =>
      2 * convertRemToPx(theme.spacing.threeXL) +
      convertRemToPx(theme.spacing.twoXS),
    [theme.spacing.threeXL, theme.spacing.twoXS]
  )

  // Query param binding for URL synchronization
  const queryParamBinding = element.queryParamKey
    ? {
        paramKey: element.queryParamKey,
        valueType: "int_value" as const,
        clearable: false,
      }
    : undefined

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
    queryParamBinding,
  })

  // Use element.value as source of truth when set_value is true.
  // Clamp to valid bounds [1, numPages] to handle cases where num_pages changed.
  const rawPage = element.setValue ? element.value : hookValue
  const currentPage = Math.min(numPages, Math.max(1, rawPage))

  const shouldStretch = shouldWidthStretch(widthConfig)

  // Responsive behavior: track container width and derive effective max visible pages
  // Memoize the properties array to prevent useResizeObserver from re-running on every render
  const widthProperties = useMemo<["width"]>(() => ["width"], [])
  const { values: containerDimensions, elementRef: containerRef } =
    useResizeObserver<HTMLDivElement>(widthProperties)
  const containerWidth = containerDimensions[0] ?? 0

  // Derive effective max visible pages from container width and maxVisiblePages
  const effectiveMaxVisible = useMemo(() => {
    if (containerWidth === 0) {
      // Initial render before measurement - use bounded fallback
      return Math.min(maxVisiblePages, DEFAULT_MAX_VISIBLE_FALLBACK)
    }
    const availableForPages = containerWidth - arrowsWidthPx
    const maxFittable = Math.max(
      0,
      Math.floor(availableForPages / buttonWidthPx)
    )
    const capped = Math.min(maxVisiblePages, maxFittable)

    // For small maxFittable values (3 or 4), the calculateVisiblePages algorithm
    // may return 5 items due to the maxVisible=3 special case (first/last/current
    // plus ellipses). Map these to safe values to prevent overflow/wrapping.
    if (capped >= 5) {
      return capped
    }
    // maxFittable 3 or 4: use maxVisible=2 which shows 3 items (current/last + ellipsis)
    if (capped >= 3) {
      return 2
    }
    // maxFittable 1 or 2: show only current page or nothing
    return capped >= 1 ? 1 : 0
  }, [containerWidth, maxVisiblePages, arrowsWidthPx, buttonWidthPx])

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
      shouldStretch={shouldStretch}
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
              <StyledEllipsis
                key={`ellipsis-${item.position}`}
                aria-hidden="true"
                data-testid="stPaginationEllipsis"
              >
                &hellip;
              </StyledEllipsis>
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
