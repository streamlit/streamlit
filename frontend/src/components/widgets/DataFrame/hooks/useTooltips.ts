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

import {
  GridCell,
  DataEditorProps,
  GridMouseEventArgs,
} from "@glideapps/glide-data-grid"

import { notNullOrUndefined } from "src/lib/utils"
import {
  BaseColumn,
  hasTooltip,
} from "src/components/widgets/DataFrame/columns"

// Debounce time for triggering the tooltip on hover.
const DEBOUNCE_TIME_MS = 600

export type AutoSizerReturn = {
  onItemHovered: (item: any) => void
}

/**
 * Create return type for useDataLoader hook based on the DataEditorProps.
 */
type TooltipsReturn = {
  tooltip: { content: string; left: number; top: number } | undefined
  clearTooltip: () => void
} & Pick<DataEditorProps, "onItemHovered">

function useTooltips(
  columns: BaseColumn[],
  getCellContent: ([col, row]: readonly [number, number]) => GridCell
): TooltipsReturn {
  const [tooltip, setTooltip] = React.useState<
    { content: string; left: number; top: number } | undefined
  >()
  const timeoutRef = React.useRef<any>(null)

  const onItemHovered = React.useCallback(
    (args: GridMouseEventArgs) => {
      // Always reset the tooltips on any change here
      clearTimeout(timeoutRef.current)
      timeoutRef.current = 0
      setTooltip(undefined)

      if ((args.kind === "header" || args.kind === "cell") && args.location) {
        const colIdx = args.location[0]
        const rowIdx = args.location[1]
        let tooltipContent: string | undefined

        if (colIdx < 0) {
          // Ignore negative column index.
          // This is used for the row selection column.
          return
        }

        if (
          args.kind === "header" &&
          columns.length > colIdx &&
          notNullOrUndefined(columns[colIdx])
        ) {
          tooltipContent = columns[colIdx].help
        } else if (args.kind === "cell") {
          const cell = getCellContent([colIdx, rowIdx])
          // TODO: we need to ignore the last row if num_rows==dynamic
          // if (isMissingValueCell(cell)) {
          //   tooltipContent = "Please fill in this cell."
          // }
          // if (isErrorCell(cell)) {
          //   tooltipContent = cell.data
          // } else
          if (hasTooltip(cell)) {
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
    [columns, getCellContent, setTooltip, timeoutRef]
  )

  const clearTooltip = React.useCallback(() => {
    setTooltip(undefined)
  }, [setTooltip])

  return {
    tooltip,
    clearTooltip,
    onItemHovered,
  }
}

export default useTooltips
