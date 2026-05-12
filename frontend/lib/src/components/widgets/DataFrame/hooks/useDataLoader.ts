/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { useCallback, useMemo } from "react"

import { DataEditorProps, GridCell } from "@glideapps/glide-data-grid"

import { BaseColumn } from "~lib/components/widgets/DataFrame/columns"
import { Quiver } from "~lib/dataframes/Quiver"

import { createQuiverCellProvider, resolveCellContent } from "./cellProviders"
import EditingState from "./EditingState"

type DataLoaderReturn = Pick<DataEditorProps, "getCellContent">

/**
 * Custom hook that handles cell content loading for the interactive data table.
 * Returns a getCellContent callback compatible with glide-data-grid.
 */
function useDataLoader(
  data: Quiver,
  columns: BaseColumn[],
  numRows: number,
  editingState: React.MutableRefObject<EditingState>
): DataLoaderReturn {
  const baseCellProvider = useMemo(
    () => createQuiverCellProvider(data),
    [data]
  )

  const getCellContent = useCallback(
    ([col, row]: readonly [number, number]): GridCell => {
      return resolveCellContent(
        col,
        row,
        columns,
        numRows,
        editingState.current,
        baseCellProvider
      )
    },
    [columns, numRows, editingState, baseCellProvider]
  )

  return {
    getCellContent,
  }
}

export default useDataLoader
