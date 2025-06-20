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

import { GridCellKind } from "@glideapps/glide-data-grid"
import { SparklineCellType } from "@glideapps/glide-data-grid-cells"
import { Field, Float64, List } from "apache-arrow"

import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"

import {
  AREA_CHART_TYPE,
  AreaChartColumn,
  BAR_CHART_TYPE,
  BarChartColumn,
  ChartColumnParams,
  LINE_CHART_TYPE,
  LineChartColumn,
} from "./ChartColumn"
import { BaseColumnProps, isErrorCell } from "./utils"

const CHART_COLUMN_TEMPLATE = {
  id: "1",
  name: "chart_column",
  title: "Chart column",
  indexNumber: 0,
  isEditable: false,
  isHidden: false,
  isIndex: false,
  isPinned: false,
  isStretched: false,
  arrowType: {
    type: DataFrameCellType.DATA,
    arrowField: new Field(
      "chart_column",
      new List(new Field("item", new Float64(), true)),
      true
    ),
    pandasType: {
      field_name: "chart_column",
      name: "chart_column",
      pandas_type: "object",
      numpy_type: "list[float64]",
      metadata: null,
    },
  },
} as BaseColumnProps

function getLineChartColumn(
  params?: ChartColumnParams
): ReturnType<typeof LineChartColumn> {
  return LineChartColumn({
    ...CHART_COLUMN_TEMPLATE,
    columnTypeOptions: params,
  } as BaseColumnProps)
}

function getBarChartColumn(
  params?: ChartColumnParams
): ReturnType<typeof BarChartColumn> {
  return BarChartColumn({
    ...CHART_COLUMN_TEMPLATE,
    columnTypeOptions: params,
  } as BaseColumnProps)
}

function getAreaChartColumn(
  params?: ChartColumnParams
): ReturnType<typeof AreaChartColumn> {
  return AreaChartColumn({
    ...CHART_COLUMN_TEMPLATE,
    columnTypeOptions: params,
  } as BaseColumnProps)
}

