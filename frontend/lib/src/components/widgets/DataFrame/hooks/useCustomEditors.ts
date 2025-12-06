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

import { useCallback } from "react"

import {
  DataEditorProps,
  GridCell,
  GridCellKind,
  ProvideEditorCallback,
  ProvideEditorCallbackResult,
} from "@glideapps/glide-data-grid"
import { DatePickerType } from "@glideapps/glide-data-grid-cells"

import { isMaybeJson } from "~lib/components/widgets/DataFrame/columns"
import { DateTextCellEditor } from "~lib/components/widgets/DataFrame/columns/cells/DateTextCellEditor"
import { JsonTextCellEditor } from "~lib/components/widgets/DataFrame/columns/cells/JsonCell"

/**
 * Create return type for useCustomEditors hook based on the DataEditorProps.
 */
type CustomEditorsReturn = Pick<DataEditorProps, "provideEditor">

/**
 * Custom hook that creates some custom cell editors compatible with glide-data-grid.
 *
 * This adds support for:
 * - Showing a JSON viewer for text cells that contain JSON-compatible data
 * - Custom text input editor for DatePickerCell with custom date formats
 *
 * @returns An object containing the following properties:
 * - `provideEditor`: A function that can be passed to the `DataEditor` component.
 */
function useCustomEditors(): CustomEditorsReturn {
  const provideEditor: ProvideEditorCallback<GridCell> = useCallback(
    (cell: GridCell): ProvideEditorCallbackResult<GridCell> => {
      // Handle JSON text cells
      if (
        cell.kind === GridCellKind.Text &&
        cell.readonly &&
        isMaybeJson(cell.data)
      ) {
        return {
          editor: JsonTextCellEditor,
        } as ProvideEditorCallbackResult<GridCell>
      }

      // Handle DatePickerCell with custom formats
      if (
        cell.kind === GridCellKind.Custom &&
        (cell as DatePickerType).data?.kind === "date-picker-cell"
      ) {
        // Use custom editor if the cell has a userFormat (custom format)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userFormat = ((cell as DatePickerType).data as any)?.userFormat
        if (userFormat) {
          return {
            editor: DateTextCellEditor,
            // Type assertion: DateTextCellEditor is for DatePickerType, but we use it as GridCell editor
          } as unknown as ProvideEditorCallbackResult<GridCell>
        }
      }

      return undefined
    },
    []
  )

  return { provideEditor }
}

export default useCustomEditors
