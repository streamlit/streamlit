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
  DropdownCellType,
  SparklineCellType,
  DatePickerType,
  RangeCellType,
} from "@glideapps/glide-data-grid-cells"

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
  Date = "date",
  DateTime = "datetime",
  Time = "time",
  BarChart = "bar-chart",
  LineChart = "line-chart",
  ProgressChart = "progress-chart",
  Categorical = "categorical",
  Object = "object", // Fallback for non-editable types show as read-only text
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

interface ErrorCell extends TextCell {
  readonly isError: true
}

/**
 * Maps the data type from column config to a valid column type.
 */
export function getColumnTypeFromConfig(typeName?: string): ColumnType {
  if (!typeName) {
    // Use text column as fallback
    return ColumnType.Object
  }

  typeName = typeName.toLowerCase().trim()

  // Match with types from enum
  if (Object.values(ColumnType).some((type: string) => type === typeName)) {
    return typeName as ColumnType
  }

  return ColumnType.Object
}

/**
 * Maps the data type from Quiver to a valid column type.
 */
export function getColumnTypeFromQuiver(quiverType: QuiverType): ColumnType {
  let typeName = Quiver.getTypeName(quiverType)

  let columnType = ColumnType.Object

  if (!typeName) {
    // Use text column as fallback
    return ColumnType.Object
  }

  typeName = typeName.toLowerCase().trim()

  // Match based on quiver types
  if (["unicode"].includes(typeName)) {
    columnType = ColumnType.Text
  } else if (typeName === "date") {
    columnType = ColumnType.Date
  } else if (typeName === "time") {
    columnType = ColumnType.Time
  } else if (["datetime", "datetimetz"].includes(typeName)) {
    columnType = ColumnType.DateTime
  } else if (typeName === "bool") {
    columnType = ColumnType.Boolean
  } else if (["int64", "float64", "range"].includes(typeName)) {
    // The default index in pandas uses a range type.
    columnType = ColumnType.Number
  } else if (typeName === "categorical") {
    columnType = ColumnType.Categorical
  } else if (typeName.startsWith("list")) {
    columnType = ColumnType.List
  }

  return columnType
}

/**
 * Checks of the given column type supports editing.
 */
export function isEditableType(type: ColumnType): boolean {
  return [
    ColumnType.Text,
    ColumnType.Number,
    ColumnType.Boolean,
    ColumnType.Date,
    ColumnType.Time,
    ColumnType.DateTime,
    ColumnType.Url,
    ColumnType.Categorical,
  ].includes(type)
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
export function getTextCell(readonly: boolean, faded: boolean): TextCell {
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
export function getErrorCell(errorMsg: string, errorDetails = ""): ErrorCell {
  return {
    ...getTextCell(true, false),
    data: errorMsg + (errorDetails ? `\n${errorDetails}` : ""),
    displayData: errorMsg,
    themeOverride: {
      textDark: "#ff4b4b", // TODO(lukasmasuch): use color from theme?
    },
    isError: true,
  } as ErrorCell
}

/**
 * Fill in data into a text cell.
 *
 * @param cell: The grid cell to fill in with data.
 * @param data: The raw data to fill in.
 *
 * @return a filled in text cell.
 */
function fillTextCell(cell: TextCell, data: DataType): GridCell {
  try {
    const cellData = notNullOrUndefined(data) ? data.toString() : ""
    return {
      ...cell,
      data: cellData,
      displayData: cellData, // TODO(lukasmasuch): Use <NA> placeholder?
    } as TextCell
  } catch (error) {
    return getErrorCell(
      `Incompatible text value: ${typeof data}`,
      `Error: ${error}`
    )
  }
}

/**
 * Fill in data into a boolean cell.
 *
 * @param cell: The grid cell to fill in with data.
 * @param data: The raw data to fill in.
 *
 * @return a filled in boolean cell.
 */
function fillBooleanCell(cell: BooleanCell, data: any): GridCell {
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
 *
 * @return a filled in number cell.
 */
function fillNumberCell(
  cell: NumberCell,
  data: DataType,
  typeMetadata?: Record<string, unknown>
): GridCell {
  let cellData
  let displayData

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

    // If user has specified a format pattern in type metadata
    if (
      typeMetadata &&
      "format" in typeMetadata &&
      typeof typeMetadata.format === "string"
    ) {
      try {
        displayData = sprintf(typeMetadata.format, cellData)
      } catch (error) {
        return getErrorCell(
          `Format value (${typeMetadata.format}) not sprintf compatible.`,
          `Error: ${error}`
        )
      }
    }
  }

  if (!notNullOrUndefined(displayData)) {
    displayData = notNullOrUndefined(cellData) ? cellData.toString() : "" // TODO(lukasmasuch): Use <NA> placeholder?
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

function fillDateTimeCell(cell: DatePickerType, data: DataType): GridCell {
  // console.log(data)
  // console.log(typeof data)
  // console.log(cell)

  return cell
}

/**
 * Fill in data into a chart cell.
 *
 * @param cell: The grid cell to fill in with data.
 * @param data: The raw data to fill in.
 *
 * @return a filled in chart cell.
 */
function fillChartCell(cell: SparklineCellType, data: DataType): GridCell {
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
      ...cell.data,
      values: normalizedChartData,
      displayValues: convertedChartData.map(v => v.toString()),
    },
  } as SparklineCellType
}

/**
 * Fill in data into a progress cell.
 *
 * @param cell: The grid cell to fill in with data.
 * @param data: The raw data to fill in.
 *
 * @return a filled in progress cell.
 */
export function fillProgressCell(
  cell: RangeCellType,
  data: DataType
): GridCell {
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
      ...cell.data,
      value: cellData,
      label: `${Math.round(cellData * 100).toString()}%`,
    },
  } as RangeCellType
}

