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
  TextCell,
  NumberCell,
  GridCellKind,
} from "@glideapps/glide-data-grid"

import { DataFrameCell, Quiver, Type as QuiverType } from "src/lib/Quiver"
import { notNullOrUndefined } from "src/lib/utils"

import {
  BaseColumn,
  BaseColumnProps,
  ColumnCreator,
  ObjectColumn,
  BooleanColumn,
  NumberColumn,
  TextColumn,
  CategoricalColumn,
  ListColumn,
  isErrorCell,
} from "./columns"

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

export function processDisplayData(displayData: string): string {
  // Remove all line breaks
  return displayData.replace(/(\r\n|\n|\r)/gm, " ")
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
 * Maps the data type from Quiver to a valid column type.
 */
export function getColumnTypeFromQuiver(
  quiverType: QuiverType
): ColumnCreator {
  let typeName = quiverType ? Quiver.getTypeName(quiverType) : null

  if (!typeName) {
    // Use object column as fallback
    return ObjectColumn
  }

  typeName = typeName.toLowerCase().trim()
  // Match based on quiver types
  if (["unicode", "empty"].includes(typeName)) {
    return TextColumn
  } else if (["date", "time", "datetime", "datetimetz"].includes(typeName)) {
    return ObjectColumn
  } else if (["boolean", "bool"].includes(typeName)) {
    return BooleanColumn
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
      "float16",
      "float32",
      "float64",
      "float96",
      "float128",
      "range", // The default index in pandas uses a range type.
    ].includes(typeName)
  ) {
    return NumberColumn
  } else if (typeName === "categorical") {
    return CategoricalColumn
  } else if (typeName.startsWith("list")) {
    return ListColumn
  } else if (["decimal", "bytes"].includes(typeName)) {
    return ObjectColumn
  }

  return ObjectColumn
}

export function getIndexFromQuiver(
  data: Quiver,
  indexPosition: number
): BaseColumnProps {
  const quiverType = data.types.index[indexPosition]

  return {
    id: `index-${indexPosition}`,
    isEditable: false, // Indices are not editable at the moment.
    title: "", // Indices have empty titles as default.
    quiverType,
    isIndex: true,
    isHidden: false,
  } as BaseColumnProps
}

export function getColumnFromQuiver(
  data: Quiver,
  columnPosition: number
): BaseColumnProps {
  const title = data.columns[0][columnPosition]
  const quiverType = data.types.data[columnPosition]

  let columnTypeMetadata = undefined
  if (Quiver.getTypeName(quiverType) === "categorical") {
    // Get the available categories and use it in column type metadata
    let options = data.getCategoricalOptions(columnPosition)
    if (notNullOrUndefined(options)) {
      columnTypeMetadata = {
        options: ["", ...options.filter(opt => opt !== "")],
      }
    }
  }

  return {
    id: `column-${title}-${columnPosition}`,
    isEditable: true,
    title,
    quiverType,
    columnTypeMetadata,
    isIndex: false,
    isHidden: false,
  } as BaseColumnProps
}

export function getColumnsFromQuiver(data: Quiver): BaseColumnProps[] {
  const columns: BaseColumnProps[] = []

  if (data.isEmpty()) {
    // Tables that don't have any columns cause an exception in glide-data-grid.
    // As a workaround, we are adding an empty index column in this case.
    columns.push({
      id: `empty-index`,
      title: "",
      indexNumber: 0,
      isEditable: false,
      isIndex: true,
    } as BaseColumnProps)
    return columns
  }

  const numIndices = data.types?.index?.length ?? 0
  const numColumns = data.columns?.[0]?.length ?? 0

  for (let i = 0; i < numIndices; i++) {
    const column = {
      ...getIndexFromQuiver(data, i),
      indexNumber: i,
    } as BaseColumnProps

    columns.push(column)
  }

  for (let i = 0; i < numColumns; i++) {
    const column = {
      ...getColumnFromQuiver(data, i),
      indexNumber: i + numIndices,
    } as BaseColumnProps

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
  column: BaseColumn,
  quiverCell: DataFrameCell,
  cssStyles: string | undefined = undefined
): GridCell {
  let cellTemplate
  if (column.kind === "object") {
    // Always use display value from quiver for object types
    // these are special types that the dataframe only support in read-only mode.
    cellTemplate = column.getCell(
      processDisplayData(
        Quiver.format(
          quiverCell.content,
          quiverCell.contentType,
          quiverCell.field
        )
      )
    )
  } else {
    cellTemplate = column.getCell(quiverCell.content)
  }

  if (isErrorCell(cellTemplate)) {
    // Directly return error cells without any additional modification
    return cellTemplate
  }

  if (notNullOrUndefined(quiverCell.displayContent)) {
    const displayData = processDisplayData(quiverCell.displayContent)
    // If the display content is set, use that instead of the content.
    // This is only supported for text, object, date, datetime, time and number cells.
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
    }
    // TODO (lukasmasuch): Also support datetime formatting here
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
