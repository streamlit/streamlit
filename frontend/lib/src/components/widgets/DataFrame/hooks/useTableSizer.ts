/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

// TODO: fix incorrect hook usage and delete this lint suppression
/* eslint-disable react-hooks/exhaustive-deps */

import React from "react"

import { Size as ResizableSize } from "re-resizable"

import { Arrow as ArrowProto } from "@streamlit/lib/src/proto"
import { notNullOrUndefined } from "@streamlit/lib/src/util/utils"

// Min column width used for manual and automatic resizing
export const MIN_COLUMN_WIDTH = 50
// Max column width used for manual resizing
export const MAX_COLUMN_WIDTH = 1000
// Max column width used for automatic column sizing
export const MAX_COLUMN_AUTO_WIDTH = 500
// The border size in pixels (2)
// to prevent overlap problem with selection ring.
export const BORDER_THRESHOLD = 2
// The default row height in pixels
export const ROW_HEIGHT = 35
// Min width for the resizable table container:
// Based on one column at minimum width + borders
export const MIN_TABLE_WIDTH = MIN_COLUMN_WIDTH + BORDER_THRESHOLD
// Min height for the resizable table container:
// Based on header + one column, and border threshold
const MIN_TABLE_HEIGHT = 2 * ROW_HEIGHT + BORDER_THRESHOLD
// The default maximum height of the table:
const DEFAULT_TABLE_HEIGHT = 400

export type AutoSizerReturn = {
  // The minimum height that the data grid can be resized to
  minHeight: number
  // The maximum height of the data grid can be resized to
  maxHeight: number
  // The minimum width of the data grid can be resized to
  minWidth: number
  // The maximum width of the data grid can be resized to
  maxWidth: number
  // The current (or initial) size of the data grid
  resizableSize: ResizableSize
  // A callback function to change the size of the data grid.
  setResizableSize: React.Dispatch<React.SetStateAction<ResizableSize>>
}

export function calculateMaxHeight(numRows: number): number {
  return Math.max(numRows * ROW_HEIGHT + BORDER_THRESHOLD, MIN_TABLE_HEIGHT)
}
/**
 * A custom React hook that manages all aspects related to the size of the table.
 *
 * @param element - The ArrowProto element
 * @param numRows - The number of rows in the table
 * @param usesGroupRow - Whether the table uses a group row to display multiple column headers.
 * @param containerWidth - The width of the surrounding container
 * @param containerHeight - The height of the surrounding container
 * @param isFullScreen - Whether the table is in fullscreen mode
 *
 * @returns The row height, min/max height & width, and the current size of the resizable container.
 */
function useTableSizer(
  element: ArrowProto,
  numRows: number,
  usesGroupRow: boolean,
  containerWidth: number,
  containerHeight?: number,
  isFullScreen?: boolean
): AutoSizerReturn {
  // Group row + column header row
  const numHeaderRows = usesGroupRow ? 2 : 1
  const numTrailingRows =
    element.editingMode === ArrowProto.EditingMode.DYNAMIC ? 1 : 0
  // Calculate the maximum height of the table based on the number of rows:
  let maxHeight = calculateMaxHeight(numRows + numHeaderRows + numTrailingRows)

  // The initial height is either the default table height or the maximum
  // (full) height based if its smaller than the default table height.
  // The reason why we have initial height is that the table itself is
  // resizable by the user. So, it starts with initial height but can be
  // resized between min and max height.
  let initialHeight = Math.min(maxHeight, DEFAULT_TABLE_HEIGHT)

  if (element.height) {
    // User has explicitly configured a height
    initialHeight = Math.max(element.height, MIN_TABLE_HEIGHT)
    maxHeight = Math.max(element.height, maxHeight)
  }

  if (containerHeight) {
    // If container height is set (e.g. when used in fullscreen)
    // The maxHeight and height should not be larger than container height
    initialHeight = Math.min(initialHeight, containerHeight)
    maxHeight = Math.min(maxHeight, containerHeight)

    if (!element.height) {
      // If no explicit height is set, set height to max height (fullscreen mode)
      initialHeight = maxHeight
    }
  }

  // The available width should be at least the minimum table width
  // to prevent "maximum update depth exceeded" error. The reason
  // is that the container width can be -1 in some edge cases
  // caused by the resize observer in the Block component.
  // This can trigger the "maximum update depth exceeded" error
  // within the grid component.
  const availableWidth = Math.max(containerWidth, MIN_TABLE_WIDTH)

  // The initial width of the data grid.
  // If not set, the data grid will be auto adapted to its content.
  // The reason why we have initial width is that the data grid itself
  // is resizable by the user. It starts with initial width but can be
  // resized between min and max width.
  let initialWidth: number | undefined
  // The maximum width of the data grid can be resized to.
  let maxWidth = availableWidth

  if (element.useContainerWidth) {
    // If user has set use_container_width,
    // use the full container (available) width.
    initialWidth = availableWidth
  } else if (element.width) {
    // The user has explicitly configured a width
    // use it but keep between the MIN_TABLE_WIDTH
    // and the available width.
    initialWidth = Math.min(
      Math.max(element.width, MIN_TABLE_WIDTH),
      availableWidth
    )
    // Make sure that the max width we configure is between the user
    // configured width and the available (container) width.
    maxWidth = Math.min(Math.max(element.width, maxWidth), availableWidth)
  }

  const [resizableSize, setResizableSize] = React.useState<ResizableSize>({
    // If user hasn't specified a width via `width` or `use_container_width`,
    // we configure the table to 100%. Which will cause the data grid to
    // calculate the best size on the content and use that.
    width: initialWidth || "100%",
    height: initialHeight,
  })

  React.useLayoutEffect(() => {
    // This prevents weird table resizing behavior if the container width
    // changes and the table uses the full container width.
    if (element.useContainerWidth && resizableSize.width === "100%") {
      setResizableSize({
        width: availableWidth,
        height: resizableSize.height,
      })
    }
  }, [availableWidth])

  // Reset the height if the number of rows changes (e.g. via add_rows):
  React.useLayoutEffect(() => {
    setResizableSize({
      width: resizableSize.width,
      height: initialHeight,
    })
  }, [numRows])

  // Reset the width if the element width parameter was changed:
  React.useLayoutEffect(() => {
    setResizableSize({
      width: initialWidth || "100%",
      height: resizableSize.height,
    })
  }, [initialWidth])

  // Reset the height if the element height parameter was changed:
  React.useLayoutEffect(() => {
    setResizableSize({
      width: resizableSize.width,
      height: initialHeight,
    })
  }, [initialHeight])

  // Change sizing if the fullscreen mode is activated or deactivated:
  React.useLayoutEffect(() => {
    if (isFullScreen) {
      const stretchColumns: boolean =
        element.useContainerWidth ||
        (notNullOrUndefined(element.width) && element.width > 0)
      setResizableSize({
        width: stretchColumns ? maxWidth : "100%",
        height: maxHeight,
      })
    } else {
      setResizableSize({
        width: initialWidth || "100%",
        height: initialHeight,
      })
    }
  }, [isFullScreen])

  return {
    minHeight: MIN_TABLE_HEIGHT,
    maxHeight,
    minWidth: MIN_TABLE_WIDTH,
    maxWidth,
    resizableSize,
    setResizableSize,
  }
}

export default useTableSizer
