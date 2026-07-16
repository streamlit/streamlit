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

import { renderHook, waitFor } from "@testing-library/react"
import { Field, Int64, Utf8 } from "apache-arrow"
import { showSaveFilePicker } from "native-file-system-adapter"

import {
  BaseColumn,
  NumberColumn,
  TextColumn,
} from "~lib/components/widgets/DataFrame/columns"
import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"

import useDataExporter, { toCsvRow } from "./useDataExporter"

const mockWrite = vi.fn()
const mockClose = vi.fn()

// The native-file-system-adapter is not available in tests, so we need to mock it.
vi.mock("native-file-system-adapter", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
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
      type: DataFrameCellType.DATA,
      arrowField: new Field("column_1", new Int64(), true),
      pandasType: {
        field_name: "column_1",
        name: "column_1",
        pandas_type: "int64",
        numpy_type: "int64",
        metadata: null,
      },
    },
    isEditable: false,
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
      type: DataFrameCellType.DATA,
      arrowField: new Field("column_2", new Utf8(), true),
      pandasType: {
        field_name: "column_2",
        name: "column_2",
        pandas_type: "unicode",
        numpy_type: "object",
        metadata: null,
      },
    },
    isEditable: false,
    isHidden: false,
    isIndex: false,
    isPinned: false,
    isStretched: false,
    columnTypeOptions: {},
  }),
]

function createMockNumberColumn(
  id: string,
  name: string,
  indexNumber: number,
  group?: string
): BaseColumn {
  return NumberColumn({
    id,
    name,
    title: name,
    group,
    indexNumber,
    arrowType: {
      type: DataFrameCellType.DATA,
      arrowField: new Field(name, new Int64(), true),
      pandasType: {
        field_name: name,
        name,
        pandas_type: "int64",
        numpy_type: "int64",
        metadata: null,
      },
    },
    isEditable: false,
    isHidden: false,
    isIndex: false,
    isPinned: false,
    isStretched: false,
  })
}

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

  it("handles null and undefined values", () => {
    expect(toCsvRow([null, undefined, "value"])).toEqual(",,value\n")
  })

  it("handles values with newlines", () => {
    expect(toCsvRow(["line1\nline2", "normal"])).toEqual(
      '"line1\nline2",normal\n'
    )
  })

  it("handles empty array", () => {
    expect(toCsvRow([])).toEqual("\n")
  })

  it("handles values with multiple special characters", () => {
    expect(toCsvRow(['value with, comma and "quote"'])).toEqual(
      '"value with, comma and ""quote"""\n'
    )
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
    result.current.exportToCsv()

    const textEncoder = new TextEncoder()

    await waitFor(() => {
      expect(getCellContentMock).toHaveBeenCalled()
    })
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
    result.current.exportToCsv()

    await waitFor(() => {
      expect(showSaveFilePicker).toBeCalledTimes(1)
    })
    expect(showSaveFilePicker).toBeCalledWith({
      excludeAcceptAllOption: false,
      suggestedName: `${timestamp}_export.csv`,
      types: [{ accept: { "text/csv": [".csv"] } }],
    })
  })

  it("does nothing when user cancels file picker (AbortError)", async () => {
    // Mock the file picker to throw an AbortError
    vi.mocked(showSaveFilePicker).mockRejectedValueOnce(
      Object.assign(new Error("User cancelled"), { name: "AbortError" })
    )

    const { result } = renderHook(() => {
      return useDataExporter(getCellContentMock, MOCK_COLUMNS, NUM_ROWS, false)
    })

    // Should not throw
    await expect(result.current.exportToCsv()).resolves.toBeUndefined()

    // Should not trigger fallback method
    expect(mockWrite).not.toHaveBeenCalled()
  })

  it("falls back to blob download when file picker fails", async () => {
    // Create mock for URL methods and document manipulation
    const mockCreateObjectURL = vi.fn().mockReturnValue("blob:mock-url")
    const mockRevokeObjectURL = vi.fn()
    const mockClick = vi.fn()
    const mockAppendChild = vi.fn()
    const mockRemoveChild = vi.fn()

    // Save originals
    const originalCreateObjectURL = URL.createObjectURL
    const originalRevokeObjectURL = URL.revokeObjectURL
    const originalAppendChild = document.body.appendChild
    const originalRemoveChild = document.body.removeChild

    // Mock URL methods
    URL.createObjectURL = mockCreateObjectURL
    URL.revokeObjectURL = mockRevokeObjectURL

    // Mock document.body methods
    document.body.appendChild = mockAppendChild.mockImplementation(node => {
      // Mock the click method on the link element
      ;(node as HTMLAnchorElement).click = mockClick
      return node
    })
    document.body.removeChild = mockRemoveChild

    // Mock the file picker to throw a generic error (not AbortError)
    vi.mocked(showSaveFilePicker).mockRejectedValueOnce(
      new Error("File system not available")
    )

    const { result } = renderHook(() => {
      return useDataExporter(getCellContentMock, MOCK_COLUMNS, NUM_ROWS, false)
    })

    result.current.exportToCsv()

    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalled()
    })

    // Verify blob was created with correct type
    expect(mockCreateObjectURL).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "text/csv;charset=utf-8;",
      })
    )

    // Verify link was clicked and cleaned up
    expect(mockClick).toHaveBeenCalled()
    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url")

    // Restore originals
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    document.body.appendChild = originalAppendChild
    document.body.removeChild = originalRemoveChild
  })

  it("handles zero rows correctly", async () => {
    const { result } = renderHook(() => {
      return useDataExporter(getCellContentMock, MOCK_COLUMNS, 0, false)
    })

    result.current.exportToCsv()

    const textEncoder = new TextEncoder()

    await waitFor(() => {
      // Should still write BOM and headers
      expect(mockWrite).toHaveBeenCalledWith(textEncoder.encode("\ufeff"))
    })

    // Number of writes: 1 for BOM + 1 for header + 0 rows
    expect(mockWrite).toBeCalledTimes(2)
    expect(mockClose).toBeCalledTimes(1)
  })

  it("handles null cell values", async () => {
    const getCellWithNullMock = vi
      .fn()
      .mockImplementation(([col]: readonly [number]) => {
        const column = MOCK_COLUMNS[col]
        // Return null for the first column
        if (col === 0) {
          return column.getCell(null)
        }
        return column.getCell("foo")
      })

    const { result } = renderHook(() => {
      return useDataExporter(getCellWithNullMock, MOCK_COLUMNS, 1, false)
    })

    result.current.exportToCsv()

    const textEncoder = new TextEncoder()

    await waitFor(() => {
      expect(getCellWithNullMock).toHaveBeenCalled()
    })

    // Should handle null values gracefully (empty string in CSV)
    expect(mockWrite).toBeCalledWith(textEncoder.encode(",foo\n"))
  })
})

