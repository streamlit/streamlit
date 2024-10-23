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

import React from "react"

import {
  BaseDrawArgs,
  DataEditorProps,
  DrawCellCallback,
  drawTextCell,
  Theme as GlideTheme,
  Rectangle,
} from "@glideapps/glide-data-grid"
import {
  DatePickerCell,
  DropdownCell,
  MultiSelectCell,
  RangeCell,
  SparklineCell,
} from "@glideapps/glide-data-grid-cells"

import {
  BaseColumn,
  CustomCells,
  isMissingValueCell,
} from "@streamlit/lib/src/components/widgets/DataFrame/columns"

// Token used for missing values (null, NaN, etc.)
const NULL_VALUE_TOKEN = "None"

/**
 * Draw a red indicator in the top right corner of the cell
 * to indicate that the cell is required.
 */
export function drawRequiredIndicator(
  ctx: CanvasRenderingContext2D,
  rect: Rectangle,
  theme: GlideTheme
): void {
  ctx.save()
  ctx.beginPath()
  // We are first moving the drawing position under the top right corner
  // 8 pixels from left side (this is the size triangle)
  // and 1 pixel from top side (to be under the cell border).
  ctx.moveTo(rect.x + rect.width - 8, rect.y + 1)
  // We draw the first line to the top right corner.
  ctx.lineTo(rect.x + rect.width, rect.y + 1)
  // We draw the second line 8 pixel down on the right cell border
  ctx.lineTo(rect.x + rect.width, rect.y + 1 + 8)
  // And now its enough to just fill it with a color to get a triangle.
  ctx.fillStyle = theme.accentColor
  ctx.fill()
  ctx.restore()
}

/**
 * If a cell is marked as missing, we draw a placeholder symbol with a faded text color.
 */
export const drawMissingPlaceholder = (args: BaseDrawArgs): void => {
  const { cell, theme, ctx } = args
  drawTextCell(
    {
      ...args,
      theme: {
        ...theme,
        textDark: theme.textLight,
        headerFontFull: `${theme.headerFontStyle} ${theme.fontFamily}`,
        baseFontFull: `${theme.baseFontStyle} ${theme.fontFamily}`,
        markerFontFull: `${theme.markerFontStyle} ${theme.fontFamily}`,
      },
      // The following props are just added for technical reasons:
      // @ts-expect-error
      spriteManager: {},
      hyperWrapping: false,
    },
    NULL_VALUE_TOKEN,
    cell.contentAlign
  )
  // Reset fill style to the original one
  ctx.fillStyle = theme.textDark
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
 *
 * @returns An object containing the following properties:
 * - `drawCell`: A function that overwrites some rendering that can be
 *    passed to the `DataEditor` component.
 * - `customRenderers`: A map of custom cell renderers used by custom cells
 *    that can be passed to the `DataEditor` component.
 */
function useCustomRenderer(columns: BaseColumn[]): CustomRendererReturn {
  const drawCell: DrawCellCallback = React.useCallback(
    (args, draw) => {
      const { cell, theme, ctx, rect } = args
      const colPos = args.col
      if (isMissingValueCell(cell) && colPos < columns.length) {
        const column = columns[colPos]

        // We explicitly ignore some cell types here (e.g. checkbox, progress...) since
        // they are taking care of rendering their missing value state themselves (usually as empty cell).
        // All other cell types are rendered with a placeholder symbol and a faded text color via drawMissingPlaceholder.
        if (
          ["checkbox", "line_chart", "bar_chart", "progress"].includes(
            column.kind
          )
        ) {
          draw()
        } else {
          drawMissingPlaceholder(args as BaseDrawArgs)
        }

        if (column.isRequired && column.isEditable) {
          // If the cell value is missing, and it is configured as required & editable,
          // we draw a red indicator in the top right corner of the cell.
          drawRequiredIndicator(ctx, rect, theme)
        }
        return
      }
      draw()
    },
    [columns]
  )

  // Load extra cell renderers from the glide-data-grid-cells package:
  const customRenderers = React.useMemo(
    () =>
      [
        SparklineCell,
        DropdownCell,
        RangeCell,
        DatePickerCell,
        MultiSelectCell,
        ...CustomCells,
      ] as DataEditorProps["customRenderers"],
    // This doesn't change during the lifetime of the component,
    // so we can just run it once at creation time.
    /* eslint-disable react-hooks/exhaustive-deps */
    []
  )

  return {
    drawCell,
    customRenderers,
  }
}

export default useCustomRenderer