export function fillCategoricalCell(
  cell: DropdownCellType,
  data: DataType
): GridCell {
  let cellData = cell.data.value
  if (notNullOrUndefined(data)) {
    cellData = data.toString()
  }

  if (!cell.data.allowedValues.includes(cellData)) {
    console.log("reset", cell.data.allowedValues, cellData, data)
    cellData = cell.data.value
  }
  return {
    ...cell,
    copyData: cellData,
    data: {
      ...cell.data,
      value: cellData,
    },
  } as DropdownCellType
}

/**
 * Returns a glide-data-grid compatible cell object based on the
 * cell data from the quiver object. Different types of data will
 * result in different cell types.
 *
 * @param columnConfig: The configuration of the column.
 * @param data: The raw data to fill in.
 *
 * @return a GridCell object that can be used by glide-data-grid.
 */
export function getCell(
  columnConfig: CustomColumn,
  data: any | undefined
): GridCell {
  const style = columnConfig.isIndex ? "faded" : "normal"
  const readonly = !columnConfig.isEditable
  const contentAlign = columnConfig.contentAlignment
  let cellTemplate

  switch (columnConfig.columnType) {
    case ColumnType.Text:
      cellTemplate = {
        kind: GridCellKind.Text,
        data: "",
        displayData: "",
        allowOverlay: true,
        contentAlign,
        readonly,
        style,
      } as TextCell

      cellTemplate = fillTextCell(cellTemplate, data)
      break
    case ColumnType.Object || ColumnType.Time:
      cellTemplate = {
        kind: GridCellKind.Text,
        data: "",
        displayData: "",
        allowOverlay: true,
        contentAlign,
        readonly: true, // Object columns are always readonly
        style,
      } as TextCell

      cellTemplate = fillTextCell(cellTemplate, data)
      break
    case ColumnType.Boolean:
      cellTemplate = {
        kind: GridCellKind.Boolean,
        data: false,
        allowOverlay: false, // no overlay possible
        contentAlign,
        readonly,
        style,
      } as BooleanCell

      cellTemplate = fillBooleanCell(cellTemplate, data)
      break
    case ColumnType.Number:
      cellTemplate = {
        kind: GridCellKind.Number,
        data: undefined,
        displayData: "",
        readonly,
        allowOverlay: true,
        contentAlign: columnConfig.contentAlignment || "right",
        style,
      } as NumberCell
      cellTemplate = fillNumberCell(
        cellTemplate,
        data,
        columnConfig.columnTypeMetadata
      )
      break
    case ColumnType.List:
      cellTemplate = {
        kind: GridCellKind.Bubble,
        data: [],
        allowOverlay: true,
        contentAlign,
        style,
      } as BubbleCell

      cellTemplate = fillListCell(cellTemplate, data)
      break
    case ColumnType.Url:
      cellTemplate = {
        kind: GridCellKind.Uri,
        data: "",
        readonly,
        allowOverlay: true,
        contentAlign,
        style,
      } as UriCell

      cellTemplate = fillUrlCell(cellTemplate, data)
      break
    case ColumnType.Image:
      cellTemplate = {
        kind: GridCellKind.Image,
        data: [],
        displayData: [],
        allowAdd: !readonly,
        allowOverlay: true,
        contentAlign,
        style,
      } as ImageCell

      cellTemplate = fillImageCell(cellTemplate, data)
      break
    case ColumnType.Date:
      cellTemplate = {
        kind: GridCellKind.Custom,
        allowOverlay: true,
        copyData: "",
        contentAlign,
        data: {
          kind: "date-picker-cell",
          date: undefined,
          displayDate: "",
          format: "date",
        },
      } as DatePickerType

      cellTemplate = fillDateTimeCell(cellTemplate, data)
      break
    case ColumnType.DateTime:
      cellTemplate = {
        kind: GridCellKind.Custom,
        allowOverlay: true,
        copyData: "",
        contentAlign,
        data: {
          kind: "date-picker-cell",
          date: undefined,
          displayDate: "",
          format: "datetime-local",
        },
      } as DatePickerType

      cellTemplate = fillDateTimeCell(cellTemplate, data)
      break
    case ColumnType.Categorical:
      if (
        !(
          columnConfig.columnTypeMetadata &&
          "options" in columnConfig.columnTypeMetadata &&
          Array.isArray(columnConfig.columnTypeMetadata.options) &&
          columnConfig.columnTypeMetadata.options.length > 0
        )
      ) {
        return getErrorCell(
          "No options provided.",
          "The categorical cell type requires a list of options provided in the column metadata"
        )
      }

      cellTemplate = {
        kind: GridCellKind.Custom,
        allowOverlay: true,
        copyData: "",
        contentAlign,
        data: {
          kind: "dropdown-cell",
          allowedValues: columnConfig.columnTypeMetadata.options,
          value: columnConfig.columnTypeMetadata.options[0],
          readonly,
        },
      } as DropdownCellType
      cellTemplate = fillCategoricalCell(cellTemplate, data)
      break
    case ColumnType.LineChart:
      cellTemplate = {
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
      } as SparklineCellType

      cellTemplate = fillChartCell(cellTemplate, data)
      break
    case ColumnType.BarChart:
      cellTemplate = {
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
      } as SparklineCellType

      cellTemplate = fillChartCell(cellTemplate, data)
      break
    case ColumnType.ProgressChart:
      cellTemplate = {
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
      } as RangeCellType

      cellTemplate = fillProgressCell(cellTemplate, data)
      break
    default:
      // This should never happen
      return getErrorCell(`Unsupported cell type: ${columnConfig.columnType}`)
  }

  return cellTemplate
}

