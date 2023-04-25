/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import { renderHook, act } from "@testing-library/react-hooks"
import {
  BaseColumn,
  TextColumn,
  NumberColumn,
} from "src/components/widgets/DataFrame/columns"

import useTooltips, { DEBOUNCE_TIME_MS } from "./useTooltips"
import { GridMouseEventArgs } from "@glideapps/glide-data-grid"

const TOOLTIP_CONTENT = "This is a **number** column."
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
    isHidden: false,
    isIndex: false,
    isStretched: false,
    help: TOOLTIP_CONTENT,
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
    isHidden: false,
    isIndex: false,
    isStretched: false,
  }),
]

const getCellContentMock = jest
  .fn()
  .mockImplementation(([col]: readonly [number]) => {
    const column = MOCK_COLUMNS[col]
    if (column.kind === "number") {
      return { ...column.getCell(123), tooltip: "Cell tooltip 1" }
    }
    return { ...column.getCell("foo"), tooltip: "Cell tooltip 2" }
  })

describe("useTooltips hook", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
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

      jest.advanceTimersByTime(DEBOUNCE_TIME_MS)
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

      jest.advanceTimersByTime(DEBOUNCE_TIME_MS)
    })

    expect(result.current.tooltip).toMatchObject({
      content: "Cell tooltip 1",
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

      jest.advanceTimersByTime(DEBOUNCE_TIME_MS)
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
})
