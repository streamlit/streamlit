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
  GridColumn,
  TextCell,
  Theme as GlideTheme,
  BooleanCell,
  NumberCell,
  BubbleCell,
  UriCell,
  ImageCell,
  CustomCell,
  LoadingCell,
  EditableGridCell,
} from "@glideapps/glide-data-grid"
import { Vector } from "apache-arrow"
import { sprintf } from "sprintf-js"

import {
  DataFrameCell,
  Quiver,
  DataType,
  Type as QuiverType,
} from "src/lib/Quiver"
import { notNullOrUndefined } from "src/lib/utils"

/**
 * All the supported column types.
 */
export enum ColumnType {
  Text = "text",
  Number = "number",
  Boolean = "boolean",
  List = "list",
  Url = "url",
  Image = "image",
  BarChart = "bar-chart",
  LineChart = "line-chart",
  ProgressChart = "progress-chart",
}

/**
 * A configuration for a grid column.
 */
export type CustomColumn = GridColumn & {
  // The index number of the column.
  indexNumber: number
  // The type of the column.
  columnType: ColumnType
  // The quiver data type of the column.
  quiverType: QuiverType
  // If `True`, the column can be edited.
  isEditable: boolean
  // If `True`, the column is hidden (will not be shown).
  isHidden: boolean
  // If `True`, the column is a table index.
  isIndex: boolean
  // Additional metadata related to the column type.
  columnTypeMetadata?: Record<string, unknown>
  // The content alignment of the column.
  contentAlignment?: "left" | "center" | "right"
}

/**
 * Maps the data type from column config to a valid column type.
 */
export function getColumnTypeFromConfig(typeName?: string): ColumnType {
  if (!typeName) {
    // Use text column as fallback
    return ColumnType.Text
  }

  typeName = typeName.toLowerCase().trim()

  // Match with types from enum
  if (Object.values(ColumnType).some((type: string) => type === typeName)) {
    return typeName as ColumnType
  }

  return ColumnType.Text
}

/**
 * Maps the data type from Quiver to a valid column type.
 */
export function getColumnTypeFromQuiver(quiverType: QuiverType): ColumnType {
  let typeName = Quiver.getTypeName(quiverType)

  let columnType = ColumnType.Text

  if (!typeName) {
    // Use text column as fallback
    return ColumnType.Text
  }

  typeName = typeName.toLowerCase().trim()

  // Match based on quiver types
  if (["unicode"].includes(typeName)) {
    columnType = ColumnType.Text
  } else if (["date", "datetime", "datetimetz"].includes(typeName)) {
    // TODO(lukasmasuch): Support datetime columns
    columnType = ColumnType.Text
  } else if (typeName === "bool") {
    columnType = ColumnType.Boolean
  } else if (["int64", "float64", "range"].includes(typeName)) {
    // The default index in pandas uses a range type.
    columnType = ColumnType.Number
  } else if (typeName.startsWith("list")) {
    columnType = ColumnType.List
  }

  return columnType
}

/**
 * Returns either the formatted content or display value for a Quiver cell.
 */
export function getDisplayContent(quiverCell: DataFrameCell): string {
  const displayContent =
    quiverCell.displayContent ||
    Quiver.format(quiverCell.content, quiverCell.contentType, quiverCell.field)

  // Remove all line breaks
  return displayContent.replace(/(\r\n|\n|\r)/gm, " ")
}

/**
 * Extracts a CSS property value from a given CSS style string by using a regex.
 *
 * @param htmlElementId: The ID of the HTML element to extract the property for.
 * @param property: The css property to extract the value for.
 * @param cssStyle: The css style string.
 *
 * @return the CSS property value or undefined if the property is not found.
 */
