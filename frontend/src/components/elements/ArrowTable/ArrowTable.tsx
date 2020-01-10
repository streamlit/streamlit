/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
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

import React, { Fragment, PureComponent, ReactNode, SFC } from "react"
import { Table as ReactTable } from "reactstrap"
import { Map as ImmutableMap } from "immutable"
import { toFormattedString } from "lib/format"
import withFullScreenWrapper from "hocs/withFullScreenWrapper"
import TheArrowTable from "./TheArrowTable"

export interface Props {
  element: ImmutableMap<string, any>
  width: number
}

export class ArrowTable extends PureComponent<Props> {
  public render = (): ReactNode => {
    const uuid: string = this.props.element.get("uuid")
    const headerColumns: Uint8Array = this.props.element.get("headerColumns")
    const headerRows: Uint8Array = this.props.element.get("headerRows")
    const data: Uint8Array = this.props.element.get("data")
    const table = new TheArrowTable(uuid, headerColumns, headerRows, data)

    const styles: string = this.props.element.get("styles")
    const hasNoData = table.headerRows === table.rows

    const captionText: string = this.props.element.get("caption")
    const caption = captionText ? <caption>{captionText}</caption> : null

    return (
      <div className="streamlit-table stTable">
        <style>{styles}</style>
        <ReactTable id={"T_" + uuid} className={hasNoData ? "empty-table" : ""}>
          {caption}
          <thead>
            <TableRows
              table={table}
              header={true}
              headerRows={table.headerRows}
              rows={table.rows}
              columns={table.columns}
            />
          </thead>
          <tbody>
            {hasNoData ? (
              <tr>
                <td colSpan={table.columns || 1}>empty</td>
              </tr>
            ) : (
              <TableRows
                table={table}
                header={false}
                headerRows={table.headerRows}
                rows={table.rows}
                columns={table.columns}
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
 * table      - The table to display.
 * header     - Whether to display the header.
 * headerRows - Number of rows in the header.
 * rows       - Number of rows in the table (header + data).
 * columns    - Number of colums in the table.
 */

export interface TableRowsProps {
  table: TheArrowTable
  header: boolean
  headerRows: number
  rows: number
  columns: number
}

const TableRows: SFC<TableRowsProps> = props => {
  const { table, header, headerRows, rows, columns } = props
  const startRow = header ? 0 : headerRows
  const endRow = header ? headerRows : rows
  const rowArray = []

  for (let rowIndex = startRow; rowIndex < endRow; rowIndex++) {
    rowArray.push(
      <tr key={rowIndex}>
        <TableRow table={table} rowIndex={rowIndex} columns={columns} />
      </tr>
    )
  }

  return <Fragment>{rowArray}</Fragment>
}

/**
 * Purely functional component returning a list entries for a row.
 *
 * table    - The table to display.
 * rowIndex - The row index.
 * columns  - Number of colums in the table.
 */

export interface TableRowProps {
  table: TheArrowTable
  rowIndex: number
  columns: number
}

const TableRow: SFC<TableRowProps> = (props: TableRowProps) => {
  const { table, rowIndex, columns } = props
  const entries = []

  for (let columnIndex = 0; columnIndex < columns; columnIndex++) {
    const { content, type, id, classNames } = table.getCell(
      rowIndex,
      columnIndex
    )
    const formattedContent = toFormattedString(content)

    switch (type) {
      case "blank": {
        entries.push(<th key={columnIndex} className={classNames}></th>)
        break
      }
      case "columnHeading": {
        entries.push(
          <th key={columnIndex} scope="col" className={classNames}>
            {formattedContent}
          </th>
        )
        break
      }
      case "rowHeading": {
        entries.push(
          <th key={columnIndex} scope="row" id={id} className={classNames}>
            {formattedContent}
          </th>
        )
        break
      }
      case "data": {
        entries.push(
          <td key={columnIndex} id={id} className={classNames}>
            {formattedContent}
          </td>
        )
        break
      }
      default: {
        throw new Error(`Cannot parse type "${type}".`)
      }
    }
  }

  return <Fragment>{entries}</Fragment>
}

export default withFullScreenWrapper(ArrowTable)