describe("ChartColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = getLineChartColumn()
    expect(mockColumn.kind).toEqual(LINE_CHART_TYPE)
    expect(mockColumn.title).toEqual(CHART_COLUMN_TEMPLATE.title)
    expect(mockColumn.id).toEqual(CHART_COLUMN_TEMPLATE.id)
    expect(mockColumn.sortMode).toEqual("default")

    // Column should be readonly:
    expect(mockColumn.isEditable).toEqual(false)

    const mockCell = mockColumn.getCell([0.1, 0.2, 0.3])
    expect(mockCell.kind).toEqual(GridCellKind.Custom)
    expect((mockCell as SparklineCellType).data?.values).toEqual([
      0.1, 0.2, 0.3,
    ])
    expect((mockCell as SparklineCellType).data?.displayValues).toEqual([
      "0.1",
      "0.2",
      "0.3",
    ])
  })

  it("supports configuring the chart type", () => {
    const mockColumn = getLineChartColumn()
    expect(mockColumn.kind).toEqual(LINE_CHART_TYPE)
    const mockCell = mockColumn.getCell([0.1, 0.2, 0.3])
    // Default chart type is line
    expect((mockCell as SparklineCellType).data?.graphKind).toEqual("line")

    const mockBarChartColumn = getBarChartColumn()
    expect(mockBarChartColumn.kind).toEqual(BAR_CHART_TYPE)
    const mockBarChartCell = mockBarChartColumn.getCell([0.1, 0.2, 0.3])
    // Chart type should be bar
    expect((mockBarChartCell as SparklineCellType).data?.graphKind).toEqual(
      "bar"
    )

    const mockAreaChartColumn = getAreaChartColumn()
    expect(mockAreaChartColumn.kind).toEqual(AREA_CHART_TYPE)
    const mockAreaChartCell = mockAreaChartColumn.getCell([0.1, 0.2, 0.3])
    // Chart type should be area
    expect((mockAreaChartCell as SparklineCellType).data?.graphKind).toEqual(
      "area"
    )
  })

  it("supports configuring min/max scale", () => {
    const mockColumn = getLineChartColumn()
    const mockCell = mockColumn.getCell([-100, 0, 100])
    // Default min/max scale is the min and max of each cell, so nothing happens:
    expect((mockCell as SparklineCellType).data?.values).toEqual([
      -100, 0, 100,
    ])

    // Use a different scale
    const mockColumn1 = getLineChartColumn({
      y_min: -100,
      y_max: 100,
    })
    const mockCell1 = mockColumn1.getCell([-100, 0, 100])
    expect((mockCell1 as SparklineCellType).data?.values).toEqual([
      -100, 0, 100,
    ])

    // Use a different scale
    const mockColumn2 = getLineChartColumn({
      y_min: -1,
      y_max: 1,
    })
    const mockCell2 = mockColumn2.getCell([-100, 0, 100])
    // This should automatically normalize the values to the min/max scale:
    expect((mockCell2 as SparklineCellType).data?.values).toEqual([-1, 0, 1])

    // Use a different scale
    const mockColumn3 = getLineChartColumn({
      y_min: 0,
      y_max: 200,
    })
    const mockCell3 = mockColumn3.getCell([-100, 0, 100])
    // This should automatically normalize the values to the min/max scale:
    expect((mockCell3 as SparklineCellType).data?.values).toEqual([
      0, 100, 200,
    ])

    // Use a different scale
    const mockColumn4 = getLineChartColumn({
      y_min: -200,
      y_max: 200,
    })
    const mockCell4 = mockColumn4.getCell([-100, 0, 100])
    // The values fit into the scale, so don't do anything:
    expect((mockCell4 as SparklineCellType).data?.values).toEqual([
      -100, 0, 100,
    ])

    // Use a different scale
    const mockColumn5 = getLineChartColumn({
      y_min: 100,
      y_max: -100,
    })
    const mockCell5 = mockColumn5.getCell([-100, 0, 100])
    // min needs to be bigger than max, so this should be an error cell:
    expect(isErrorCell(mockCell5)).toEqual(true)

    // Use a different scale
    const mockColumn6 = getLineChartColumn({
      y_min: undefined,
      y_max: -100,
    })
    const mockCell6 = mockColumn6.getCell([-100, 0, 100])
    // min and max can't be the same number, so this should be an error cell:
    expect(isErrorCell(mockCell6)).toEqual(true)
  })

  it("supports negative numbers", () => {
    const mockColumn = getLineChartColumn()

    const mockCell = mockColumn.getCell([-50, 50, 150])
    // The default values for y_min and y_max are -50 and 150, so don't do anything
    expect((mockCell as SparklineCellType).data?.values).toEqual([
      -50, 50, 150,
    ])

    const mockColumn1 = getLineChartColumn()

    const mockCell1 = mockColumn1.getCell([-50, -40, -30])
    // The default values for y_min and y_max are -50 and -30, so don't do anything
    expect((mockCell1 as SparklineCellType).data?.values).toEqual([
      -50, -40, -30,
    ])

    const mockColumn2 = getLineChartColumn({
      y_min: undefined,
      y_max: -60,
    })

    const mockCell2 = mockColumn2.getCell([-50, -40, -30])
    // y_max is -60 and the default for y_min is -50,  so this should be an error cell:
    expect(isErrorCell(mockCell2)).toEqual(true)

    const mockColumn3 = getLineChartColumn()

    const mockCell3 = mockColumn3.getCell([-50])
    // The min/max scale is -50/0 for this case, so don't do anything:
    expect((mockCell3 as SparklineCellType).data?.values).toEqual([-50])
  })

  it("works with single values or only same values without running into division by zero", () => {
    const mockColumn = getBarChartColumn({
      y_min: 0,
      y_max: 100,
    })

    const mockCell1 = mockColumn.getCell([101])
    // The value should be normalized to 100:
    expect((mockCell1 as SparklineCellType).data?.values).toEqual([100])

    const mockCell2 = mockColumn.getCell([101, 101])
    // All values should be normalized to 100:
    expect((mockCell2 as SparklineCellType).data?.values).toEqual([100, 100])

    const mockCell3 = mockColumn.getCell([-1, -1])
    // All values should be normalized to 0:
    expect((mockCell3 as SparklineCellType).data?.values).toEqual([0, 0])
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    (input: any, value: any[] | null) => {
      const mockColumn = getBarChartColumn()
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  ])("%p results in error cell", (input: any) => {
    const mockColumn = getLineChartColumn()
    const cell = mockColumn.getCell(input)
    expect(isErrorCell(cell)).toEqual(true)
  })
})
