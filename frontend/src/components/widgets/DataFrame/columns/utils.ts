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
import { toString, merge, isArray } from "lodash"
import numbro from "numbro"

import { DataType, Type as QuiverType } from "src/lib/Quiver"
import { notNullOrUndefined } from "src/lib/utils"

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

export type ColumnCreator = {
  (props: BaseColumnProps): BaseColumn
  readonly isEditableType: boolean
}

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
  errorMsg = "⚠️ " + errorMsg
  return {
    kind: GridCellKind.Text,
    readonly: true,
    allowOverlay: true,
    data: errorMsg + (errorDetails ? `\n\n${errorDetails}\n` : ""),
    displayData: errorMsg,
    isError: true,
  } as ErrorCell
}

export function isErrorCell(cell: GridCell): cell is ErrorCell {
  return cell.hasOwnProperty("isError") && (cell as ErrorCell).isError
}

interface MissingValueCell extends TextCell {
  readonly isMissingValue: true
}

export function isMissingValueCell(cell: GridCell): cell is MissingValueCell {
  return (
    cell.hasOwnProperty("isMissingValue") &&
    (cell as MissingValueCell).isMissingValue
  )
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

export function toSafeString(data: any): string {
  try {
    try {
      return toString(data)
    } catch (error) {
      return JSON.stringify(data, (_key, value) =>
        typeof value === "bigint" ? Number(value) : value
      )
    }
  } catch (error) {
    return `[${typeof data}]`
  }
}

export function toSafeArray(data: any): any[] {
  if (!notNullOrUndefined(data)) {
    return []
  }

  if (typeof data === "string") {
    // Try to parse string to an array
    if (data.trim().startsWith("[") && data.trim().endsWith("]")) {
      // Support for JSON arrays: ["foo", 1, null, "test"]
      try {
        return JSON.parse(data)
      } catch (error) {
        return [data]
      }
    } else {
      // Support for comma-separated values: "foo,1,,test"
      return data.split(",")
    }
  }

  try {
    const parsedData = JSON.parse(
      JSON.stringify(data, (_key, value) =>
        typeof value === "bigint" ? Number(value) : value
      )
    )
    if (!isArray(parsedData)) {
      return [toSafeString(parsedData)]
    }

    return parsedData.map((value: any) =>
      ["string", "number", "boolean", "null"].includes(typeof value)
        ? value
        : toSafeString(value)
    )
  } catch (error) {
    return [toSafeString(data)]
  }
}

export function mergeColumnParameters(
  defaultParams: Record<string, any> | undefined | null,
  userParams: Record<string, any> | undefined | null
): Record<string, any> {
  if (!notNullOrUndefined(defaultParams)) {
    return userParams || {}
  }

  if (!notNullOrUndefined(userParams)) {
    return defaultParams || {}
  }

  return merge(defaultParams, userParams)
}

export function toSafeNumber(data: any): number | null {
  if (!notNullOrUndefined(data)) {
    return null
  }

  if (typeof data === "string") {
    if (data.trim().length === 0) {
      // Empty string should return null
      return null
    }

    try {
      // Try to convert string to number via numbro:
      // https://numbrojs.com/old-format.html#unformat
      const unformattedValue = numbro.unformat(data.trim())
      if (notNullOrUndefined(unformattedValue)) {
        return unformattedValue
      }
    } catch (error) {
      // Do nothing here
    }
  } else if (data instanceof Int32Array) {
    // int values need to be extracted this way:
    // eslint-disable-next-line prefer-destructuring
    return Number(data[0])
  }

  return Number(data)
}

export function formatNumber(value: number, maxPrecision: number = 4): string {
  if (!Number.isNaN(value) && Number.isFinite(value)) {
    if (maxPrecision === 0) {
      // Numbro is unable to format the numb with 0 decimals.
      value = Math.round(value)
    }
    return numbro(value).format(`0,0.[${"0".repeat(maxPrecision)}]`)
  }
  return ""
}
