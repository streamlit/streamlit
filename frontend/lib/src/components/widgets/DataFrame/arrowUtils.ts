/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
  Theme as GlideTheme,
  GridCell,
  GridCellKind,
  NumberCell,
  TextCell,
  UriCell,
} from "@glideapps/glide-data-grid"
import { DatePickerType } from "@glideapps/glide-data-grid-cells"
import moment from "moment"

import {
  Type as ArrowType,
  DataFrameCell,
  Quiver,
} from "@streamlit/lib/src/dataframes/Quiver"
import {
  isNullOrUndefined,
  notNullOrUndefined,
} from "@streamlit/lib/src/util/utils"

import {
  BaseColumn,
  BaseColumnProps,
  CheckboxColumn,
  ColumnCreator,
  DateColumn,
  DateTimeColumn,
  isErrorCell,
  ListColumn,
  NumberColumn,
  ObjectColumn,
  removeLineBreaks,
  SelectboxColumn,
  TextColumn,
  TimeColumn,
} from "./columns"

/**
 * Extracts a CSS property value from a given CSS style string by using a regex.
 *
 * @param htmlElementId - The ID of the HTML element to extract the property for.
 * @param property - The css property to extract the value for.
 * @param cssStyle - The css style string.
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

  if (backgroundColor === "yellow" && fontColor === undefined) {
    // Yellow is used by pandas styler as the default highlight color.
    // But yellow won't work well with our default font color in dark mode.
    // Therefore, we are overriding the font color to our dark font color which
    // always works well with yellow background.
    themeOverride.textDark = "#31333F"
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
 * Maps the data type from Arrow to a column type.
 */
export function getColumnTypeFromArrow(arrowType: ArrowType): ColumnCreator {
  let typeName = arrowType ? Quiver.getTypeName(arrowType) : null

  if (!typeName) {
    // Use object column as fallback
    return ObjectColumn
  }

  typeName = typeName.toLowerCase().trim()
  // Match based on arrow types
  if (["unicode", "empty", "large_string[pyarrow]"].includes(typeName)) {
    return TextColumn
  }

  if (["datetime", "datetimetz"].includes(typeName)) {
    return DateTimeColumn
  }
  if (typeName === "time") {
    return TimeColumn
  }
  if (typeName === "date") {
    return DateColumn
  }
  if (["object", "bytes"].includes(typeName)) {
    return ObjectColumn
  }
  if (["bool"].includes(typeName)) {
    return CheckboxColumn
  }
  if (
    [
      "int8",
      "int16",
      "int32",
      "int64",
      "uint8",
      "uint16",
      "uint32",
      "uint64",
      "float16",
      "float32",
      "float64",
      "float96",
      "float128",
      "range", // The default index in pandas uses a range type.
      "decimal",
    ].includes(typeName)
  ) {
    return NumberColumn
  }
  if (typeName === "categorical") {
    return SelectboxColumn
  }
  if (typeName.startsWith("list")) {
    return ListColumn
  }

  return ObjectColumn
}

/**
 * Creates the column props for an index column from the Arrow metadata.
 *
 * @param data - The Arrow data.
 * @param indexPosition - The numeric position of the index column.
 *
 * @return the column props for the index column.
 */
export function getIndexFromArrow(
  data: Quiver,
  indexPosition: number
): BaseColumnProps {
  const arrowType = data.types.index[indexPosition]
  const title = data.indexNames[indexPosition]
  let isEditable = true

  if (Quiver.getTypeName(arrowType) === "range") {
    // Range indices are not editable
    isEditable = false
  }

  return {
    id: `index-${indexPosition}`,
    name: title,
    title,
    isEditable,
    arrowType,
    isIndex: true,
    isHidden: false,
  } as BaseColumnProps
}

/**
 * Creates the column props for a data column from the Arrow metadata.
 *
 * @param data - The Arrow data.
 * @param columnPosition - The numeric position of the data column.
 *        Starts with 0 at the first non-index column.
 *
 * @return the column props for the data column.
 */
export function getColumnFromArrow(
  data: Quiver,
  columnPosition: number
): BaseColumnProps {
  // data.columns refers to the header rows (not sure about why it is named this way)
  // It is a matrix of column names.
  const columnHeaderNames = data.columns.map(column => column[columnPosition])
  const title =
    columnHeaderNames.length > 0
      ? columnHeaderNames[columnHeaderNames.length - 1]
      : ""

  // If there are > 1 header columns, join all these headers with a "/"
  // and use it as the group name, but ignore empty strings headers.
  // This does not include the last column, which we use as the actual
  // column name. E.g.
  // columnHeaders = ["a", "b", "c"] -> group = "a / b" name: "c"
  // columnHeaders = ["", "b", "c"] -> group = "b" name: "c"

  const group =
    columnHeaderNames.length > 1
      ? columnHeaderNames
          .filter(column => column !== "")
          .slice(0, -1)
          .join(" / ")
      : undefined

  let arrowType = data.types.data[columnPosition]

  if (isNullOrUndefined(arrowType)) {
    // Use empty column type as fallback
    arrowType = {
      meta: null,
      numpy_type: "object",
      pandas_type: "object",
    } as ArrowType
  }

  let columnTypeOptions
  if (Quiver.getTypeName(arrowType) === "categorical") {
    // Get the available categories and use it in column type metadata
    const options = data.getCategoricalOptions(columnPosition)
    if (notNullOrUndefined(options)) {
      columnTypeOptions = {
        options,
      }
    }
  }

  return {
    id: `column-${title}-${columnPosition}`,
    name: title,
    title,
    isEditable: true,
    arrowType,
    columnTypeOptions,
    isIndex: false,
    isHidden: false,
    group,
  } as BaseColumnProps
}

