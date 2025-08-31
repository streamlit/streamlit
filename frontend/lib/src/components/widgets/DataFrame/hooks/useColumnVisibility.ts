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

import React, { useCallback } from "react"

import { updateColumnConfigTypeProps } from "./columnConfigUtils"

type ColumnVisibilityReturn = {
  // Hides a column.
  hideColumn: (columnId: string) => void
  // Shows a column.
  showColumn: (columnId: string) => void
}

/**
 * A React hook that adds the ability to interactively hide and show columns from UI.
 *
 * @param clearSelection - A callback to clear current selections in the table
 * @param setColumnConfigMapping - A callback to set the column config mapping state
 *
 * @returns An object containing the following properties:
 * - `hideColumn`: Hides a column.
 * - `showColumn`: Shows a column.
 */
function useColumnVisibility(
  clearSelection: (keepRows?: boolean, keepColumns?: boolean) => void,
  setColumnConfigMapping: React.Dispatch<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    React.SetStateAction<Map<string, any>>
  >
): ColumnVisibilityReturn {
  const hideColumn = useCallback(
    (columnId: string) => {
      setColumnConfigMapping(prevColumnConfigMapping => {
        return updateColumnConfigTypeProps({
          columnId,
          columnConfigMapping: prevColumnConfigMapping,
          updatedProps: {
            hidden: true,
          },
        })
      })
      clearSelection(true, false)
    },
    [clearSelection, setColumnConfigMapping]
  )

  const showColumn = useCallback(
    (columnId: string) => {
      setColumnConfigMapping(prevColumnConfigMapping => {
        return updateColumnConfigTypeProps({
          columnId,
          columnConfigMapping: prevColumnConfigMapping,
          updatedProps: {
            hidden: false,
          },
        })
      })
      clearSelection(true, false)
    },
    [clearSelection, setColumnConfigMapping]
  )

  return {
    hideColumn,
    showColumn,
  }
}

export default useColumnVisibility
