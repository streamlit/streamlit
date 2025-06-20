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

import { useCallback, useState } from "react"

import {
  DataEditorProps,
  GetRowThemeCallback,
  GridMouseEventArgs,
} from "@glideapps/glide-data-grid"

import { CustomGridTheme } from "./useCustomTheme"

type RowHoverReturn = Pick<
  DataEditorProps,
  "onItemHovered" | "getRowThemeOverride"
>

/**
 * Hook to enable highlighting (via different background color) the row when hovering
 * over a cell in the row.
 *
 * @param gridTheme - The custom theme configuration.
 *
 * @returns An object containing the following properties:
 * - onItemHovered: The glide-data-grid compatible callback function to be called when a cell is hovered.
 * - getRowThemeOverride: The glide-data-grid compatible callback function to be called to
 *   get the theme override for a row.
 */
function useRowHover(gridTheme: CustomGridTheme): RowHoverReturn {
  const [hoverRow, setHoverRow] = useState<number | undefined>(undefined)

  const onItemHovered = useCallback(
    (args: GridMouseEventArgs) => {
      if (args.kind !== "cell") {
        // Clear row hovering state if the event indicates that
        // the mouse is not anymore hovering a cell
        setHoverRow(undefined)
      } else {
        const [, row] = args.location
        setHoverRow(row)
      }
    },
    [setHoverRow]
  )

  const getRowThemeOverride = useCallback<GetRowThemeCallback>(
    row => {
      if (row !== hoverRow) {
        return undefined
      }
      return {
        bgCell: gridTheme.bgRowHovered,
        bgCellMedium: gridTheme.bgRowHovered,
      }
    },
    [gridTheme.bgRowHovered, hoverRow]
  )

  return { getRowThemeOverride, onItemHovered }
}

export default useRowHover
