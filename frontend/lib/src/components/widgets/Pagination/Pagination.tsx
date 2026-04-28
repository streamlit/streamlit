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
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import {
  type DOMRectKeys,
  useResizeObserver,
} from "~lib/hooks/useResizeObserver"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledPaginationButton,
  StyledPaginationContainer,
  StyledPaginationControls,
  StyledPaginationEllipsis,
} from "./styled-components"

export interface Props {
  disabled: boolean
  element: PaginationProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
  widthConfig: streamlit.IWidthConfig | undefined | null
}

export type PageItem =
  | {
      type: "page"
      page: number
    }
  | {
      type: "ellipsis"
      key: string
    }

const RESIZE_OBSERVER_PROPERTIES: DOMRectKeys[] = ["width"]
const ESTIMATED_PAGE_BUTTON_WIDTH = 48
const ESTIMATED_ARROW_BUTTONS_WIDTH = 80

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
  return element.value || getDefaultStateFromProto(element)
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

function clampPage(page: number, numPages: number): number {
  return Math.min(Math.max(page, 1), numPages)
}

function addEllipses(sortedPages: number[]): PageItem[] {
  const items: PageItem[] = []

  sortedPages.forEach((page, index) => {
    const previousPage = sortedPages[index - 1]
    if (previousPage !== undefined && page - previousPage > 1) {
      items.push({ type: "ellipsis", key: `${previousPage}-${page}` })
    }
    items.push({ type: "page", page })
  })

  return items
}

export function getPaginationItems({
  currentPage,
  maxVisiblePages,
  numPages,
}: {
  currentPage: number
  maxVisiblePages: number
  numPages: number
}): PageItem[] {
  if (maxVisiblePages <= 0) {
    return []
  }

  if (numPages <= maxVisiblePages) {
    return Array.from({ length: numPages }, (_, index) => ({
      type: "page",
      page: index + 1,
    }))
  }

  const pages = new Set<number>()
  pages.add(clampPage(currentPage, numPages))

  if (maxVisiblePages >= 2) {
    if (currentPage === numPages) {
      pages.add(1)
    } else {
      pages.add(numPages)
    }
  }

  if (maxVisiblePages >= 3) {
    pages.add(1)
    pages.add(numPages)
  }

  let offset = 1
  while (pages.size < maxVisiblePages) {
    const leftPage = currentPage - offset
    const rightPage = currentPage + offset
    let addedPage = false

    if (leftPage > 1) {
      pages.add(leftPage)
      addedPage = true
    }

    if (pages.size < maxVisiblePages && rightPage < numPages) {
      pages.add(rightPage)
      addedPage = true
    }

    if (!addedPage) {
      break
    }

    offset += 1
  }

  return addEllipses([...pages].sort((a, b) => a - b))
}

function getResponsiveMaxVisiblePages(
  width: number | undefined
): number | undefined {
  if (width === undefined || width <= 0) {
    return undefined
  }

  const availableWidth = width - ESTIMATED_ARROW_BUTTONS_WIDTH
  if (availableWidth <= 0) {
    return 0
  }

  return Math.floor(availableWidth / ESTIMATED_PAGE_BUTTON_WIDTH)
}

function Pagination(props: Readonly<Props>): ReactElement {
  const { disabled, element, fragmentId, widgetMgr, widthConfig } = props
  const numPages = element.numPages || 1

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

  const currentPage = clampPage(element.value || hookValue, numPages)
  const containerWidth = shouldWidthStretch(widthConfig)
  const { values, elementRef } = useResizeObserver<HTMLDivElement>(
    RESIZE_OBSERVER_PROPERTIES
  )

  const maxVisiblePages = useMemo(() => {
    const explicitMaxVisiblePages = element.maxVisiblePages ?? numPages
    const responsiveMaxVisiblePages = getResponsiveMaxVisiblePages(values[0])
    return Math.min(
      explicitMaxVisiblePages,
      responsiveMaxVisiblePages ?? explicitMaxVisiblePages
    )
  }, [element.maxVisiblePages, numPages, values])

  const pageItems = useMemo(
    () =>
      getPaginationItems({
        currentPage,
        maxVisiblePages,
        numPages,
      }),
    [currentPage, maxVisiblePages, numPages]
  )

  const handlePageSelect = useCallback(
    (page: number): void => {
      if (disabled || page === currentPage) {
        return
      }

      setValueWithSource({ value: page, fromUi: true })
    },
    [currentPage, disabled, setValueWithSource]
  )

  return (
    <StyledPaginationContainer
      ref={elementRef}
      className="stPagination"
      data-testid="stPagination"
      containerWidth={containerWidth}
    >
      <StyledPaginationControls aria-label="Pagination" role="navigation">
        <StyledPaginationButton
          type="button"
          aria-label="Previous page"
          disabled={disabled || currentPage === 1}
          onClick={() => handlePageSelect(currentPage - 1)}
          data-testid="stPaginationPrevious"
        >
          {"<"}
        </StyledPaginationButton>
        {pageItems.map(item =>
          item.type === "ellipsis" ? (
            <StyledPaginationEllipsis
              key={item.key}
              aria-hidden="true"
              data-testid="stPaginationEllipsis"
            >
              ...
            </StyledPaginationEllipsis>
          ) : (
            <StyledPaginationButton
              key={item.page}
              type="button"
              aria-current={item.page === currentPage ? "page" : undefined}
              aria-label={`Page ${item.page}`}
              isSelected={item.page === currentPage}
              disabled={disabled}
              onClick={() => handlePageSelect(item.page)}
              data-testid={
                item.page === currentPage
                  ? "stPaginationPageActive"
                  : "stPaginationPage"
              }
            >
              {item.page}
            </StyledPaginationButton>
          )
        )}
        <StyledPaginationButton
          type="button"
          aria-label="Next page"
          disabled={disabled || currentPage === numPages}
          onClick={() => handlePageSelect(currentPage + 1)}
          data-testid="stPaginationNext"
        >
          {">"}
        </StyledPaginationButton>
      </StyledPaginationControls>
    </StyledPaginationContainer>
  )
}

export default memo(Pagination)
