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

import { useCallback, useRef, useState } from "react"

import {
  DataEditorProps,
  GridCell,
  GridMouseEventArgs,
} from "@glideapps/glide-data-grid"

import {
  BaseColumn,
  hasTooltip,
  isErrorCell,
  isMissingValueCell,
} from "~lib/components/widgets/DataFrame/columns"
import { notNullOrUndefined } from "~lib/util/utils"

// Debounce time for triggering the tooltip on hover.
export const DEBOUNCE_TIME_MS = 600
// Tooltip message for required cells that are empty.
export const REQUIRED_CELL_TOOLTIP = "⚠️ Please fill out this cell."

export type TooltipsReturn = {
  // The tooltip to show (if any):
  tooltip: { content: string; left: number; top: number } | undefined
  // A callback to clear the tooltip:
  clearTooltip: () => void
  // The glide-data-grid function that is called when a cell is hovered:
} & Pick<DataEditorProps, "onItemHovered">

/**
 * Hook that can show a tooltip when hovering over a cell or header if configured.
 *
 * The tooltip is shown after a delay, and is cleared when the user clicks outside,
 * fires escape, or moves outside of the target cell.
 *
 * @param columns columns of the datagrid
 * @param getCellContent function that returns the cell content for a given cell position
 * @param ignoredRowIndices array of row indices to ignore when showing tooltips.
 * @returns the tooltip to show (if any), a callback to clear the tooltip, and the
 * onItemHovered callback to pass to the datagrid
 */
function useTooltips(
  columns: BaseColumn[],
  getCellContent: ([col, row]: readonly [number, number]) => GridCell,
  ignoredRowIndices: number[] = []
): TooltipsReturn {
  const [tooltip, setTooltip] = useState<
    { content: string; left: number; top: number } | undefined
  >()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  const timeoutRef = useRef<any>(null)

  const onItemHovered = useCallback(
    (args: GridMouseEventArgs) => {
      // Always reset the tooltips on any change here
      clearTimeout(timeoutRef.current)
      timeoutRef.current = 0
      setTooltip(undefined)

      if ((args.kind === "header" || args.kind === "cell") && args.location) {
        const colIdx = args.location[0]
        const rowIdx = args.location[1]
        let tooltipContent: string | undefined

        if (colIdx < 0 || colIdx >= columns.length) {
          // Ignore negative column index (Row index column)
          // and column index that is out of bounds
          return
        }

        if (ignoredRowIndices.includes(rowIdx)) {
          // Ignore the row if it is in the configured ignoredRowIndices array.
          return
        }

        const column = columns[colIdx]

        if (args.kind === "header" && notNullOrUndefined(column)) {
          tooltipContent = column.help
        } else if (args.kind === "cell") {
          const cell = getCellContent([colIdx, rowIdx])

          if (isErrorCell(cell)) {
            // If the cell is an error cell, we don't need to check for required or missing values.
            tooltipContent = cell.errorDetails
          } else if (
            column.isRequired &&
            column.isEditable &&
            isMissingValueCell(cell)
          ) {
            tooltipContent = REQUIRED_CELL_TOOLTIP
          } else if (hasTooltip(cell)) {
            tooltipContent = cell.tooltip
          }
        }

        if (tooltipContent) {
          timeoutRef.current = setTimeout(() => {
            if (tooltipContent) {
              setTooltip({
                content: tooltipContent,
                left: args.bounds.x + args.bounds.width / 2,
                top: args.bounds.y,
              })
            }
          }, DEBOUNCE_TIME_MS)
        }
      }
    },
    [columns, getCellContent, setTooltip, timeoutRef, ignoredRowIndices]
  )

  const clearTooltip = useCallback(() => {
    setTooltip(undefined)
  }, [setTooltip])

  return {
    tooltip,
    clearTooltip,
    onItemHovered,
  }
}

export default useTooltips
