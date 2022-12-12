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
import { Vector } from "apache-arrow"

import { DataType } from "src/lib/Quiver"
import { notNullOrUndefined } from "src/lib/utils"

import {
  BaseColumn,
  BaseColumnProps,
  getErrorCell,
  getEmptyCell,
} from "./BaseColumn"

interface ChartColumnParams {
  readonly type: string
}

function ChartColumn(props: BaseColumnProps): BaseColumn {
  // TODO(lukasmasuch): use merge?
  const parameters = {
    type: "line",
    ...(props.columnTypeMetadata || {}),
  } as ChartColumnParams

  const cellTemplate = {
    kind: GridCellKind.Custom,
    allowOverlay: false,
    copyData: "[]",
    contentAlign: props.contentAlignment,
    data: {
      kind: "sparkline-cell",
      values: [],
      displayValues: [],
      graphKind: parameters.type,
      yAxis: [0, 1],
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

      let chartData
      if (Array.isArray(data)) {
        chartData = data
      } else if (data instanceof Vector) {
        chartData = data.toArray()
      } else {
        return getErrorCell(
          String(data),
          "Incompatible chart value. The provided value is not a number array."
        )
      }

      const convertedChartData: number[] = []
      let normalizedChartData: number[] = []

      if (chartData.length >= 1) {
        let maxValue = Number(chartData[0])
        let minValue = Number(chartData[0])
        chartData.forEach((value: any) => {
          const convertedValue = Number(value)
          if (convertedValue > maxValue) {
            maxValue = convertedValue
          }

          if (convertedValue < minValue) {
            minValue = convertedValue
          }

          if (Number.isNaN(convertedValue)) {
            return getErrorCell(
              String(data),
              "Incompatible chart value. All values in the array should be numbers."
            )
          }
          convertedChartData.push(convertedValue)
          return null // TODO: why is this needed?
        })

        if (maxValue > 1 || minValue < 0) {
          // Normalize values
          normalizedChartData = convertedChartData.map(
            v => (v - minValue) / (maxValue - minValue)
          )
        } else {
          // Values are already in range 0-1
          normalizedChartData = convertedChartData
        }
      }

      return {
        ...cellTemplate,
        copyData: JSON.stringify(convertedChartData),
        data: {
          ...cellTemplate.data,
          values: normalizedChartData,
          displayValues: convertedChartData.map(v => v.toString()),
        },
      } as SparklineCellType
    },
    getCellValue(cell: SparklineCellType): readonly number[] | null {
      return cell.data?.values === undefined ? null : cell.data?.values
    },
  }
}

export default ChartColumn
