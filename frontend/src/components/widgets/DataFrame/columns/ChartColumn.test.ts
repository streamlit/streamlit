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

import { GridCellKind, BubbleCell } from "@glideapps/glide-data-grid"
import { SparklineCellType } from "@glideapps/glide-data-grid-cells"

import { BaseColumnProps, isErrorCell } from "./utils"
import ChartColumn, { ChartColumnParams } from "./ChartColumn"

const CHART_COLUMN_TEMPLATE = {
  id: "1",
  title: "Chart column",
  indexNumber: 0,
  isEditable: false,
  isHidden: false,
  isIndex: false,
  isStretched: false,
  arrowType: {
    // The arrow type of the underlying data is
    // not used for anything inside the column.
    pandas_type: "object",
    numpy_type: "list[float64]",
  },
}

function getChartColumn(
  params?: ChartColumnParams
): ReturnType<typeof ChartColumn> {
  return ChartColumn({
    ...CHART_COLUMN_TEMPLATE,
    columnTypeMetadata: params,
  } as BaseColumnProps)
}

describe("ChartColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = getChartColumn()
    expect(mockColumn.kind).toEqual("chart")
    expect(mockColumn.title).toEqual(CHART_COLUMN_TEMPLATE.title)
    expect(mockColumn.id).toEqual(CHART_COLUMN_TEMPLATE.id)
    expect(mockColumn.sortMode).toEqual("default")

    // Column should be readonly, even if isEditable was true
    expect(mockColumn.isEditable).toEqual(false)

    const mockCell = mockColumn.getCell([0.1, 0.2])
    expect(mockCell.kind).toEqual(GridCellKind.Custom)
    expect((mockCell as SparklineCellType).data?.values).toEqual([0.1, 0.2])
    expect((mockCell as SparklineCellType).data?.displayValues).toEqual([
      "0.1",
      "0.2",
    ])
  })

  it("supports configuring the chart type", () => {
    const mockColumn = getChartColumn()
    expect(mockColumn.kind).toEqual("chart")
    const mockCell = mockColumn.getCell([0.1, 0.2])
    // Default chart type is line
    expect((mockCell as SparklineCellType).data?.graphKind).toEqual("line")

    const mockBarChartColumn = getChartColumn({ type: "bar" })
    expect(mockBarChartColumn.kind).toEqual("chart")
    const mockBarChartCell = mockBarChartColumn.getCell([0.1, 0.2])
    // Chart type should be bar
    expect((mockBarChartCell as SparklineCellType).data?.graphKind).toEqual(
      "bar"
    )
  })

  it("supports configuring min/max scale", () => {
    const mockColumn = getChartColumn()
    const mockCell = mockColumn.getCell([-100, 0, 100])
    // Default min/max scale is 0/1 so the values should be normalized:
    expect((mockCell as SparklineCellType).data?.values).toEqual([0, 0.5, 1])

    // Use a different scale
    const mockColumn1 = getChartColumn({
      min: -100,
      max: 100,
    })
    const mockCell1 = mockColumn1.getCell([-100, 0, 100])
    expect((mockCell1 as SparklineCellType).data?.values).toEqual([
      -100, 0, 100,
    ])

    // Use a different scale
    const mockColumn2 = getChartColumn({
      min: -1,
      max: 1,
    })
    const mockCell2 = mockColumn2.getCell([-100, 0, 100])
    // This should automatically normalize the values to the min/max scale:
    expect((mockCell2 as SparklineCellType).data?.values).toEqual([-1, 0, 1])

    // Use a different scale
    const mockColumn3 = getChartColumn({
      min: 0,
      max: 200,
    })
    const mockCell3 = mockColumn3.getCell([-100, 0, 100])
    // This should automatically normalize the values to the min/max scale:
    expect((mockCell3 as SparklineCellType).data?.values).toEqual([
      0, 100, 200,
    ])

    // Use a different scale
    const mockColumn4 = getChartColumn({
      min: -200,
      max: 200,
    })
    const mockCell4 = mockColumn4.getCell([-100, 0, 100])
    // The values fit into the scale, so don't do anything:
    expect((mockCell4 as SparklineCellType).data?.values).toEqual([
      -100, 0, 100,
    ])

    // Use a different scale
    const mockColumn5 = getChartColumn({
      min: 100,
      max: -100,
    })
    const mockCell5 = mockColumn5.getCell([-100, 0, 100])
    // min needs to be bigger than max, so this should be an error cell:
    expect(isErrorCell(mockCell5)).toEqual(true)

    // Use a different scale
    const mockColumn6 = getChartColumn({
      min: undefined,
      max: -100,
    })
    const mockCell6 = mockColumn6.getCell([-100, 0, 100])
    // min and max need to be defined, so this should be an error cell:
    expect(isErrorCell(mockCell6)).toEqual(true)
  })

  it.each([
    // Supports almost the same as toSafeArray
    [null, null],
    [undefined, null],
    ["", null],
    [[], null],
    // Comma separated syntax
    ["0.1,0.2", [0.1, 0.2]],
    // JSON Array syntax
    [`["0.1","0.2"]`, [0.1, 0.2]],
    ["1", [1]],
    [0, [0]],
    [1, [1]],
    [
      [0, 0.2, 0.1],
      [0, 0.2, 0.1],
    ],
    [true, [1]],
    [false, [0]],
  ])(
    "supports numerical array-compatible value (%p parsed as %p)",
    (input: any, value: any[] | null) => {
      const mockColumn = getChartColumn()
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
    }
  )

  it.each([
    ["foo"],
    ["foo, bar"],
    ["0.1,0.4,foo"],
    ["0.1,0.4,"],
    [["foo", "bar"]],
    [[0.1, 0.4, "foo"]],
    [[0.1, 0.4, null]],
  ])("%p results in error cell", (input: any) => {
    const mockColumn = getChartColumn()
    const cell = mockColumn.getCell(input)
    expect(isErrorCell(cell)).toEqual(true)
  })
})