export function processDisplayData(displayData: string): string {
  // Remove all line breaks
  return displayData.replace(/(\r\n|\n|\r)/gm, " ")
}

/**
 * Returns a glide-data-grid compatible cell object based on the
 * cell data from the quiver object. Different types of data will
 * result in different cell types.
 *
 * @param columnConfig: The configuration of the column.
 * @param quiverCell: a dataframe cell object from Quiver.
 * @param cssStyles: optional css styles to apply on the cell.
 *
 * @return a GridCell object that can be used by glide-data-grid.
 */
export function getCellFromQuiver(
  columnConfig: CustomColumn,
  quiverCell: DataFrameCell,
  cssStyles: string | undefined = undefined
): GridCell {
  let cellTemplate

  if (columnConfig.columnType === ColumnType.Object) {
    // Always use display value from quiver for object types
    // these are special types that the dataframe only support in read-only mode.
    cellTemplate = getCell(
      columnConfig,
      processDisplayData(
        Quiver.format(
          quiverCell.content,
          quiverCell.contentType,
          quiverCell.field
        )
      )
    )
  } else {
    cellTemplate = getCell(columnConfig, quiverCell.content)
  }

  if (cellTemplate.hasOwnProperty("isError")) {
    // Directly return error cells without any additional modification
    return cellTemplate
  }

  if (notNullOrUndefined(quiverCell.displayContent)) {
    const displayData = processDisplayData(quiverCell.displayContent)
    // If the display content is set, use that instead of the content.
    // This is only supported for text, object, date, datetime, time and number cells.
    if (
      [ColumnType.Object, ColumnType.Text].includes(columnConfig.columnType)
    ) {
      cellTemplate = {
        ...cellTemplate,
        displayData,
      } as TextCell
    } else if (columnConfig.columnType === ColumnType.Number) {
      cellTemplate = {
        ...cellTemplate,
        displayData,
      } as NumberCell
    } else if (
      [ColumnType.Date, ColumnType.DateTime, ColumnType.Time].includes(
        columnConfig.columnType
      )
    ) {
      cellTemplate = {
        ...cellTemplate,
        copyData: displayData,
        data: {
          ...(cellTemplate as CustomCell)?.data,
          displayDate: displayData,
        },
      } as CustomCell
    }
  }

  if (cssStyles && quiverCell.cssId) {
    cellTemplate = applyPandasStylerCss(
      cellTemplate,
      quiverCell.cssId,
      cssStyles
    )
  }
  return cellTemplate
}

export function updateCell(
  columnConfig: CustomColumn,
  updatedCell: EditableGridCell
): GridCell {
  switch (columnConfig.columnType) {
    case ColumnType.Text ||
      ColumnType.Boolean ||
      ColumnType.Number ||
      ColumnType.Url:
      return {
        ...getCell(columnConfig, updatedCell.data),
        lastUpdated: performance.now(),
      }
    case ColumnType.Categorical:
      return {
        ...getCell(columnConfig, (updatedCell as DropdownCellType).data.value),
        lastUpdated: performance.now(),
      }
    case ColumnType.Date || ColumnType.DateTime:
      return {
        ...getCell(columnConfig, (updatedCell as DatePickerType).data.date),
        lastUpdated: performance.now(),
      }
    default:
      // This should never happen
      return getErrorCell(
        `Unsupported cell type for editing: ${columnConfig.columnType}`
      )
  }
}