export function extractCssProperty(
  htmlElementId: string,
  property: string,
  cssStyle: string
): string | undefined {
  // This regex is supposed to extract the value of a CSS property
  // for a specified HTML element ID from a CSS style string:
  const regex = new RegExp(
    `${htmlElementId}[,\\s].*{(?:[^}]*[\\s;]{1})?${property}:\\s*([^;}]+)[;]?.*}`,
    "gm"
  )
  // Makes the regex simpler to match the element correctly:
  cssStyle = cssStyle.replace(/{/g, " {")

  const match = regex.exec(cssStyle)
  if (match) {
    return match[1].trim()
  }

  return undefined
}

/**
 * Applies pandas styler CSS to style the cell.
 *
 * @param cell: The cell to style.
 * @param cssId: The css ID of the cell.
 * @param cssStyles: All CSS styles from pandas styler.
 *
 * @return a styled grid cell.
 */
export function applyPandasStylerCss(
  cell: GridCell,
  cssId: string,
  cssStyles: string
): GridCell {
  const themeOverride = {} as Partial<GlideTheme>

  // Extract and apply the font color
  const fontColor = extractCssProperty(cssId, "color", cssStyles)
  if (fontColor) {
    themeOverride.textDark = fontColor
  }

  // Extract and apply the background color
  const backgroundColor = extractCssProperty(
    cssId,
    "background-color",
    cssStyles
  )
  if (backgroundColor) {
    themeOverride.bgCell = backgroundColor
  }

  if (themeOverride) {
    // Apply the background and font color in the theme override
    return {
      ...cell,
      themeOverride,
    }
  }
  return cell
}

/**
 * Returns a template object representing an empty cell for a given column.
 *
 * @param columnConfig: The configuration of the column.
 *
 * @return a GridCell object that can be used by glide-data-grid.
 */
export function getCellTemplate(columnConfig: CustomColumn): GridCell {
  const style = columnConfig.isIndex ? "faded" : "normal"
  const readonly = !columnConfig.isEditable
  const contentAlign = columnConfig.contentAlignment

  switch (columnConfig.columnType) {
    case ColumnType.Text:
      return {
        kind: GridCellKind.Text,
        data: "",
        displayData: "",
        allowOverlay: true,
        contentAlign,
        readonly,
        style,
      } as TextCell
    case ColumnType.Boolean:
      return {
        kind: GridCellKind.Boolean,
        data: false,
        allowOverlay: false, // no overlay possible
        contentAlign,
        readonly,
        style,
      } as BooleanCell
    case ColumnType.Number:
      return {
        kind: GridCellKind.Number,
        data: undefined,
        displayData: "",
        readonly,
        allowOverlay: true,
        contentAlign: columnConfig.contentAlignment || "right",
        style,
      } as NumberCell
    case ColumnType.List:
      return {
        kind: GridCellKind.Bubble,
        data: [],
        allowOverlay: true,
        contentAlign,
        style,
      } as BubbleCell
    case ColumnType.Url:
      return {
        kind: GridCellKind.Uri,
        data: "",
        readonly,
        allowOverlay: true,
        contentAlign,
        style,
      } as UriCell
    case ColumnType.Image:
      return {
        kind: GridCellKind.Image,
        data: [],
        displayData: [],
        allowAdd: !readonly,
        allowOverlay: true,
        contentAlign,
        style,
      } as ImageCell
    case ColumnType.LineChart:
      return {
        kind: GridCellKind.Custom,
        allowOverlay: false,
        copyData: "[]",
        contentAlign,
        data: {
          kind: "sparkline-cell",
          values: [],
          displayValues: [],
          graphKind: "line",
          yAxis: [0, 1],
        },
      } as CustomCell
    case ColumnType.BarChart:
      return {
        kind: GridCellKind.Custom,
        allowOverlay: false,
        copyData: "[]",
        contentAlign,
        data: {
          kind: "sparkline-cell",
          values: [],
          graphKind: "bar",
          yAxis: [0, 1],
        },
      } as CustomCell
    case ColumnType.ProgressChart:
      return {
        kind: GridCellKind.Custom,
        allowOverlay: false,
        copyData: "",
        contentAlign,
        data: {
          kind: "range-cell",
          min: 0,
          max: 1,
          value: 0,
          step: 0.1,
          label: `0%`,
          measureLabel: "100%",
        },
      } as CustomCell
    default:
      throw new Error(`Unsupported cell type: ${columnConfig.columnType}`)
  }
}

/**
 * Returns the sort mode based on the given column type.
 */
export function getColumnSortMode(columnType: ColumnType): string {
  if (
    columnType === ColumnType.Number ||
    columnType === ColumnType.ProgressChart
  ) {
    // Smart mode also works correctly for numbers
    return "smart"
  }

  return "default"
}

/**
 * Returns an empty text cell.
 *
 * @param readonly: If true, returns a read-only version of the cell.
 * @param faded: If true, returns a faded version of the cell.
 *
 * @return a GridCell object that can be used by glide-data-grid.
 */
export function getTextCell(readonly: boolean, faded: boolean): GridCell {
  const style = faded ? "faded" : "normal"
  return {
    kind: GridCellKind.Text,
    data: "",
    displayData: "",
    allowOverlay: true,
    readonly,
    style,
  } as TextCell
}

/**
 * Returns an empty cell.
 */
function getEmptyCell(): LoadingCell {
  return {
    kind: GridCellKind.Loading,
    allowOverlay: false,
  } as LoadingCell
}

/**
 * Returns a cell with an error message.
 *
 * @param errorMsg: A short error message to use as display value.
 * @param errorDetails: The full error message to show when the user
 *                     clicks on a cell.
 *
 * @return a GridCell object that can be used by glide-data-grid.
 */
export function getErrorCell(errorMsg: string, errorDetails = ""): TextCell {
  return {
    ...getTextCell(true, false),
    data: errorMsg + (errorDetails ? `\n${errorDetails}` : ""),
    displayData: errorMsg,
    themeOverride: {
      textDark: "#ff4b4b", // TODO(lukasmasuch): use color from theme?
    },
  } as TextCell
}

/**
 * Fill in data into a text cell.
 *
 * @param cell: The grid cell to fill in with data.
 * @param data: The raw data to fill in.
 * @param displayData: The data to use as display value.
 *
 * @return a filled in text cell.
 */
function fillTextCell(
  cell: GridCell,
  data: DataType,
  displayData: string
): GridCell {
  return {
    ...cell,
    data:
      typeof data === "string" || !notNullOrUndefined(data) // don't use formattedContents for null/undefined
        ? data
        : displayData,
    displayData,
  } as TextCell
}

/**
 * Fill in data into a boolean cell.
 *
 * @param cell: The grid cell to fill in with data.
 * @param data: The raw data to fill in.
 *
 * @return a filled in boolean cell.
 */
function fillBooleanCell(cell: GridCell, data: any): GridCell {
  if (notNullOrUndefined(data) && typeof data !== "boolean") {
    return getErrorCell(`Incompatible boolean value: ${data}`)
  }

  return {
    ...cell,
    data,
  } as BooleanCell
}

/**
 * Fill in data into a number cell.
 *
 * @param cell: The grid cell to fill in with data.
 * @param data: The raw data to fill in.
 * @param displayData: The data to use as display value.
 *
 * @return a filled in number cell.
 */
function fillNumberCell(
  cell: GridCell,
  data: DataType,
  displayData: string,
  typeMetadata?: Record<string, unknown>
): GridCell {
  let cellData

  if (notNullOrUndefined(data)) {
    if (data instanceof Int32Array) {
      // int values need to be extracted this way:
      // eslint-disable-next-line prefer-destructuring
      cellData = Number(data[0])
    } else {
      cellData = Number(data)
    }

    if (Number.isNaN(cellData)) {
      return getErrorCell(`Incompatible number value: ${data}`)
    }

    // If user has specified a format in type metadata,
    // use d3 format to format the number
    if (
      typeMetadata &&
      "format" in typeMetadata &&
      typeof typeMetadata.format === "string"
    ) {
      try {
        displayData = sprintf(typeMetadata.format, cellData)
      } catch (error) {
        return getErrorCell(
          `Format value (${typeMetadata.format}) not sprintf compatible: ${error}`
        )
      }
    }
  }

  return {
    ...cell,
    data: cellData,
    displayData,
  } as NumberCell
}

/**
 * Fill in data into a list cell.
 *
 * @param cell: The grid cell to fill in with data.
 * @param data: The raw data to fill in.
 *
 * @return a filled in list cell.
 */
function fillListCell(cell: GridCell, data: DataType): GridCell {
  let cellData = []

  if (notNullOrUndefined(data)) {
    cellData = JSON.parse(
      JSON.stringify(data, (_key, value) =>
        typeof value === "bigint" ? Number(value) : value
      )
    )
    if (!Array.isArray(cellData)) {
      // Transform into list
      cellData = [String(cellData)]
      // TODO: Or return error?
      // return getErrorCell(
      //   `Incompatible list value: ${quiverCell.content}`,
      //   "The provided value is not an array."
      // )
    }
  }

  return {
    ...cell,
    data: cellData,
  } as BubbleCell
}

/**
 * Fill in data into an URL cell.
 *
 * @param cell: The grid cell to fill in with data.
 * @param data: The raw data to fill in.
 *
 * @return a filled in URL cell.
 */
function fillUrlCell(cell: GridCell, data: DataType): GridCell {
  return {
    ...cell,
    data: notNullOrUndefined(data) ? String(data) : "",
  } as UriCell
}

/**
 * Fill in data into a image cell.
 *
 * @param cell: The grid cell to fill in with data.
 * @param data: The raw data to fill in.
 *
 * @return a filled in image cell.
 */
function fillImageCell(cell: GridCell, data: DataType): GridCell {
  const imageUrls = notNullOrUndefined(data) ? [String(data)] : []

  return {
    ...cell,
    data: imageUrls,
    displayData: imageUrls,
  } as ImageCell
}

/**
 * Fill in data into a chart cell.
 *
 * @param cell: The grid cell to fill in with data.
 * @param data: The raw data to fill in.
 *
 * @return a filled in chart cell.
 */
function fillChartCell(cell: GridCell, data: DataType): GridCell {
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
      `Incompatible chart value: ${data}`,
      "The provided value is not a number array."
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
          `Incompatible chart value: ${data}`,
          "All values in the array should be numbers."
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
    ...cell,
    copyData: JSON.stringify(convertedChartData),
    data: {
      ...(cell as CustomCell)?.data,
      values: normalizedChartData,
      displayValues: convertedChartData,
    },
  } as CustomCell
}

