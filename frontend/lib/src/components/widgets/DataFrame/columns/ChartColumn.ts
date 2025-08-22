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

import {
  GridCell,
  GridCellKind,
  LoadingCell,
} from "@glideapps/glide-data-grid"
import { SparklineCellType } from "@glideapps/glide-data-grid-cells"

import { EmotionTheme, getMarkdownTextColors } from "~lib/theme"
import { isNullOrUndefined } from "~lib/util/utils"

import {
  BaseColumn,
  BaseColumnProps,
  formatNumber,
  getEmptyCell,
  getErrorCell,
  mergeColumnParameters,
  toSafeArray,
  toSafeNumber,
  toSafeString,
} from "./utils"

export const LINE_CHART_TYPE = "line_chart"
export const AREA_CHART_TYPE = "area_chart"
export const BAR_CHART_TYPE = "bar_chart"

/**
 * Get the color mapping to map a user-defined color to the our
 * theme color (markdown text color)
 *
 * @param theme The theme to use.
 * @returns The color mapping.
 */
const getColorMapping = (theme: EmotionTheme): Map<string, string> => {
  // const dividerColor = getDividerColors(theme)
  const textColors = getMarkdownTextColors(theme)
  return new Map(
    Object.entries({
      // red: textColors.red,
      // blue: textColors.blue,
      // green: textColors.green,
      // yellow: textColors.yellow,
      // violet: textColors.violet,
      // purple: textColors.purple,
      // orange: textColors.orange,
      // gray: textColors.gray,
      // grey: textColors.gray,
      // primary: textColors.primary,
      // red: textBgColors.redbg,
      // blue: textBgColors.bluebg,
      // green: textBgColors.greenbg,
      // yellow: textBgColors.yellowbg,
      // violet: textBgColors.violetbg,
      // purple: textBgColors.purplebg,
      // orange: textBgColors.orangebg,
      // gray: textBgColors.graybg,
      // grey: textBgColors.graybg,
      // primary: textBgColors.primarybg,
      red: theme.colors.red,
      blue: theme.colors.blue,
      green: theme.colors.green,
      yellow: theme.colors.yellow,
      violet: theme.colors.violet,
      purple: theme.colors.purple,
      orange: theme.colors.orange,
      gray: theme.colors.gray,
      grey: theme.colors.gray,
      primary: theme.colors.primary,
      // red: dividerColor.red,
      // blue: dividerColor.blue,
      // green: dividerColor.green,
      // yellow: dividerColor.yellow,
      // violet: dividerColor.violet,
      // purple: dividerColor.purple,
      // orange: dividerColor.orange,
      // gray: dividerColor.gray,
      // grey: dividerColor.gray,
      // primary: dividerColor.primary,
    })
  )
}

export interface ChartColumnParams {
  /**
   * The minimum value used for plotting the chart. Defaults to 0.
   */
  readonly y_min?: number
  /**
   * The maximum value used for plotting the chart. Defaults to 1.
   */
  readonly y_max?: number
  /**
   * The color to use for the charts. Can be:
   * - trend & trend-inverse: To color the charts green or red depending on the data.
   * - red, blue, green, yellow, orange, violet, gray/grey, primary
   * - a color value compatible with canvas rendering
   */
  readonly color?: string
}

/**
 * Base class for chart columns. This class is not meant to be used directly.
 * Instead, use the LineChartColumn and BarChartColumn classes.
 */
