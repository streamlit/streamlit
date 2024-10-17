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

import { renderHook } from "@testing-library/react-hooks"

import {
  BaseColumn,
  NumberColumn,
  TextColumn,
} from "@streamlit/lib/src/components/widgets/DataFrame/columns"

import useCustomRenderer from "./useCustomRenderer"

const MOCK_COLUMNS: BaseColumn[] = [
  NumberColumn({
    id: "column_1",
    name: "column_1",
    title: "column_1",
    indexNumber: 0,
    arrowType: {
      pandas_type: "int64",
      numpy_type: "int64",
    },
    isEditable: true,
    isRequired: true,
    isHidden: false,
    isIndex: false,
    isPinned: false,
    isStretched: false,
  }),
  TextColumn({
    id: "column_2",
    name: "column_2",
    title: "column_2",
    indexNumber: 1,
    arrowType: {
      pandas_type: "unicode",
      numpy_type: "object",
    },
    isEditable: true,
    isRequired: false,
    isHidden: false,
    isIndex: false,
    isPinned: false,
    isStretched: false,
  }),
]

describe("useCustomRenderer hook", () => {
  it("returns correct initial state", () => {
    const { result } = renderHook(() => {
      return useCustomRenderer(MOCK_COLUMNS)
    })

    // Initial state assertions
    expect(typeof result.current.drawCell).toBe("function")
    expect(Array.isArray(result.current.customRenderers)).toBeTruthy()
  })
})
