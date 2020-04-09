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

import React, { PureComponent } from "react"
import { Table as ReactTable } from "reactstrap"
import { toFormattedString } from "lib/format"
import { Map as ImmutableMap } from "immutable"
import { dataFrameGet, dataFrameGetDimensions } from "lib/dataFrameProto"
import withFullScreenWrapper from "hocs/withFullScreenWrapper"
import "./Table.scss"

/**
 * Functional element representing a DataFrame.
 */
export interface Props {
  width: number
  element: ImmutableMap<string, any>
}

export class Table extends PureComponent<Props> {
  render(): JSX.Element {
    const { element } = this.props
    const { headerRows, rows, cols } = dataFrameGetDimensions(element)

    const hasNoData = rows === headerRows

    // TODO(tvst): Make tables have a max width with overflow: scroll (when
    // media==screen). But need to fix the autosizer first.
    return (
      <div className="streamlit-table stTable">
        <ReactTable className={hasNoData ? "empty-table" : ""}>
          <thead>
            <TableRows
              df={element}
              header={true}
              headerRows={headerRows}
              rows={rows}
              cols={cols}
            />
          </thead>
          <tbody>
            {hasNoData ? (
              <tr>
                <td colSpan={cols || 1}>empty</td>
              </tr>
            ) : (
              <TableRows
                df={element}
                headerRows={headerRows}
                rows={rows}
                cols={cols}
              />
            )}
          </tbody>
        </ReactTable>
      </div>
    )
  }
}

/**
 * Purely functional component returning a list of rows.
 *
 * df         - The dataFrame to display.
 * header     - Whether to display the header.
 * headerRows - Number of rows in the header.
 * rows       - Number of rows in the table (header + data).
 * cols       - Number of colums in the table.
 */
interface TableRowsProps {
  df: ImmutableMap<string, any>
  header?: boolean | false
  headerRows: number
  rows: number
  cols: number
}

const TableRows: React.SFC<TableRowsProps> = props => {
  const { df, header, headerRows, rows, cols } = props
  const startRow = header ? 0 : headerRows
  const endRow = header ? headerRows : rows
  const rowArray = []
  for (let rowIdx = startRow; rowIdx < endRow; rowIdx++) {
    rowArray.push(
      <tr key={rowIdx}>
        <TableRow df={df} rowIdx={rowIdx} cols={cols} />
      </tr>
    )
  }
  return <React.Fragment>{rowArray}</React.Fragment>
}

/**
 * Purely functional component returning a list entries for a row.
 *
 * df     - The dataFrame to display.
 * rowIdx - The row index.
 * cols   - numver of colums in the table.
 */

interface TableRowProps {
  df: ImmutableMap<string, any>
  rowIdx: number
  cols: number
}

const TableRow: React.SFC<TableRowProps> = (props: TableRowProps) => {
  const { df, rowIdx, cols } = props
  const entries = []
  for (let colIdx = 0; colIdx < cols; colIdx++) {
    const { contents, styles, type } = dataFrameGet(df, colIdx, rowIdx)
    const formattedContents = toFormattedString(contents)
    if (type === "corner") {
      entries.push(<th key={colIdx}>&nbsp;</th>)
    } else if (type === "row-header") {
      entries.push(
        <th key={colIdx} scope="row">
          {formattedContents}
        </th>
      )
    } else if (type === "col-header") {
      entries.push(<th key={colIdx}>{formattedContents}</th>)
    } else if (type === "data") {
      entries.push(
        <td style={styles} key={colIdx}>
          {formattedContents}
        </td>
      )
    } else {
      throw new Error(`Cannot parse type "${type}".`)
    }
  }
  return <React.Fragment>{entries}</React.Fragment>
}

export default withFullScreenWrapper(Table)