/**
 * Fill in data into a progress cell.
 *
 * @param cell: The grid cell to fill in with data.
 * @param data: The raw data to fill in.
 *
 * @return a filled in progress cell.
 */
export function fillProgressCell(cell: GridCell, data: DataType): GridCell {
  if (!notNullOrUndefined(data)) {
    return getEmptyCell()
  }

  const cellData = Number(data)

  if (Number.isNaN(cellData) || cellData < 0 || cellData > 1) {
    return getErrorCell(
      `Incompatible progress value: ${data}`,
      "The value has to be between 0 and 1."
    )
  }

  return {
    ...cell,
    copyData: String(data),
    data: {
      ...(cell as CustomCell)?.data,
      value: cellData,
      label: `${Math.round(cellData * 100).toString()}%`,
    },
  } as CustomCell
}

/**
 * Returns a glide-data-grid compatible cell object based on the
 * cell data from the quiver object. Different types of data will
 * result in different cell types.
 *
 * @param cellTemplate: the empty cell template from the column.
 * @param quiverCell: a dataframe cell object from Quiver.
 * @param cssStyles: optional css styles to apply on the cell.
 *
 * @return a GridCell object that can be used by glide-data-grid.
 */
export function fillCellTemplate(
  cellTemplate: GridCell,
  quiverCell: DataFrameCell,
  columnConfig: CustomColumn,
  cssStyles: string | undefined = undefined
): GridCell {
  let cellKind: GridCellKind | string = cellTemplate.kind
  if (cellTemplate.kind === GridCellKind.Custom) {
    cellKind = (cellTemplate.data as any)?.kind
  }

  if (!cellKind) {
    return getErrorCell("Unable to determine cell type.")
  }

  if (cssStyles && quiverCell.cssId) {
    cellTemplate = applyPandasStylerCss(
      cellTemplate,
      quiverCell.cssId,
      cssStyles
    )
  }

  switch (cellKind) {
    case GridCellKind.Text:
      return fillTextCell(
        cellTemplate,
        quiverCell.content,
        getDisplayContent(quiverCell)
      )
    case GridCellKind.Number:
      return fillNumberCell(
        cellTemplate,
        quiverCell.content,
        getDisplayContent(quiverCell),
        columnConfig.columnTypeMetadata
      )
    case GridCellKind.Boolean:
      return fillBooleanCell(cellTemplate, quiverCell.content)
    case GridCellKind.Bubble:
      return fillListCell(cellTemplate, quiverCell.content)
    case GridCellKind.Uri:
      return fillUrlCell(cellTemplate, quiverCell.content)
    case GridCellKind.Image:
      return fillImageCell(cellTemplate, quiverCell.content)
    case "sparkline-cell":
      return fillChartCell(cellTemplate, quiverCell.content)
    case "range-cell":
      return fillProgressCell(cellTemplate, quiverCell.content)
    default:
      return getErrorCell(`Unsupported cell kind: ${cellKind}`)
  }
}

export function updateCell(
  cell: EditableGridCell,
  newValue: DataType,
  newDisplayValue?: string
): GridCell {
  let cellKind: GridCellKind | string = cell.kind
  if (cell.kind === GridCellKind.Custom) {
    cellKind = (cell.data as any)?.kind
  }

  if (!cellKind) {
    return getErrorCell("Unable to determine cell type.")
  }
  let updatedCell
  switch (cellKind) {
    case GridCellKind.Text:
      updatedCell = fillTextCell(
        cell,
        newValue,
        notNullOrUndefined(newDisplayValue)
          ? newDisplayValue
          : String(newValue)
      )
      break
    case GridCellKind.Number:
      updatedCell = fillNumberCell(
        cell,
        newValue,
        notNullOrUndefined(newDisplayValue)
          ? newDisplayValue
          : String(newValue)
      )
      break
    case GridCellKind.Boolean:
      updatedCell = fillBooleanCell(cell, newValue)
      break
    case GridCellKind.Uri:
      updatedCell = fillUrlCell(cell, newValue)
      break
    default:
      return getErrorCell(`Cell cannot be edited: ${cellKind}`)
  }

  return {
    ...updatedCell,
    lastUpdated: performance.now(),
  }
}
