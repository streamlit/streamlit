/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

import React, { ReactElement } from "react"
import { Map as ImmutableMap } from "immutable"
import { range } from "lodash"
import { toFormattedString } from "lib/format"
import { dataFrameGet, dataFrameGetDimensions } from "lib/dataFrameProto"
import withFullScreenWrapper from "hocs/withFullScreenWrapper"
import "./Table.scss"

type DataFrame = ImmutableMap<string, any>

/**
 * Functional element representing a DataFrame.
 */
export interface TableProps {
  element: DataFrame
}

function generateTableCell(
  df: DataFrame,
  rowIdx: number,
  colIdx: number
): ReactElement {
  const { contents, styles, type } = dataFrameGet(df, colIdx, rowIdx)
  const formattedContents = toFormattedString(contents)

  switch (type) {
    case "corner":
      return <td key={colIdx}>&nbsp;</td>
    case "row-header":
      return (
        <th key={colIdx} scope="row">
          {formattedContents}
        </th>
      )
    case "col-header":
      return (
        <th scope="column" key={colIdx}>
          {formattedContents}
        </th>
      )
    case "data":
      return (
        <td key={colIdx} style={styles}>
          {formattedContents}
        </td>
      )
    default:
      throw new Error(`Cannot parse type "${type}".`)
  }
}

function generateTableRow(
  df: DataFrame,
  rowIdx: number,
  cols: number
): ReactElement {
  return (
    <tr key={rowIdx}>
      {range(cols).map(colIdx => generateTableCell(df, rowIdx, colIdx))}
    </tr>
  )
}

export function Table({ element }: TableProps): ReactElement {
  const { headerRows, rows, cols } = dataFrameGetDimensions(element)
  const allRows = range(rows)
  const columnHeaders = allRows.slice(0, headerRows)
  const dataRows = allRows.slice(headerRows)

  return (
    <div className="stTable">
      <table>
        {columnHeaders.length > 0 && (
          <thead>
            {columnHeaders.map(rowIdx =>
              generateTableRow(element, rowIdx, cols)
            )}
          </thead>
        )}
        <tbody>
          {dataRows.map(rowIdx => generateTableRow(element, rowIdx, cols))}
          {dataRows.length === 0 && (
            <tr>
              <td colSpan={cols || 1} className="empty">
                empty
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default withFullScreenWrapper(Table)
