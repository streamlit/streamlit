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

import { GridCell, GridCellKind } from "@glideapps/glide-data-grid"
import { SparklineCellType } from "@glideapps/glide-data-grid-cells"

import { DataType } from "src/lib/Quiver"
import { notNullOrUndefined } from "src/lib/utils"

import {
  BaseColumn,
  BaseColumnProps,
  getErrorCell,
  getEmptyCell,
  ColumnCreator,
  toSafeString,
  toSafeArray,
  mergeColumnParameters,
  toSafeNumber,
  formatNumber,
} from "./utils"

interface ChartColumnParams {
  readonly type: "line" | "bar"
  readonly min: number
  readonly max: number
}

function ChartColumn(props: BaseColumnProps): BaseColumn {
  const parameters = mergeColumnParameters(
    // Default parameters:
    {
      type: "line",
      min: 0,
      max: 1,
    },
    // User parameters:
    props.columnTypeMetadata
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
      graphKind: parameters.type,
      yAxis: [parameters.min, parameters.max],
    },
  } as SparklineCellType

  return {
    ...props,
    kind: "chart",
    sortMode: "default",
    isEditable: false, // Range column is always readonly
    getCell(data?: DataType): GridCell {
      if (!notNullOrUndefined(data)) {
        return getEmptyCell()
      }

      const chartData = toSafeArray(data)

      const convertedChartData: number[] = []
      let normalizedChartData: number[] = []

      if (chartData.length >= 1) {
        // Initialize with smallest and biggest number
        let maxValue = Number.MIN_SAFE_INTEGER
        let minValue = Number.MAX_SAFE_INTEGER

        // Try to convert all values to numbers and find min/max
        for (let i = 0; i < chartData.length; i++) {
          const convertedValue = toSafeNumber(chartData[i])
          if (
            Number.isNaN(convertedValue) ||
            !notNullOrUndefined(convertedValue)
          ) {
            return getErrorCell(
              toSafeString(chartData),
              `Incompatible chart value. The value ${convertedValue} is not a number.`
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
          (maxValue > parameters.max || minValue < parameters.min)
        ) {
          // Normalize values between the configured range
          normalizedChartData = convertedChartData.map(
            v =>
              (parameters.max - parameters.min) *
                ((v - minValue) / (maxValue - minValue)) +
              parameters.min
          )
        } else {
          // Values are already in the configured range
          normalizedChartData = convertedChartData
        }
      }

      return {
        ...cellTemplate,
        copyData: convertedChartData.join(","),
        data: {
          ...cellTemplate.data,
          values: normalizedChartData,
          displayValues: convertedChartData.map(v => formatNumber(v, 3)),
        },
      } as SparklineCellType
    },
    getCellValue(cell: SparklineCellType): readonly number[] | null {
      return cell.data?.values === undefined ? null : cell.data?.values
    },
  }
}

ChartColumn.isEditableType = false

export default ChartColumn as ColumnCreator
