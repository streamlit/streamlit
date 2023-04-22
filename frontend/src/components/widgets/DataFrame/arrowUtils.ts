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

import { DataFrameCell, Quiver, Type as ArrowType } from "src/lib/Quiver"
import { notNullOrUndefined, isNullOrUndefined } from "src/lib/utils"

import {
  BaseColumn,
  BaseColumnProps,
  DateColumn,
  TimeColumn,
  DateTimeColumn,
  ObjectColumn,
  CheckboxColumn,
  NumberColumn,
  TextColumn,
  SelectColumn,
  ListColumn,
  isErrorCell,
  ColumnCreator,
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
  if (["unicode", "empty"].includes(typeName)) {
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
  if (["object", "decimal", "bytes"].includes(typeName)) {
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
    ].includes(typeName)
  ) {
    return NumberColumn
  }
  if (typeName === "categorical") {
    return SelectColumn
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
 *
 * @return the column props for the data column.
 */
export function getColumnFromArrow(
  data: Quiver,
  columnPosition: number
): BaseColumnProps {
  const title = data.columns[0][columnPosition]
  let arrowType = data.types.data[columnPosition]

  if (isNullOrUndefined(arrowType)) {
    // Use empty column type as fallback
    arrowType = {
      meta: null,
      numpy_type: "object",
      pandas_type: "object",
    } as ArrowType
  }

  let columnTypeMetadata
  if (Quiver.getTypeName(arrowType) === "categorical") {
    // Get the available categories and use it in column type metadata
    const options = data.getCategoricalOptions(columnPosition)
    if (notNullOrUndefined(options)) {
      columnTypeMetadata = {
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
    columnTypeOptions: columnTypeMetadata,
    isIndex: false,
    isHidden: false,
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

  // TODO(lukasmasuch): use data.dimensions instead here?
  const numIndices = data.types?.index?.length ?? 0
  const numColumns = data.columns?.[0]?.length ?? 0

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
  let cellTemplate
  if (column.kind === "object") {
    // Always use display value from Quiver for object types
    // these are special types that the dataframe only support in read-only mode.
    cellTemplate = column.getCell(
      notNullOrUndefined(arrowCell.content)
        ? processDisplayData(
            Quiver.format(
              arrowCell.content,
              arrowCell.contentType,
              arrowCell.field
            )
          )
        : null
    )
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
      const displayData = processDisplayData(arrowCell.displayContent)
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