describe("useDataExporter MultiIndex header export", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("writes two header rows for a two-level MultiIndex", async () => {
    const multiIndexColumns: BaseColumn[] = [
      createMockNumberColumn("col_0", "Q1", 0, "2022"),
      createMockNumberColumn("col_1", "Q2", 1, "2022"),
      createMockNumberColumn("col_2", "Q1", 2, "2023"),
      createMockNumberColumn("col_3", "Q2", 3, "2023"),
    ]

    const getCellContentMulti = vi
      .fn()
      .mockImplementation(([col]: readonly [number]) => {
        return multiIndexColumns[col].getCell(1)
      })

    const { result } = renderHook(() => {
      return useDataExporter(getCellContentMulti, multiIndexColumns, 1, false)
    })

    result.current.exportToCsv()

    const textEncoder = new TextEncoder()

    await waitFor(() => {
      expect(getCellContentMulti).toHaveBeenCalled()
    })

    // Writes: BOM + parent header row + leaf header row + 1 data row
    expect(mockWrite).toBeCalledTimes(4)
    expect(mockWrite).toBeCalledWith(textEncoder.encode("\ufeff"))
    // Parent-level header row:
    expect(mockWrite).toBeCalledWith(
      textEncoder.encode("2022,2022,2023,2023\n")
    )
    // Leaf-level header row:
    expect(mockWrite).toBeCalledWith(textEncoder.encode("Q1,Q2,Q1,Q2\n"))
    // Data row:
    expect(mockWrite).toBeCalledWith(textEncoder.encode("1,1,1,1\n"))
    expect(mockClose).toBeCalledTimes(1)
  })

  it("writes three header rows for a three-level MultiIndex", async () => {
    const threeLevelColumns: BaseColumn[] = [
      createMockNumberColumn("col_0", "1", 0, "A / X"),
      createMockNumberColumn("col_1", "2", 1, "A / X"),
      createMockNumberColumn("col_2", "1", 2, "B / Y"),
      createMockNumberColumn("col_3", "2", 3, "B / Y"),
    ]

    const getCellContentThreeLevel = vi
      .fn()
      .mockImplementation(([col]: readonly [number]) => {
        return threeLevelColumns[col].getCell(1)
      })

    const { result } = renderHook(() => {
      return useDataExporter(
        getCellContentThreeLevel,
        threeLevelColumns,
        1,
        false
      )
    })

    result.current.exportToCsv()

    const textEncoder = new TextEncoder()

    await waitFor(() => {
      expect(getCellContentThreeLevel).toHaveBeenCalled()
    })

    // Writes: BOM + grandparent header + parent header + leaf header + 1 data row
    expect(mockWrite).toBeCalledTimes(5)
    expect(mockWrite).toBeCalledWith(textEncoder.encode("\ufeff"))
    // Grandparent-level header row:
    expect(mockWrite).toBeCalledWith(textEncoder.encode("A,A,B,B\n"))
    // Parent-level header row:
    expect(mockWrite).toBeCalledWith(textEncoder.encode("X,X,Y,Y\n"))
    // Leaf-level header row:
    expect(mockWrite).toBeCalledWith(textEncoder.encode("1,2,1,2\n"))
    // Data row:
    expect(mockWrite).toBeCalledWith(textEncoder.encode("1,1,1,1\n"))
    expect(mockClose).toBeCalledTimes(1)
  })

  it("writes single header row when no columns have groups", async () => {
    // This is a regression test: normal columns should produce a single header row
    const { result } = renderHook(() => {
      return useDataExporter(getCellContentMock, MOCK_COLUMNS, NUM_ROWS, false)
    })

    result.current.exportToCsv()

    const textEncoder = new TextEncoder()

    await waitFor(() => {
      expect(getCellContentMock).toHaveBeenCalled()
    })

    // Writes: BOM + single header row + NUM_ROWS data rows
    expect(mockWrite).toBeCalledTimes(NUM_ROWS + 2)
    expect(mockWrite).toBeCalledWith(textEncoder.encode("\ufeff"))
    // Single header row:
    expect(mockWrite).toBeCalledWith(textEncoder.encode("column_1,column_2\n"))
    expect(mockClose).toBeCalledTimes(1)
  })

  it("pads with empty strings when columns have different group depths", async () => {
    const mixedDepthColumns: BaseColumn[] = [
      createMockNumberColumn("col_0", "val1", 0, "A / X"),
      createMockNumberColumn("col_1", "val2", 1, "B"),
    ]

    const getCellContentMixed = vi
      .fn()
      .mockImplementation(([col]: readonly [number]) => {
        return mixedDepthColumns[col].getCell(1)
      })

    const { result } = renderHook(() => {
      return useDataExporter(getCellContentMixed, mixedDepthColumns, 1, false)
    })

    result.current.exportToCsv()

    const textEncoder = new TextEncoder()

    await waitFor(() => {
      expect(getCellContentMixed).toHaveBeenCalled()
    })

    // Writes: BOM + level 0 header + level 1 header + leaf header + 1 data row
    expect(mockWrite).toBeCalledTimes(5)
    expect(mockWrite).toBeCalledWith(textEncoder.encode("\ufeff"))
    // Level 0 header row (col 0 -> "A", col 1 -> "B"):
    expect(mockWrite).toBeCalledWith(textEncoder.encode("A,B\n"))
    // Level 1 header row (col 0 -> "X", col 1 -> "" since "B" has only 1 level):
    expect(mockWrite).toBeCalledWith(textEncoder.encode("X,\n"))
    // Leaf-level header row:
    expect(mockWrite).toBeCalledWith(textEncoder.encode("val1,val2\n"))
    // Data row:
    expect(mockWrite).toBeCalledWith(textEncoder.encode("1,1\n"))
    expect(mockClose).toBeCalledTimes(1)
  })
})
