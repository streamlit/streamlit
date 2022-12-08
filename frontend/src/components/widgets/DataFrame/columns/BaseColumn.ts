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
  GridCellKind,
  LoadingCell,
  GridColumn,
} from "@glideapps/glide-data-grid"

import { DataType, Type as QuiverType } from "src/lib/Quiver"

export interface BaseColumnProps {
  // The id of the column.
  readonly id: string
  // The title of the column.
  readonly title: string
  // The index number of the column.
  readonly indexNumber: number
  // The quiver data type of the column.
  readonly quiverType: QuiverType
  // If `True`, the column can be edited.
  readonly isEditable: boolean
  // If `True`, the column is hidden (will not be shown).
  readonly isHidden: boolean
  // If `True`, the column is a table index.
  readonly isIndex: boolean
  // If `True`, the column is a stretched.
  readonly isStretched: boolean
  // The initial width of the column
  readonly width?: number
  // Column time selected via column config
  readonly customType?: string
  // Additional metadata related to the column type.
  readonly columnTypeMetadata?: Record<string, any>
  // The content alignment of the column.
  readonly contentAlignment?: "left" | "center" | "right"
  // Theme overrides for this column.
  readonly themeOverride?: Partial<GlideTheme>
}

export interface BaseColumn extends BaseColumnProps {
  readonly kind: string
  readonly sortMode: "smart" | "default"
  getCell(data?: DataType): GridCell
  getCellValue(cell: GridCell): any | null
}

export type ColumnCreator = (props: BaseColumnProps) => BaseColumn

interface ErrorCell extends TextCell {
  readonly isError: true
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
    kind: GridCellKind.Text,
    readonly: true,
    allowOverlay: true,
    data: errorMsg + (errorDetails ? `\n${errorDetails}` : ""),
    displayData: errorMsg,
    themeOverride: {
      textDark: "#ff4b4b", // TODO(lukasmasuch): use color from theme?
    },
    isError: true,
  } as ErrorCell
}

/**
 * Returns an empty cell.
 */
export function getEmptyCell(): LoadingCell {
  return {
    kind: GridCellKind.Loading,
    allowOverlay: false,
  } as LoadingCell
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

export function isErrorCell(cell: GridCell): cell is ErrorCell {
  return cell.hasOwnProperty("isError")
}

export function toGlideColumn(column: BaseColumn): GridColumn {
  return {
    id: column.id,
    title: column.title,
    hasMenu: false,
    themeOverride: column.themeOverride,
    ...(column.isStretched && {
      grow: column.isIndex ? 1 : 3,
    }),
    ...(column.width && {
      width: column.width,
    }),
  } as GridColumn
}
