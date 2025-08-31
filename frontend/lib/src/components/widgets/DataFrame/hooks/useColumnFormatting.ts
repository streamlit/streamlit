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

type ColumnFormattingReturn = {
  // A callback to change the format of a column
  changeColumnFormat: (columnId: string, format: string) => void
}

/**
 * A React hook that adds the ability to interactively change the format of a column.
 *
 * @param setColumnConfigMapping - A callback to set the column config mapping state
 *
 * @returns An object containing the following properties:
 * - `changeColumnFormat`: A callback to change the format of a column
 */
function useColumnFormatting(
  setColumnConfigMapping: React.Dispatch<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    React.SetStateAction<Map<string, any>>
  >
): ColumnFormattingReturn {
  const changeColumnFormat = useCallback(
    (columnId: string, format: string) => {
      // Update the format parameter in the column config mapping:
      setColumnConfigMapping(prevColumnConfigMapping => {
        return updateColumnConfigTypeProps({
          columnId,
          columnConfigMapping: prevColumnConfigMapping,
          updatedProps: {
            type_config: {
              format: format,
            },
          },
        })
      })
    },
    [setColumnConfigMapping]
  )

  return {
    changeColumnFormat,
  }
}

export default useColumnFormatting
