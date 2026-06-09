/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { GridCell, GridCellKind } from "@glideapps/glide-data-grid"

import { isNullOrUndefined } from "~lib/util/utils"

import { ButtonCell, ButtonCellData } from "./cells/ButtonCell"
import {
  BaseColumn,
  BaseColumnProps,
  toSafeArray,
  toSafeString,
} from "./utils"

interface ButtonColumnParams {
  /**
   * The button style variant: "primary", "secondary", or "tertiary".
   */
  readonly button_type?: "primary" | "secondary" | "tertiary"
}

/**
 * A column type that renders clickable buttons in cells.
 *
 * Cell values can be:
 * - String: Single button with the string as label
 * - Array of strings: Multiple buttons shown in a dropdown menu
 * - null/undefined: Empty cell (no button rendered)
 *
 * Labels can include leading Material icons using `:material/icon_name:` syntax.
 */
function ButtonColumn(props: BaseColumnProps): BaseColumn {
  const parameters = (props.columnTypeOptions as ButtonColumnParams) || {}
  const buttonType = parameters.button_type ?? "secondary"

  const cellTemplate: ButtonCell = {
    kind: GridCellKind.Custom,
    allowOverlay: false,
    copyData: "",
    readonly: true,
    data: {
      kind: "button-cell",
      data: null,
      buttonType,
      alignment: props.contentAlignment,
    },
  }

  return {
    ...props,
    kind: "button",
    typeIcon: ":material/smart_button:",
    sortMode: "default",
    isEditable: false,
    getCell(data?: unknown): GridCell {
      if (isNullOrUndefined(data)) {
        return {
          ...cellTemplate,
          data: {
            ...cellTemplate.data,
            data: null,
          },
        }
      }

      let buttonData: ButtonCellData

      // For strings that don't look like arrays, use them directly as single button labels
      if (
        typeof data === "string" &&
        !(data.trim().startsWith("[") && data.trim().endsWith("]"))
      ) {
        buttonData = data
      } else {
        // Use toSafeArray for arrays and array-like data (same pattern as ListColumn)
        const arr = toSafeArray(data).map(item => toSafeString(item))
        // If we got exactly one item, treat it as a single button
        buttonData = arr.length === 1 ? arr[0] : arr
      }

      return {
        ...cellTemplate,
        copyData: Array.isArray(buttonData)
          ? buttonData.join(", ")
          : buttonData,
        data: {
          ...cellTemplate.data,
          data: buttonData,
        },
      }
    },
    getCellValue(cell: ButtonCell): ButtonCellData {
      return cell.data.data
    },
  }
}

ButtonColumn.isEditableType = false

export default ButtonColumn
