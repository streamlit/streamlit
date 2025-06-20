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

import { GridMouseEventArgs } from "@glideapps/glide-data-grid"
import { act, renderHook } from "@testing-library/react"
import { Field, Int64, Utf8 } from "apache-arrow"

import {
  BaseColumn,
  NumberColumn,
  TextColumn,
} from "~lib/components/widgets/DataFrame/columns"
import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"

import useTooltips, {
  DEBOUNCE_TIME_MS,
  REQUIRED_CELL_TOOLTIP,
} from "./useTooltips"

const TOOLTIP_CONTENT = "This is a **number** column."
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
    isEditable: true,
    isRequired: true,
    isHidden: false,
    isIndex: false,
    isPinned: false,
    isStretched: false,
    help: TOOLTIP_CONTENT,
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
    isEditable: true,
    isRequired: false,
    isHidden: false,
    isIndex: false,
    isPinned: false,
    isStretched: false,
  }),
]

const getCellContentMock = vi
  .fn()
  .mockImplementation(([col]: readonly [number]) => {
    const column = MOCK_COLUMNS[col]
    if (column.kind === "number") {
      return { ...column.getCell(123), tooltip: "Cell tooltip 1" }
    }
    return { ...column.getCell("foo"), tooltip: "Cell tooltip 2" }
  })

const getEmptyCellContentMock = vi
  .fn()
  .mockImplementation(([col]: readonly [number]) => {
    const column = MOCK_COLUMNS[col]
    return column.getCell(null)
  })

describe("useTooltips hook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it("renders a tooltip on hovering the header column with a tooltip", () => {
    const { result } = renderHook(() => {
      return useTooltips(MOCK_COLUMNS, getCellContentMock)
    })

    act(() => {
      // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
      result.current.onItemHovered!({
        kind: "header",
        location: [0, -1],
        bounds: { x: 0, y: 0, width: 100, height: 30 },
      } as object as GridMouseEventArgs)

      vi.advanceTimersByTime(DEBOUNCE_TIME_MS)
    })

    expect(result.current.tooltip).toMatchObject({
      content: TOOLTIP_CONTENT,
      left: 50,
      top: 0,
    })
  })

  it("renders a tooltip on hovering a cell with a tooltip", () => {
    const { result } = renderHook(() => {
      return useTooltips(MOCK_COLUMNS, getCellContentMock)
    })

    act(() => {
      // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
      result.current.onItemHovered!({
        kind: "cell",
        location: [0, 1],
        bounds: { x: 0, y: 30, width: 100, height: 30 },
      } as object as GridMouseEventArgs)

      vi.advanceTimersByTime(DEBOUNCE_TIME_MS)
    })

    expect(result.current.tooltip).toMatchObject({
      content: "Cell tooltip 1",
      left: 50,
      top: 30,
    })
  })

  it("renders a tooltip on hovering a required cell", () => {
    const { result } = renderHook(() => {
      return useTooltips(MOCK_COLUMNS, getEmptyCellContentMock)
    })

    act(() => {
      // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
      result.current.onItemHovered!({
        kind: "cell",
        location: [0, 1],
        bounds: { x: 0, y: 30, width: 100, height: 30 },
      } as object as GridMouseEventArgs)

      vi.advanceTimersByTime(DEBOUNCE_TIME_MS)
    })

    expect(result.current.tooltip).toMatchObject({
      content: REQUIRED_CELL_TOOLTIP,
      left: 50,
      top: 30,
    })
  })

  it("clears the tooltip when calling the clearTooltip function", () => {
    const { result } = renderHook(() => {
      return useTooltips(MOCK_COLUMNS, getCellContentMock)
    })

    act(() => {
      // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
      result.current.onItemHovered!({
        kind: "header",
        location: [0, 0],
        bounds: { x: 0, y: 0, width: 100, height: 30 },
      } as object as GridMouseEventArgs)

      vi.advanceTimersByTime(DEBOUNCE_TIME_MS)
    })

    expect(result.current.tooltip).toMatchObject({
      content: TOOLTIP_CONTENT,
      left: 50,
      top: 0,
    })

    act(() => {
      result.current.clearTooltip()
    })

    expect(result.current.tooltip).toBeUndefined()
  })

  it("does not render a tooltip when hovering a cell in an ignored row", () => {
    const { result } = renderHook(() => {
      return useTooltips(MOCK_COLUMNS, getCellContentMock, [1])
    })

    act(() => {
      // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
      result.current.onItemHovered!({
        kind: "cell",
        location: [0, 1], // This is row index 1, which is ignored
        bounds: { x: 0, y: 30, width: 100, height: 30 },
      } as object as GridMouseEventArgs)

      vi.advanceTimersByTime(DEBOUNCE_TIME_MS)
    })

    expect(result.current.tooltip).toBeUndefined()
  })
})
