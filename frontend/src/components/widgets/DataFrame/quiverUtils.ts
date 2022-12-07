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
  Theme as GlideTheme,
  CustomCell,
  TextCell,
  NumberCell,
} from "@glideapps/glide-data-grid"

import { DataFrameCell, Quiver, Type as QuiverType } from "src/lib/Quiver"
import { notNullOrUndefined } from "src/lib/utils"

import {
  ColumnType,
  CustomColumn,
  isEditableType,
  getCell,
  processDisplayData,
  isErrorCell,
} from "./DataFrameCells"

/**
 * Extracts a CSS property value from a given CSS style string by using a regex.
 *
 * @param htmlElementId: The ID of the HTML element to extract the property for.
 * @param property: The css property to extract the value for.
 * @param cssStyle: The css style string.
 *
 * @return the CSS property value or undefined if the property is not found.
 */
function extractCssProperty(
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
function applyPandasStylerCss(
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

export function getIndexFromQuiver(
  data: Quiver,
  indexPosition: number
): CustomColumn {
  const quiverType = data.types.index[indexPosition]
  const columnType = getColumnTypeFromQuiver(quiverType)

  return {
    id: `index-${indexPosition}`,
    isEditable: false, // Indices are not editable at the moment.
    title: "", // Indices have empty titles as default.
    columnType,
    quiverType,
    isIndex: true,
    isHidden: false,
    hasMenu: false,
  } as CustomColumn
}

export function getColumnFromQuiver(
  data: Quiver,
  columnPosition: number
): CustomColumn {
  const title = data.columns[0][columnPosition]
  const quiverType = data.types.data[columnPosition]
  const columnType = getColumnTypeFromQuiver(quiverType)

  let columnTypeMetadata = undefined
  if (columnType === ColumnType.Categorical) {
    // Get the available categories and use it in column type metadata
    let options = data.getCategoricalOptions(columnPosition)
    if (notNullOrUndefined(options)) {
      columnTypeMetadata = {
        options: ["", ...options.filter(opt => opt !== "")],
      }
    }
  }

  if (columnType === ColumnType.Boolean) {
    columnTypeMetadata = {
      options: ["", "true", "false"],
    }
  }

  return {
    id: `column-${title}-${columnPosition}`,
    isEditable: isEditableType(columnType),
    title,
    quiverType,
    columnType,
    columnTypeMetadata,
    isIndex: false,
    isHidden: false,
    hasMenu: false,
  } as CustomColumn
}

/**
 * Maps the data type from Quiver to a valid column type.
 */
export function getColumnTypeFromQuiver(quiverType: QuiverType): ColumnType {
  if (!quiverType) {
    return ColumnType.Object
  }

  let typeName = Quiver.getTypeName(quiverType)

  let columnType = ColumnType.Object

  if (!typeName) {
    // Use text column as fallback
    return ColumnType.Object
  }

  typeName = typeName.toLowerCase().trim()
  // TODO(lukasmasuch): Add support for empty columns?

  // Match based on quiver types
  if (["unicode"].includes(typeName)) {
    columnType = ColumnType.Text
  } else if (typeName === "date") {
    columnType = ColumnType.Date
  } else if (typeName === "time") {
    columnType = ColumnType.Time
  } else if (["datetime", "datetimetz"].includes(typeName)) {
    columnType = ColumnType.DateTime
  } else if (["boolean", "bool"].includes(typeName)) {
    columnType = ColumnType.Boolean
  } else if (
    [
      "int8",
      "int16",
      "int32",
      "int64",
      "uint8",
      "uint16",
      "uint32",
      "uint64",
      "range",
    ].includes(typeName)
  ) {
    // The default index in pandas uses a range type.
    columnType = ColumnType.Integer
  } else if (
    ["float16", "float32", "float64", "float96", "float128"].includes(typeName)
  ) {
    columnType = ColumnType.Float
  } else if (typeName === "categorical") {
    columnType = ColumnType.Categorical
  } else if (typeName.startsWith("list")) {
    columnType = ColumnType.List
  } else if (["decimal", "bytes", "empty"].includes(typeName)) {
    columnType = ColumnType.Object
  }

  return columnType
}

export function getColumnsFromQuiver(data: Quiver): CustomColumn[] {
  const columns: CustomColumn[] = []

  if (data.isEmpty()) {
    // Tables that don't have any columns cause an exception in glide-data-grid.
    // As a workaround, we are adding an empty index column in this case.
    columns.push({
      id: `empty-index`,
      title: "",
      hasMenu: false,
      columnType: ColumnType.Object,
      indexNumber: 0,
      isEditable: false,
      isIndex: true,
    } as CustomColumn)
    return columns
  }

  const numIndices = data.types?.index?.length ?? 0
  const numColumns = data.columns?.[0]?.length ?? 0

  for (let i = 0; i < numIndices; i++) {
    const column = {
      ...getIndexFromQuiver(data, i),
      indexNumber: i,
    } as CustomColumn

    columns.push(column)
  }

  for (let i = 0; i < numColumns; i++) {
    const column = {
      ...getColumnFromQuiver(data, i),
      indexNumber: i + numIndices,
    } as CustomColumn

    columns.push(column)
  }
  return columns
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

  if (isErrorCell(cellTemplate)) {
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
    } else if (
      [ColumnType.Integer, ColumnType.Float].includes(columnConfig.columnType)
    ) {
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
