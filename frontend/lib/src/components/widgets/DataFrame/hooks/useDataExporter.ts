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

import React from "react"

import { DataEditorProps } from "@glideapps/glide-data-grid"
// We don't have Typescript defs for these imports, which makes ESLint unhappy
/* eslint-disable import/no-extraneous-dependencies */
import { showSaveFilePicker } from "native-file-system-adapter"
/* eslint-enable */

import {
  BaseColumn,
  toSafeString,
} from "@streamlit/lib/src/components/widgets/DataFrame/columns"
import { isNullOrUndefined } from "@streamlit/lib/src/util/utils"

// Delimiter between cells
const CSV_DELIMITER = ","
// Quote character for cell values containing special characters
const CSV_QUOTE_CHAR = '"'
// The character used to escape the quote character within a cell
const CSV_ESCAPE_CHAR = '"'
// Delimiter between rows (newline)
const CSV_ROW_DELIMITER = "\n"
// Used to indicate Unicode encoding of a text file (for excel compatibility)
const CSV_UTF8_BOM = "\ufeff"

export function toCsvRow(rowValues: any[]): string {
  return (
    rowValues.map(cell => escapeValue(cell)).join(CSV_DELIMITER) +
    CSV_ROW_DELIMITER
  )
}

/**
 * Escapes a cell value for CSV export.
 *
 * Makes sure that the value is a string, and special characters are escaped correctly.
 */
function escapeValue(value: any): string {
  if (isNullOrUndefined(value)) {
    return ""
  }
  const strValue = toSafeString(value)

  // Special chars need to be escaped:
  const specialChars = [CSV_DELIMITER, CSV_QUOTE_CHAR, CSV_ROW_DELIMITER]
  if (new RegExp(`[${specialChars.join("")}]`).test(strValue)) {
    // Add quotes around the value:
    return `${CSV_QUOTE_CHAR}${strValue.replace(
      // Escape all quote chars if inside a quoted string:
      new RegExp(CSV_QUOTE_CHAR, "g"),
      CSV_ESCAPE_CHAR + CSV_QUOTE_CHAR
    )}${CSV_QUOTE_CHAR}`
  }

  return strValue
}

type DataExporterReturn = {
  // A callback to trigger the data download as CSV
  exportToCsv: () => void
}

/**
 * Custom hook that handles all the data export/download logic.
 *
 * @param getCellContent - The cell content getter compatible with glide-data-grid.
 * @param columns - The columns of the table.
 * @param numRows - The number of rows of the current state.
 *
 * @returns a callback to trigger the data download as CSV.
 */
function useDataExporter(
  getCellContent: DataEditorProps["getCellContent"],
  columns: BaseColumn[],
  numRows: number
): DataExporterReturn {
  const exportToCsv = React.useCallback(async () => {
    const timestamp = new Date().toISOString().slice(0, 16).replace(":", "-")
    const suggestedName = `${timestamp}_export.csv`

    const fileHandle = await showSaveFilePicker({
      suggestedName,
      types: [{ accept: { "text/csv": [".csv"] } }],
      excludeAcceptAllOption: false,
    })

    const textEncoder = new TextEncoder()
    const writer = await fileHandle.createWritable()

    // Write UTF-8 BOM for excel compatibility:
    await writer.write(textEncoder.encode(CSV_UTF8_BOM))

    // Write headers:
    const headers: string[] = columns.map(column => column.name)
    await writer.write(textEncoder.encode(toCsvRow(headers)))

    for (let row = 0; row < numRows; row++) {
      const rowData: any[] = []
      columns.forEach((column: BaseColumn, col: number, _map) => {
        rowData.push(column.getCellValue(getCellContent([col, row])))
      })
      // Write row to CSV:
      await writer.write(textEncoder.encode(toCsvRow(rowData)))
    }

    await writer.close()
  }, [columns, numRows, getCellContent])

  return {
    exportToCsv,
  }
}

export default useDataExporter
