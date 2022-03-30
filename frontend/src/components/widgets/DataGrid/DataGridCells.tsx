/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
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
  RowIDCell,
  Theme as GlideTheme,
} from "@glideapps/glide-data-grid"

import { DataFrameCell, Quiver } from "src/lib/Quiver"

/**
 * Returns either the formatted content or display value for a Quiver cell.
 */
function getDisplayContent(quiverCell: DataFrameCell): string {
  return (
    quiverCell.displayContent ||
    Quiver.format(quiverCell.content, quiverCell.contentType)
  )
}

/**
 * Extracts a CSS property value from a given CSS style string by using a regex.
 *
 * @param cssId: The css ID of the element to extract the property for.
 * @param cssStyle: The css style string.
 * @param property: The css property to extract the value for.
 *
 * @return the CSS property value or undefined if the property is not found.
 */
function extractCssProperty(
  cssId: string,
  cssStyle: string,
  property: string
): string | undefined {
  const regex = new RegExp(
    `${cssId}[^{]+{[^}]*\\s${property}:\\s*([^;\\s]+)[;]?.*}`,
    "gm"
  )

  var match = regex.exec(cssStyle)
  if (match) {
    return match[1]
  }

  return undefined
}
/**
 * Returns a template object representing an empty cell for a given data type.
 *
 * @param kind: The kind of cell to get a template for.
 * @param readonly: If true, returns a read-only version of the cell template.
 *
 * @return a GridCell object that can be used by glide-data-grid.
 */
export function getCellTemplate(kind: string, readonly: boolean): GridCell {
  // TODO(lukasmasuch): Support other cell types based on the data type in later PR.

  if (kind === GridCellKind.Text) {
    return {
      kind: GridCellKind.Text,
      data: "",
      displayData: "",
      allowOverlay: true,
      readonly,
    } as TextCell
  }

  if (kind === GridCellKind.RowID) {
    return {
      kind: GridCellKind.RowID,
      data: "",
      style: "normal",
      allowOverlay: true,
    } as RowIDCell
  }

  throw new Error(`Unsupported cell kind: ${kind}`)
}

/**
 * Returns a glide-data-grid compatible cell object based on the
 * cell data from the quiver object. Different types of data will
 * result in different cell types.
 *
 * @param cellTemplate: the empty cell template from the column.
 * @param quiverCell: a dataframe cell object from Quiver.
 *
 * @return a GridCell object that can be used by glide-data-grid.
 */
export function fillCellTemplate(
  cellTemplate: GridCell,
  quiverCell: DataFrameCell,
  cssStyles: string | undefined = undefined
): GridCell {
  // TODO(lukasmasuch): Support different types here in a later PR.

  let cellKind = cellTemplate.kind
  if (cellTemplate.kind === GridCellKind.Custom) {
    cellKind = (cellTemplate.data as any)?.kind

    if (!cellKind) {
      throw new Error(`Unable to determine cell type for custom cell.`)
    }
  }

  if (cssStyles && quiverCell.cssId) {
    const themeOverride = {}

    // Extract and apply the font color
    const fontColor = extractCssProperty(quiverCell.cssId, cssStyles, "color")
    if (fontColor) {
      ;(themeOverride as GlideTheme).textDark = fontColor
    }

    // Extract and apply the background color
    const backgroundColor = extractCssProperty(
      quiverCell.cssId,
      cssStyles,
      "background-color"
    )
    if (backgroundColor) {
      ;(themeOverride as GlideTheme).bgCell = backgroundColor
    }

    if (themeOverride) {
      // Apply the background and font color in the theme override
      cellTemplate = {
        ...cellTemplate,
        themeOverride: themeOverride,
      }
    }
  }

  if (cellKind === GridCellKind.Text) {
    const formattedContents = getDisplayContent(quiverCell)
    return {
      ...cellTemplate,
      data:
        typeof quiverCell.content === "string"
          ? quiverCell.content
          : formattedContents,
      displayData: formattedContents,
    } as TextCell
  }

  if (cellKind === GridCellKind.RowID) {
    const formattedContents = getDisplayContent(quiverCell)
    return {
      ...cellTemplate,
      data:
        typeof quiverCell.content === "string"
          ? quiverCell.content
          : formattedContents,
    } as RowIDCell
  }

  throw new Error(`Unsupported cell kind: ${cellKind}`)
}
