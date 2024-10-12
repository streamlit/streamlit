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
import { showSaveFilePicker } from "native-file-system-adapter"

import {
  BaseColumn,
  NumberColumn,
  TextColumn,
} from "@streamlit/lib/src/components/widgets/DataFrame/columns"

import useDataExporter, { toCsvRow } from "./useDataExporter"

const mockWrite = vi.fn()
const mockClose = vi.fn()

// The native-file-system-adapter is not available in tests, so we need to mock it.
vi.mock("native-file-system-adapter", () => ({
  showSaveFilePicker: vi.fn().mockImplementation((_object: any) => {
    return {
      createWritable: vi.fn().mockImplementation(() => {
        return {
          write: mockWrite,
          close: mockClose,
        }
      }),
    }
  }),
}))

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
    isEditable: false,
    isHidden: false,
    isIndex: false,
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
    isEditable: false,
    isHidden: false,
    isIndex: false,
    isStretched: false,
    columnTypeOptions: {},
  }),
]

const NUM_ROWS = 5

const getCellContentMock = vi
  .fn()
  .mockImplementation(([col]: readonly [number]) => {
    const column = MOCK_COLUMNS[col]
    if (column.kind === "number") {
      return column.getCell(123)
    }
    return column.getCell("foo")
  })

describe("toCsvRow", () => {
  it.each([
    [["foo", "bar"], "foo,bar\n"],
    [[1, 2], "1,2\n"],
    // Correctly escapes if value has comma:
    [["foo,bar", "baz"], '"foo,bar",baz\n'],
    // Correctly escapes if value has quote:
    [['foo"bar', "baz"], '"foo""bar",baz\n'],
    [["foo,,,bar", "baz,"], '"foo,,,bar","baz,"\n'],
    [[true, 10.123141], "true,10.123141\n"],
  ])("converts %p to a valid CSV row: %p", (input, expected) => {
    expect(toCsvRow(input)).toEqual(expected)
  })
})

describe("useDataExporter hook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("correctly writes data row-by-row to writable", async () => {
    const { result } = renderHook(() => {
      return useDataExporter(getCellContentMock, MOCK_COLUMNS, NUM_ROWS, false)
    })

    if (typeof result.current.exportToCsv !== "function") {
      throw new Error("exportToCsv is expected to be a function")
    }
    await result.current.exportToCsv()

    const textEncoder = new TextEncoder()

    expect(getCellContentMock).toHaveBeenCalled()
    // Number of writes: 1 for BOM + 1 for header + num rows
    expect(mockWrite).toBeCalledTimes(NUM_ROWS + 2)
    expect(mockWrite).toBeCalledWith(textEncoder.encode("\ufeff"))
    // Write the header row:
    expect(mockWrite).toBeCalledWith(textEncoder.encode("column_1,column_2\n"))
    expect(mockWrite).toBeCalledWith(textEncoder.encode("123,foo\n"))
    expect(mockClose).toBeCalledTimes(1)
  })

  it("correctly creates a file picker", async () => {
    const { result } = renderHook(() => {
      return useDataExporter(getCellContentMock, MOCK_COLUMNS, NUM_ROWS, false)
    })

    if (typeof result.current.exportToCsv !== "function") {
      throw new Error("exportToCsv is expected to be a function")
    }

    const timestamp = new Date().toISOString().slice(0, 16).replace(":", "-")
    await result.current.exportToCsv()

    expect(showSaveFilePicker).toBeCalledTimes(1)
    expect(showSaveFilePicker).toBeCalledWith({
      excludeAcceptAllOption: false,
      suggestedName: `${timestamp}_export.csv`,
      types: [{ accept: { "text/csv": [".csv"] } }],
    })
  })
})
