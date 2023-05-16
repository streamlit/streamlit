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
  DataEditorProps,
  DrawCustomCellCallback,
  Rectangle,
  Theme as GlideTheme,
  drawTextCell,
} from "@glideapps/glide-data-grid"
import { useExtraCells } from "@glideapps/glide-data-grid-cells"

import {
  BaseColumn,
  CustomCells,
  isMissingValueCell,
} from "src/lib/components/widgets/DataFrame/columns"

// Token used for missing values (null, NaN, etc.)
const NULL_VALUE_TOKEN = "None"

/**
 * Draw a red indicator in the top right corner of the cell
 * to indicate that the cell is required.
 */
function drawRequiredIndicator(
  ctx: CanvasRenderingContext2D,
  rect: Rectangle,
  theme: GlideTheme
): void {
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(rect.x + rect.width - 8, rect.y + 1)
  ctx.lineTo(rect.x + rect.width, rect.y + 1)
  ctx.lineTo(rect.x + rect.width, rect.y + 1 + 8)
  ctx.fillStyle = theme.accentColor
  ctx.fill()
  ctx.restore()
}

/**
 * Create return type for useCustomRenderer hook based on the DataEditorProps.
 */
type CustomRendererReturn = Pick<
  DataEditorProps,
  "drawCell" | "customRenderers"
>

/**
 * Custom hook that creates some custom cell renderers compatible with glide-data-grid.
 *
 * This includes capabilities like showing a faded placeholder for missing values or
 * a red indicator for required cells.
 *
 * @param columns - The columns of the table.
 * @param hasSelectionRow - Whether the table has the selection row activated (e.g. for dynamic editing).
 *
 * @returns An object containing the following properties:
 * - `drawCell`: A function that overwrites some rendering that can be
 *    passed to the `DataEditor` component.
 * - `customRenderers`: A map of custom cell renderers used by custom cells
 *    that can be passed to the `DataEditor` component.
 */
function useCustomRenderer(
  columns: BaseColumn[],
  hasSelectionRow: boolean
): CustomRendererReturn {
  const drawCell: DrawCustomCellCallback = React.useCallback(
    args => {
      const { cell, theme, ctx, rect } = args
      const colPos = hasSelectionRow ? args.col - 1 : args.col
      if (isMissingValueCell(cell) && colPos < columns.length) {
        const column = columns[colPos]
        /**
         * If a cell is marked as missing, we draw a placeholder symbol with a faded text color.
         * This is done by providing a custom cell renderer.
         */
        drawTextCell(
          {
            ...args,
            theme: {
              ...theme,
              textDark: theme.textLight,
              textMedium: theme.textLight,
            },
            // The following props are just added for technical reasons:
            // @ts-expect-error
            spriteManager: {},
            hyperWrapping: false,
          },
          NULL_VALUE_TOKEN,
          cell.contentAlign
        )

        if (column.isRequired && column.isEditable) {
          // If the cell value is missing, and it is configured as required & editable,
          // we draw a red indicator in the top right corner of the cell.
          drawRequiredIndicator(ctx, rect, theme)
        }

        return true
      }

      return false
    },
    [columns, hasSelectionRow]
  )

  // Load extra cell renderers from the glide-data-grid-cells package:
  const extraCellArgs = useExtraCells()

  return {
    drawCell,
    customRenderers: [...extraCellArgs.customRenderers, ...CustomCells],
  }
}

export default useCustomRenderer