/**
 * Creates the column props for an empty index column.
 * This is used for DataFrames that don't have any index.
 * At least one column is required for glide.
 */
export function getEmptyIndexColumn(): BaseColumnProps {
  return {
    id: `empty-index`,
    title: "",
    indexNumber: 0,
    isEditable: false,
    isIndex: true,
  } as BaseColumnProps
}

/**
 * Creates the column props for all columns from the Arrow metadata.
 *
 * @param data - The Arrow data.
 * @return the column props for all columns.
 */
export function getAllColumnsFromArrow(data: Quiver): BaseColumnProps[] {
  const columns: BaseColumnProps[] = []

  const { dimensions } = data
  const numIndices = dimensions.headerColumns
  const numColumns = dimensions.dataColumns

  if (numIndices === 0 && numColumns === 0) {
    // Tables that don't have any columns cause an exception in glide-data-grid.
    // As a workaround, we are adding an empty index column in this case.
    columns.push(getEmptyIndexColumn())
    return columns
  }

  for (let i = 0; i < numIndices; i++) {
    const column = {
      ...getIndexFromArrow(data, i),
      indexNumber: i,
    } as BaseColumnProps

    columns.push(column)
  }

  for (let i = 0; i < numColumns; i++) {
    const column = {
      ...getColumnFromArrow(data, i),
      indexNumber: i + numIndices,
    } as BaseColumnProps

    columns.push(column)
  }
  return columns
}

/**
 * Returns a glide-data-grid compatible cell object based on the
 * cell data from the Quiver (Arrow) object. Different types of data will
 * result in different cell types.
 *
 * @param column - The colum of the cell.
 * @param arrowCell - The dataframe cell object from Arrow.
 * @param cssStyles - Optional css styles to apply on the cell.
 *
 * @return a GridCell object that can be used by glide-data-grid.
 */
export function getCellFromArrow(
  column: BaseColumn,
  arrowCell: DataFrameCell,
  cssStyles: string | undefined = undefined
): GridCell {
  const typeName = column.arrowType
    ? Quiver.getTypeName(column.arrowType)
    : null

  let cellTemplate
  if (column.kind === "object") {
    // Always use display value from Quiver for object types
    // these are special types that the dataframe only support in read-only mode.
    cellTemplate = column.getCell(
      notNullOrUndefined(arrowCell.content)
        ? removeLineBreaks(
            Quiver.format(
              arrowCell.content,
              arrowCell.contentType,
              arrowCell.field
            )
          )
        : null
    )
  } else if (
    ["time", "date", "datetime"].includes(column.kind) &&
    notNullOrUndefined(arrowCell.content) &&
    (typeof arrowCell.content === "number" ||
      typeof arrowCell.content === "bigint")
  ) {
    // This is a special case where we want to already parse a numerical timestamp
    // to a date object based on the arrow field metadata.
    // Our implementation only supports unix timestamps in seconds, so we need to
    // do some custom conversion here.
    let parsedDate
    if (
      typeName === "time" &&
      notNullOrUndefined(arrowCell.field?.type?.unit)
    ) {
      // Time values needs to be adjusted to seconds based on the unit
      parsedDate = moment
        .unix(
          Quiver.convertToSeconds(
            arrowCell.content,
            arrowCell.field?.type?.unit ?? 0
          )
        )
        .utc()
        .toDate()
    } else {
      // All other datetime related values are assumed to be in milliseconds
      parsedDate = moment.utc(Number(arrowCell.content)).toDate()
    }

    cellTemplate = column.getCell(parsedDate)
  } else if (typeName === "decimal") {
    // This is a special case where we want to already prepare a decimal value
    // to a number string based on the arrow field metadata. This is required
    // because we don't have access to the required scale in the number column.
    const decimalStr = isNullOrUndefined(arrowCell.content)
      ? null
      : Quiver.format(
          arrowCell.content,
          arrowCell.contentType,
          arrowCell.field
        )
    cellTemplate = column.getCell(decimalStr)
  } else {
    cellTemplate = column.getCell(arrowCell.content)
  }

  if (isErrorCell(cellTemplate)) {
    // Directly return error cells without any additional modification
    return cellTemplate
  }

  if (!column.isEditable) {
    // Only apply display content and css styles to non-editable cells.
    if (notNullOrUndefined(arrowCell.displayContent)) {
      const displayData = removeLineBreaks(arrowCell.displayContent)
      // If the display content is set, use that instead of the content.
      // This is only supported for text, object, date, datetime, time and number cells.
      // Non-editable datetime cells will use the text cell kind
      // so we don't need to handle date-time-cell cells extra here.
      if (cellTemplate.kind === GridCellKind.Text) {
        cellTemplate = {
          ...cellTemplate,
          displayData,
        } as TextCell
      } else if (cellTemplate.kind === GridCellKind.Number) {
        cellTemplate = {
          ...cellTemplate,
          displayData,
        } as NumberCell
      } else if (cellTemplate.kind === GridCellKind.Uri) {
        cellTemplate = {
          ...cellTemplate,
          displayData,
        } as UriCell
      } else if (
        cellTemplate.kind === GridCellKind.Custom &&
        (cellTemplate as DatePickerType).data?.kind === "date-picker-cell"
      ) {
        cellTemplate = {
          ...cellTemplate,
          data: {
            ...(cellTemplate as DatePickerType).data,
            displayDate: displayData,
          },
        } as DatePickerType
      }
    }

    if (cssStyles && arrowCell.cssId) {
      cellTemplate = applyPandasStylerCss(
        cellTemplate,
        arrowCell.cssId,
        cssStyles
      )
    }
  }
  return cellTemplate
}
