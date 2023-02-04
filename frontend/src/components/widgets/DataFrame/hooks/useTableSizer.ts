/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import React from "react"

import { Size as ResizableSize } from "re-resizable"

import { Arrow as ArrowProto } from "src/autogen/proto"
import { notNullOrUndefined } from "src/lib/utils"

const ROW_HEIGHT = 35
// Min width for the resizable table container:
// Based on one column at minimum width + 2 for borders + 1 to prevent overlap problem with selection ring.
const MIN_TABLE_WIDTH = 52
// Min height for the resizable table container:
// Based on header + one column, and + 2 for borders + 1 to prevent overlap problem with selection ring.
const MIN_TABLE_HEIGHT = 2 * ROW_HEIGHT + 3
const DEFAULT_TABLE_HEIGHT = 400

export type AutoSizerReturn = {
  rowHeight: number
  minHeight: number
  maxHeight: number
  minWidth: number
  maxWidth: number
  resizableSize: ResizableSize
  setResizableSize: React.Dispatch<React.SetStateAction<ResizableSize>>
}

export function calculateMaxHeight(numRows: number): number {
  // +2 pixels for borders
  return Math.max(numRows * ROW_HEIGHT + 1 + 2, MIN_TABLE_HEIGHT)
}
/**
 * A custom React hook that manages all aspects related to the size of the table.
 *
 * @param element - The ArrowProto element
 * @param numRows - The number of rows in the table
 * @param containerWidth - The width of the surrounding container
 * @param containerHeight - The height of the surrounding container
 * @param isFullScreen - Whether the table is in fullscreen mode
 *
 * @returns The row height, min/max height & width, and the current size of the resizable container.
 */
function useTableSizer(
  element: ArrowProto,
  numRows: number,
  containerWidth: number,
  containerHeight?: number,
  isFullScreen?: boolean
): AutoSizerReturn {
  let maxHeight = calculateMaxHeight(
    numRows +
      1 + // Column header row
      (element.editingMode === ArrowProto.EditingMode.DYNAMIC ? 1 : 0) // Trailing row
  )

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

  let initialWidth: number | undefined // If container width is undefined, auto set based on column widths
  let maxWidth = containerWidth

  if (element.useContainerWidth) {
    // Always use the full container width
    initialWidth = containerWidth
  } else if (element.width) {
    // User has explicitly configured a width
    initialWidth = Math.min(
      Math.max(element.width, MIN_TABLE_WIDTH),
      containerWidth
    )
    maxWidth = Math.min(Math.max(element.width, maxWidth), containerWidth)
  }

  const [resizableSize, setResizableSize] = React.useState<ResizableSize>({
    width: initialWidth || "100%",
    height: initialHeight,
  })

  React.useLayoutEffect(() => {
    // This prevents weird table resizing behavior if the container width
    // changes and the table uses the full container width.
    if (element.useContainerWidth && resizableSize.width === "100%") {
      setResizableSize({
        width: containerWidth,
        height: resizableSize.height,
      })
    }
  }, [containerWidth])

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
    rowHeight: ROW_HEIGHT,
    minHeight: MIN_TABLE_HEIGHT,
    maxHeight,
    minWidth: MIN_TABLE_WIDTH,
    maxWidth,
    resizableSize,
    setResizableSize,
  }
}

export default useTableSizer
