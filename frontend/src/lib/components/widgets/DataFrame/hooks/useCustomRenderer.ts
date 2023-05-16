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
 * Create return type for useCustomRenderer hook based on the DataEditorProps.
 */
type CustomRendererReturn = Pick<
  DataEditorProps,
  "drawCell" | "customRenderers"
>

function useCustomRenderer(columns: BaseColumn[]): CustomRendererReturn {
  const extraCellArgs = useExtraCells()

  /**
   * If a cell is marked as missing, we draw a placeholder symbol with a faded text color.
   * This is done by providing a custom cell renderer.
   */
  const drawCell: DrawCustomCellCallback = React.useCallback(args => {
    const { cell, theme } = args
    if (isMissingValueCell(cell)) {
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
      return true
    }

    return false
  }, [])

  return {
    drawCell,
    customRenderers: [...extraCellArgs.customRenderers, ...CustomCells],
  }
}

export default useCustomRenderer
