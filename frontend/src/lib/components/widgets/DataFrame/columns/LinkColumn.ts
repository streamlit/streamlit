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

import { GridCell, UriCell, GridCellKind } from "@glideapps/glide-data-grid"

import { notNullOrUndefined, isNullOrUndefined } from "src/lib/util/utils"

import {
  BaseColumn,
  BaseColumnProps,
  toSafeString,
  getErrorCell,
  ColumnCreator,
} from "./utils"

export interface LinkColumnParams {
  // The maximum number of characters the user can enter into the text input.
  readonly max_chars?: number
  // Regular expression that the input's value must match for the value to pass
  readonly validate?: string
}

/**
 * The link column is a special column that interprets the cell content as
 * an hyperlink / url and allows the user to click on it.
 */
function LinkColumn(props: BaseColumnProps): BaseColumn {
  const parameters = (props.columnTypeOptions as LinkColumnParams) || {}

  let validateRegex: RegExp | string | undefined = undefined

  if (parameters.validate) {
    // Prepare the validation regex:
    try {
      // u flag allows unicode characters
      // s flag allows . to match newlines
      validateRegex = new RegExp(parameters.validate, "us")
    } catch (error) {
      // Put error message in validateRegex so we can display it in the cell
      validateRegex = `Invalid validate regex: ${parameters.validate}.\nError: ${error}`
    }
  }

  const cellTemplate = {
    kind: GridCellKind.Uri,
    data: "",
    readonly: !props.isEditable,
    allowOverlay: true,
    contentAlign: props.contentAlignment,
    style: props.isIndex ? "faded" : "normal",
  } as UriCell

  const validateInput = (data?: any): boolean | string => {
    if (isNullOrUndefined(data)) {
      if (props.isRequired) {
        return false
      }
      return true
    }

    let cellData = toSafeString(data)
    // A flag to indicate whether the value has been auto-corrected.
    // This is used to decide if we should return the corrected value or true.
    // But we still run all other validations on the corrected value below.
    let corrected = false

    if (parameters.max_chars) {
      if (cellData.length > parameters.max_chars) {
        // Correct the value
        cellData = cellData.slice(0, parameters.max_chars)
        corrected = true
      }
    }

    if (
      validateRegex instanceof RegExp &&
      validateRegex.test(cellData) === false
    ) {
      return false
    }

    return corrected ? cellData : true
  }

  return {
    ...props,
    kind: "link",
    sortMode: "default",
    validateInput,
    getCell(data?: any, validate?: boolean): GridCell {
      if (typeof validateRegex === "string") {
        // The regex is invalid, we return an error to indicate this
        // to the developer:
        return getErrorCell(toSafeString(data), validateRegex)
      }

      if (validate) {
        const validationResult = validateInput(data)
        if (validationResult === false) {
          // The input is invalid, we return an error cell which will
          // prevent this cell to be inserted into the table.
          // This cell should never be actually displayed to the user.
          // It's mostly used internally to prevent invalid input to be
          // inserted into the table.
          return getErrorCell(toSafeString(data), "Invalid input.")
        } else if (typeof validationResult === "string") {
          // Apply corrections:
          data = validationResult
        }
      }

      return {
        ...cellTemplate,
        data: notNullOrUndefined(data) ? toSafeString(data) : null,
        isMissingValue: isNullOrUndefined(data),
      } as UriCell
    },
    getCellValue(cell: UriCell): string | null {
      return cell.data === undefined ? null : cell.data
    },
  }
}

LinkColumn.isEditableType = true

export default LinkColumn as ColumnCreator
