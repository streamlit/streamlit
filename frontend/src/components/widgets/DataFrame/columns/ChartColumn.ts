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

import {
  GridCell,
  GridCellKind,
  LoadingCell,
} from "@glideapps/glide-data-grid"
import { SparklineCellType } from "@glideapps/glide-data-grid-cells"

import { isNullOrUndefined } from "src/lib/utils"

import {
  BaseColumn,
  BaseColumnProps,
  getErrorCell,
  getEmptyCell,
  toSafeString,
  toSafeArray,
  mergeColumnParameters,
  toSafeNumber,
  formatNumber,
} from "./utils"

export interface ChartColumnParams {
  // The minimum value used for plotting the chart. Defaults to 0.
  readonly y_min?: number
  // The maximum value used for plotting the chart. Defaults to 1.
  readonly y_max?: number
}

/**
 * A column type that renders the cell value as a chart (bar & line chart)
 * The data is expected to be a numeric array.
 *
 * This column type is currently read-only.
 */
function BaseChartColumn(
  kind: string,
  props: BaseColumnProps,
  chart_type: "line" | "bar"
): BaseColumn {
  const parameters = mergeColumnParameters(
    // Default parameters:
    {
      y_min: 0,
      y_max: 1,
    },
    // User parameters:
    props.columnTypeOptions
  ) as ChartColumnParams

  const cellTemplate = {
    kind: GridCellKind.Custom,
    allowOverlay: false,
    copyData: "",
    contentAlign: props.contentAlignment,
    data: {
      kind: "sparkline-cell",
      values: [],
      displayValues: [],
      graphKind: chart_type,
      yAxis: [parameters.y_min, parameters.y_max],
    },
  } as SparklineCellType

  return {
    ...props,
    kind,
    sortMode: "default",
    isEditable: false, // Chart column is always read-only
    getCell(data?: any): GridCell {
      if (
        isNullOrUndefined(parameters.y_min) ||
        isNullOrUndefined(parameters.y_max) ||
        Number.isNaN(parameters.y_min) ||
        Number.isNaN(parameters.y_max) ||
        parameters.y_min >= parameters.y_max
      ) {
        return getErrorCell(
          "Invalid min/max y-axis configuration",
          `The y_min (${parameters.y_min}) and y_max (${parameters.y_max}) configuration options must be valid numbers.`
        )
      }

      if (isNullOrUndefined(data)) {
        // TODO(lukasmasuch): Use a missing cell?
        return getEmptyCell()
      }

      const chartData = toSafeArray(data)

      const convertedChartData: number[] = []
      let normalizedChartData: number[] = []
      if (chartData.length === 0) {
        return getEmptyCell()
      }

      // Initialize with smallest and biggest number
      let maxValue = Number.MIN_SAFE_INTEGER
      let minValue = Number.MAX_SAFE_INTEGER

      // Try to convert all values to numbers and find min/max
      for (let i = 0; i < chartData.length; i++) {
        const convertedValue = toSafeNumber(chartData[i])
        if (
          Number.isNaN(convertedValue) ||
          isNullOrUndefined(convertedValue)
        ) {
          return getErrorCell(
            toSafeString(chartData),
            `The value cannot be interpreted as a numeric array. ${toSafeString(
              convertedValue
            )} is not a number.`
          )
        }

        if (convertedValue > maxValue) {
          maxValue = convertedValue
        }

        if (convertedValue < minValue) {
          minValue = convertedValue
        }

        convertedChartData.push(convertedValue)
      }

      if (
        convertedChartData.length > 0 &&
        (maxValue > parameters.y_max || minValue < parameters.y_min)
      ) {
        // Normalize values between the configured range
        normalizedChartData = convertedChartData.map(
          v =>
            ((parameters.y_max || 1) - (parameters.y_min || 0)) *
              ((v - minValue) / (maxValue - minValue)) +
            (parameters.y_min || 0)
        )
      } else {
        // Values are already in the configured range
        normalizedChartData = convertedChartData
      }

      return {
        ...cellTemplate,
        copyData: convertedChartData.join(","), // Column sorting is done via the copyData value
        data: {
          ...cellTemplate.data,
          values: normalizedChartData,
          displayValues: convertedChartData.map(v => formatNumber(v, 3)),
        },
        isMissingValue: isNullOrUndefined(data),
      } as SparklineCellType
    },
    getCellValue(
      cell: SparklineCellType | LoadingCell
    ): readonly number[] | null {
      if (cell.kind === GridCellKind.Loading) {
        return null
      }

      return cell.data?.values === undefined ? null : cell.data?.values
    },
  }
}

export function LineChartColumn(props: BaseColumnProps): BaseColumn {
  return BaseChartColumn("line_chart", props, "line")
}

LineChartColumn.isEditableType = false

export function BarChartColumn(props: BaseColumnProps): BaseColumn {
  return BaseChartColumn("bar_chart", props, "bar")
}

BarChartColumn.isEditableType = false
