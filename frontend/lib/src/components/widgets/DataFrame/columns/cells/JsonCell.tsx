/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import * as React from "react"

import {
  type CustomCell,
  type CustomRenderer,
  drawTextCell,
  GridCellKind,
  type ProvideEditorCallback,
  TextCell,
} from "@glideapps/glide-data-grid"

import { toJsonString } from "~lib/components/widgets/DataFrame/columns/utils"

import { JsonViewer } from "./JsonViewer"

interface JsonCellProps {
  readonly kind: "json-cell"
  /* The JSON string data or object to display. */
  readonly value: string | object | undefined | null
  /* The stringified JSON to display. */
  readonly displayValue?: string
}

export type JsonCell = CustomCell<JsonCellProps>

/**
 * The cell overlay editor used by JSON columns to render
 * the value in a JSON-viewer.
 *
 * Note: this "editor" does not actually support editing at
 * the moment.
 */
export const JsonCellEditor: ReturnType<
  ProvideEditorCallback<JsonCell>
> = cell => {
  const theme = cell.theme
  const cellData = cell.value.data

  return (
    <JsonViewer
      jsonValue={cellData.value || cellData.displayValue}
      theme={theme}
    />
  )
}

/**
 * The cell overlay editor that is configured as custom editor to render
 * all text cell values that look like JSON.
 *
 * This is configured in the useCustomEditors hook.
 *
 * Note: this "editor" does not actually support editing at
 * the moment.
 */
export const JsonTextCellEditor: ReturnType<
  ProvideEditorCallback<TextCell>
> = cell => {
  const theme = cell.theme
  const cellData = cell.value

  return <JsonViewer jsonValue={cellData.data} theme={theme} />
}

/**
 * The full JSON cell renderer used by the JSON column.
 * This is configured in the useCustomRenderer hook.
 */
const renderer: CustomRenderer<JsonCell> = {
  kind: GridCellKind.Custom,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  isMatch: (c): c is JsonCell => (c.data as any).kind === "json-cell",
  draw: (args, cell) => {
    const { value, displayValue } = cell.data
    drawTextCell(
      args,
      displayValue ?? toJsonString(value) ?? "",
      cell.contentAlign
    )
    return true
  },
  measure: (ctx, cell, theme) => {
    const { value, displayValue } = cell.data
    const displayText = displayValue ?? toJsonString(value) ?? ""
    return (
      (displayText ? ctx.measureText(displayText).width : 0) +
      theme.cellHorizontalPadding * 2
    )
  },
  provideEditor: () => ({
    editor: JsonCellEditor,
  }),
}

export default renderer
