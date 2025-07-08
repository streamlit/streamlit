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

import { GridCellKind, NumberCell, TextCell } from "@glideapps/glide-data-grid"
import { renderHook } from "@testing-library/react"

import { JsonTextCellEditor } from "~lib/components/widgets/DataFrame/columns/cells/JsonCell"

import useCustomEditors from "./useCustomEditors"

describe("useCustomEditors hook", () => {
  it("returns correct initial state", () => {
    const { result } = renderHook(() => useCustomEditors())

    expect(typeof result.current.provideEditor).toBe("function")
  })

  it("returns JSON editor for readonly text cells with JSON content", () => {
    const { result } = renderHook(() => useCustomEditors())

    const cell: TextCell = {
      kind: GridCellKind.Text,
      readonly: true,
      data: '{"key": "value"}',
      allowOverlay: true,
      displayData: '{"key": "value"}',
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const editor = result.current.provideEditor!(cell)
    expect(editor).toEqual({
      editor: JsonTextCellEditor,
    })
  })

  it("returns undefined for non-JSON text cells", () => {
    const { result } = renderHook(() => useCustomEditors())

    const cell: TextCell = {
      kind: GridCellKind.Text,
      readonly: true,
      data: "not json",
      allowOverlay: true,
      displayData: "not json",
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const editor = result.current.provideEditor!(cell)
    expect(editor).toBeUndefined()
  })

  it("returns undefined for non-readonly text cells", () => {
    const { result } = renderHook(() => useCustomEditors())

    const cell: TextCell = {
      kind: GridCellKind.Text,
      readonly: false,
      data: '{"key": "value"}',
      allowOverlay: true,
      displayData: '{"key": "value"}',
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const editor = result.current.provideEditor!(cell)
    expect(editor).toBeUndefined()
  })

  it("returns undefined for non-text cells", () => {
    const { result } = renderHook(() => useCustomEditors())

    const cell: NumberCell = {
      kind: GridCellKind.Number,
      readonly: true,
      data: 123,
      allowOverlay: true,
      displayData: "123",
      contentAlign: "right",
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const editor = result.current.provideEditor!(cell)
    expect(editor).toBeUndefined()
  })
})