function BaseChartColumn(
  kind: string,
  props: BaseColumnProps,
  chart_type: "line" | "bar" | "area",
  theme: EmotionTheme
): BaseColumn {
  const parameters = mergeColumnParameters(
    // Default parameters:
    {
      y_min: null,
      y_max: null,
      color: undefined,
    },
    // User parameters:
    props.columnTypeOptions
  ) as ChartColumnParams

  const colorMapping = getColorMapping(theme)

  let defaultColor: string | undefined
  if (parameters.color === "trend" || parameters.color === "trend-inverse") {
    // defaultColor = colorMapping.get("green")
    // defaultColor = getIncreasingGreen(theme)
    defaultColor = theme.colors.metricPositiveDeltaColor
  } else {
    defaultColor = parameters.color
      ? (colorMapping.get(parameters.color) ?? parameters.color)
      : undefined
  }

  const cellTemplate: SparklineCellType = {
    kind: GridCellKind.Custom,
    allowOverlay: false,
    copyData: "",
    contentAlign: props.contentAlignment,
    data: {
      kind: "sparkline-cell",
      values: [],
      displayValues: [],
      graphKind: chart_type,
      color: defaultColor,
      yAxis: [parameters.y_min ?? 0, parameters.y_max ?? 1],
    },
  }

  return {
    ...props,
    kind,
    typeIcon:
      kind === LINE_CHART_TYPE
        ? ":material/show_chart:"
        : kind === BAR_CHART_TYPE
          ? ":material/bar_chart:"
          : ":material/area_chart:",
    sortMode: "default",
    isEditable: false, // Chart column is always read-only
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    getCell(data?: any): GridCell {
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

      let maxValueDefault: number
      let minValueDefault: number

      if (chartData.length === 1) {
        let newMaxValue: number

        if (maxValue <= 0) newMaxValue = maxValue === 0 ? 1 : 0
        else newMaxValue = maxValue

        maxValueDefault = parameters.y_max ?? newMaxValue
        minValueDefault = parameters.y_min ?? (maxValue >= 0 ? 0 : maxValue) //maxValue = minValue (only one value in chartData)
      } else {
        maxValueDefault = parameters.y_max ?? maxValue
        minValueDefault = parameters.y_min ?? minValue
      }

      if (
        isNullOrUndefined(minValueDefault) ||
        isNullOrUndefined(maxValueDefault) ||
        Number.isNaN(minValueDefault) ||
        Number.isNaN(maxValueDefault) ||
        minValueDefault >= maxValueDefault
      ) {
        return getErrorCell(
          "Invalid min/max y-axis configuration",
          `The y_min (${minValueDefault}) and y_max (${maxValueDefault}) configuration options must be valid numbers.`
        )
      }

      if (
        convertedChartData.length > 0 &&
        (maxValue > maxValueDefault || minValue < minValueDefault)
      ) {
        // Normalize values between the configured range
        normalizedChartData = convertedChartData.map(v =>
          maxValue - minValue === 0 // Prevent division by zero
            ? maxValue > (maxValueDefault || 1)
              ? maxValueDefault // Use max value
              : minValueDefault // Use min value
            : (maxValueDefault - minValueDefault) *
                ((v - minValue) / (maxValue - minValue)) +
              minValueDefault
        )
      } else {
        // Values are already in the configured range
        normalizedChartData = convertedChartData
      }

      // Check if the first value is larger than the second value
      let chartColor = defaultColor
      if (
        parameters.color === "trend" &&
        // Chart is pointing down
        normalizedChartData[0] >
          normalizedChartData[normalizedChartData.length - 1]
      ) {
        // chartColor = colorMapping.get("red")
        // chartColor = getDecreasingRed(theme)
        chartColor = theme.colors.metricNegativeDeltaColor
      } else if (
        parameters.color === "trend-inverse" &&
        // Chart is pointing up:
        normalizedChartData[0] <
          normalizedChartData[normalizedChartData.length - 1]
      ) {
        // chartColor = colorMapping.get("red")
        // chartColor = getDecreasingRed(theme)
        chartColor = theme.colors.metricNegativeDeltaColor
      }

      return {
        ...cellTemplate,
        copyData: convertedChartData.join(","), // Column sorting is done via the copyData value
        data: {
          ...cellTemplate.data,
          values: normalizedChartData,
          displayValues: convertedChartData.map(v => formatNumber(v)),
          yAxis: [minValueDefault, maxValueDefault],
          color: chartColor,
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

/**
 * A column type that renders the cell value as a line-chart.
 * The data is expected to be a numeric array.
 *
 * This column type is currently read-only.
 */
export function LineChartColumn(
  props: BaseColumnProps,
  theme: EmotionTheme
): BaseColumn {
  return BaseChartColumn(LINE_CHART_TYPE, props, "line", theme)
}

LineChartColumn.isEditableType = false

/**
 * A column type that renders the cell value as a bar-chart.
 * The data is expected to be a numeric array.
 *
 * This column type is currently read-only.
 */
export function BarChartColumn(
  props: BaseColumnProps,
  theme: EmotionTheme
): BaseColumn {
  return BaseChartColumn(BAR_CHART_TYPE, props, "bar", theme)
}

BarChartColumn.isEditableType = false

/**
 * A column type that renders the cell value as an area-chart.
 * The data is expected to be a numeric array.
 *
 * This column type is currently read-only.
 */
export function AreaChartColumn(
  props: BaseColumnProps,
  theme: EmotionTheme
): BaseColumn {
  return BaseChartColumn(AREA_CHART_TYPE, props, "area", theme)
}

AreaChartColumn.isEditableType = false
