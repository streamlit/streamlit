/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
// TODO: Update to match React best practices
// eslint-disable-next-line react-hooks/react-compiler
/* eslint-disable react-hooks/exhaustive-deps */

import React, { useLayoutEffect, useState } from "react"

import { Size as ResizableSize } from "re-resizable"

import { Arrow as ArrowProto, streamlit } from "@streamlit/protobuf"

import {
  getConfiguredHeight,
  getConfiguredWidth,
  shouldUseContainerWidth,
  shouldUseContentWidth,
} from "~lib/components/widgets/DataFrame/arrowUtils"
import { notNullOrUndefined } from "~lib/util/utils"

import { CustomGridTheme } from "./useCustomTheme"

export type AutoSizerReturn = {
  // The minimum height that the data grid can be resized to
  minHeight: number
  // The maximum height of the data grid can be resized to
  maxHeight: number
  // The minimum width of the data grid can be resized to
  minWidth: number
  // The maximum width of the data grid can be resized to
  maxWidth: number
  // The row height of the data grid
  rowHeight: number
  // The current (or initial) size of the data grid
  resizableSize: ResizableSize
  // A callback function to change the size of the data grid.
  setResizableSize: React.Dispatch<React.SetStateAction<ResizableSize>>
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
 * @param widthConfig - The width configuration of the table
 * @param heightConfig - The height configuration of the table
 *
 * @returns The row height, min/max height & width, and the current size of the resizable container.
 */
function useTableSizer(
  element: ArrowProto,
  gridTheme: CustomGridTheme,
  numRows: number,
  usesGroupRow: boolean,
  containerWidth: number,
  containerHeight?: number,
  isFullScreen?: boolean,
  widthConfig?: streamlit.IWidthConfig | null,
  heightConfig?: streamlit.IHeightConfig | null
): AutoSizerReturn {
  const rowHeight = element.rowHeight ?? gridTheme.defaultRowHeight
  // Min height for the resizable table container:
  // Based on header + one column, and border threshold
  const minHeight =
    gridTheme.defaultHeaderHeight + rowHeight + 2 * gridTheme.tableBorderWidth

  // Group row + column header row
  const numHeaderRows = usesGroupRow ? 2 : 1
  const numTrailingRows =
    element.editingMode === ArrowProto.EditingMode.DYNAMIC ? 1 : 0
  // Calculate the maximum height of the table based on the number of rows:
  const totalDataRows = numRows + numTrailingRows
  let maxHeight = Math.max(
    totalDataRows * rowHeight +
      numHeaderRows * gridTheme.defaultHeaderHeight +
      2 * gridTheme.tableBorderWidth,
    minHeight
  )

  // The reason why we have initial height is that the table itself is
  // resizable by the user. So, it starts with initial height but can be
  // resized between min and max height.
  let initialHeight = Math.min(maxHeight, gridTheme.defaultTableHeight)

  const configuredHeight = getConfiguredHeight(element, heightConfig)

  if (configuredHeight) {
    // User has explicitly configured a height (integer value)
    initialHeight = Math.max(configuredHeight, minHeight)
    maxHeight = Math.max(configuredHeight, maxHeight)
  }
  // else: height="auto" (default) - use the default behavior (show at most 10 rows)

  if (containerHeight) {
    // If container height is set (e.g. when used in fullscreen)
    // The maxHeight and height should not be larger than container height
    initialHeight = Math.min(initialHeight, containerHeight)
    maxHeight = Math.min(maxHeight, containerHeight)

    if (!configuredHeight) {
      // If no explicit height is set, set height to max height (fullscreen mode)
      initialHeight = maxHeight
    }
  }

  // Min width for the resizable table container:
  // Based on one column at minimum width + borders
  const minWidth = gridTheme.minColumnWidth + 2 * gridTheme.tableBorderWidth
  // The available width should be at least the minimum table width
  // to prevent "maximum update depth exceeded" error. The reason
  // is that the container width can be -1 in some edge cases
  // caused by the resize observer in the Block component.
  // This can trigger the "maximum update depth exceeded" error
  // within the grid component.
  const availableWidth = Math.max(containerWidth, minWidth)

  // The initial width of the data grid.
  // If not set, the data grid will be auto adapted to its content.
  // The reason why we have initial width is that the data grid itself
  // is resizable by the user. It starts with initial width but can be
  // resized between min and max width.
  let initialWidth: number | undefined
  // The maximum width of the data grid can be resized to.
  let maxWidth = availableWidth

  const useContainerWidth = shouldUseContainerWidth(element, widthConfig)
  const configuredWidth = getConfiguredWidth(element, widthConfig)
  const useContentWidth = shouldUseContentWidth(widthConfig)

  if (useContainerWidth) {
    // If user has set use_container_width or width="stretch",
    // use the full container (available) width.
    initialWidth = availableWidth
  } else if (configuredWidth) {
    // The user has explicitly configured a width
    // use it but keep between the MIN_TABLE_WIDTH
    // and the available width.
    initialWidth = Math.min(
      Math.max(configuredWidth, minWidth),
      availableWidth
    )
    // Make sure that the max width we configure is between the user
    // configured width and the available (container) width.
    maxWidth = Math.min(Math.max(configuredWidth, maxWidth), availableWidth)
  } else if (useContentWidth) {
    // width="content" - let the table auto-size to its content
    initialWidth = undefined
  }

  const [resizableSize, setResizableSize] = useState<ResizableSize>({
    // If user hasn't specified a width via `width` or `use_container_width`,
    // we configure the table to 100%. Which will cause the data grid to
    // calculate the best size on the content and use that.
    width: initialWidth || "100%",
    height: initialHeight,
  })

  useLayoutEffect(() => {
    // This prevents weird table resizing behavior if the container width
    // changes and the table uses the full container width.
    if (useContainerWidth && resizableSize.width === "100%") {
      setResizableSize(prev => ({
        ...prev,
        width: availableWidth,
      }))
    }
  }, [availableWidth])

  // Reset the width if the element width parameter was changed:
  useLayoutEffect(() => {
    setResizableSize(prev => ({
      ...prev,
      width: initialWidth || "100%",
    }))
  }, [initialWidth])

  // Reset the height if the element height parameter was changed or
  // if the number of rows changes (e.g. via add_rows):
  useLayoutEffect(() => {
    setResizableSize(prev => ({
      ...prev,
      height: initialHeight,
    }))
  }, [initialHeight, numRows])

  // Change sizing if the fullscreen mode is activated or deactivated:
  useLayoutEffect(() => {
    if (isFullScreen) {
      const stretchColumns: boolean =
        useContainerWidth ||
        (notNullOrUndefined(configuredWidth) && configuredWidth > 0)
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
    minHeight,
    maxHeight,
    minWidth,
    maxWidth,
    rowHeight,
    resizableSize,
    setResizableSize,
  }
}

export default useTableSizer
