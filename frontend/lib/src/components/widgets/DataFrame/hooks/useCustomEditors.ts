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

import { isMaybeJson } from "~lib/components/widgets/DataFrame/columns"
import { JsonTextCellEditor } from "~lib/components/widgets/DataFrame/columns/cells/JsonCell"

/**
 * Create return type for useCustomEditors hook based on the DataEditorProps.
 */
type CustomEditorsReturn = Pick<DataEditorProps, "provideEditor">

/**
 * Custom hook that creates some custom cell editors compatible with glide-data-grid.
 *
 * This adds support for showing a JSON viewer for text cells that contain JSON-compatible data.
 *
 * @returns An object containing the following properties:
 * - `provideEditor`: A function that can be passed to the `DataEditor` component.
 */
function useCustomEditors(): CustomEditorsReturn {
  const provideEditor: ProvideEditorCallback<GridCell> = useCallback(
    (cell: GridCell): ProvideEditorCallbackResult<GridCell> => {
      if (
        cell.kind === GridCellKind.Text &&
        cell.readonly &&
        isMaybeJson(cell.data)
      ) {
        return {
          editor: JsonTextCellEditor,
        } as ProvideEditorCallbackResult<GridCell>
      }
      return undefined
    },
    []
  )

  return { provideEditor }
}

export default useCustomEditors
