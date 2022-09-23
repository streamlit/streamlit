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
  TextCell,
  Theme as GlideTheme,
  BooleanCell,
  NumberCell,
  BubbleCell,
} from "@glideapps/glide-data-grid"

import { DataFrameCell, Quiver, Type as QuiverType } from "src/lib/Quiver"
import { notNullOrUndefined } from "src/lib/utils"

export enum ColumnType {
  Text = "text",
  Number = "number",
  Boolean = "boolean",
  List = "list",
}

/**
 * Maps the data type from Quiver to a valid column type.
 */
export function determineColumnType(quiverType: QuiverType): ColumnType {
  const dataTypeName = quiverType && Quiver.getTypeName(quiverType)

  let columnType = ColumnType.Text

  if (!dataTypeName) {
    // Use text column as fallback
    columnType = ColumnType.Text
  } else if (dataTypeName === "bool") {
    columnType = ColumnType.Boolean
  } else if (["int64", "float64", "range"].includes(dataTypeName)) {
    // The default index in pandas uses a range type.
    columnType = ColumnType.Number
  } else if (dataTypeName.startsWith("list")) {
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
    Quiver.format(quiverCell.content, quiverCell.contentType)

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
 * Returns a template object representing an empty cell for a given data type.
 *
 * @param type: The type of the column.
 * @param readonly: If true, returns a read-only version of the cell template.
 * @param style: The style used for the column.
 *
 * @return a GridCell object that can be used by glide-data-grid.
 */
export function getCellTemplate(
  type: ColumnType,
  readonly: boolean,
  style: "normal" | "faded" = "normal"
): GridCell {
  if (type === ColumnType.Text) {
    return {
      kind: GridCellKind.Text,
      data: "",
      displayData: "",
      allowOverlay: true,
      readonly,
      style,
    } as TextCell
  }

  if (type === ColumnType.Boolean) {
    return {
      kind: GridCellKind.Boolean,
      data: false,
      readonly,
      allowOverlay: false, // no overlay possible
      style,
    } as BooleanCell
  }

  if (type === ColumnType.Number) {
    return {
      kind: GridCellKind.Number,
      data: undefined,
      displayData: "",
      readonly,
      allowOverlay: true,
      contentAlign: "right",
      style,
    } as NumberCell
  }

  if (type === ColumnType.List) {
    return {
      kind: GridCellKind.Bubble,
      data: [],
      allowOverlay: true,
      style,
    } as BubbleCell
  }

  throw new Error(`Unsupported cell type: ${type}`)
}

/**
 * Returns the sort mode based on the given column type.
 */
export function getColumnSortMode(columnType: ColumnType): string {
  if (columnType === ColumnType.Number) {
    // Smart mode also works correctly for numbers
    return "smart"
  }

  return "default"
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
  cssStyles: string | undefined = undefined
): GridCell {
  let cellKind = cellTemplate.kind
  if (cellTemplate.kind === GridCellKind.Custom) {
    cellKind = (cellTemplate.data as any)?.kind

    if (!cellKind) {
      throw new Error(`Unable to determine cell type for custom cell.`)
    }
  }

  if (cssStyles && quiverCell.cssId) {
    const themeOverride = {} as Partial<GlideTheme>

    // Extract and apply the font color
    const fontColor = extractCssProperty(quiverCell.cssId, "color", cssStyles)
    if (fontColor) {
      themeOverride.textDark = fontColor
    }

    // Extract and apply the background color
    const backgroundColor = extractCssProperty(
      quiverCell.cssId,
      "background-color",
      cssStyles
    )
    if (backgroundColor) {
      themeOverride.bgCell = backgroundColor
    }

    if (themeOverride) {
      // Apply the background and font color in the theme override
      cellTemplate = {
        ...cellTemplate,
        themeOverride,
      }
    }
  }

  if (cellKind === GridCellKind.Text) {
    const formattedContents = getDisplayContent(quiverCell)
    return {
      ...cellTemplate,
      data:
        typeof quiverCell.content === "string" ||
        !notNullOrUndefined(quiverCell.content) // don't use formattedContents for null/undefined
          ? quiverCell.content
          : formattedContents,
      displayData: formattedContents,
    } as TextCell
  }

  if (cellKind === GridCellKind.Number) {
    const formattedContents = getDisplayContent(quiverCell)
    let cellData = quiverCell.content

    if (cellData instanceof Int32Array) {
      // int values need to be extracted this way:
      // eslint-disable-next-line prefer-destructuring
      cellData = (cellData as Int32Array)[0]
    }

    return {
      ...cellTemplate,
      data: notNullOrUndefined(cellData) ? Number(cellData) : undefined,
      displayData: formattedContents,
    } as NumberCell
  }

  if (cellKind === GridCellKind.Boolean) {
    return {
      ...cellTemplate,
      data: quiverCell.content as boolean,
    } as BooleanCell
  }

  if (cellKind === GridCellKind.Bubble) {
    // TODO(lukasmasuch): we use JSON.parse(JSON.stringify) here to handle type conversations to base types.
    // This could be improved by introducing some custom code for handling type conversations.
    return {
      ...cellTemplate,
      data: notNullOrUndefined(quiverCell.content)
        ? JSON.parse(
            JSON.stringify(quiverCell.content, (_key, value) =>
              typeof value === "bigint" ? Number(value) : value
            )
          )
        : [],
    } as BubbleCell
  }

  throw new Error(`Unsupported cell kind: ${cellKind}`)
}
