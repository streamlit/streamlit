import { range } from "lodash"
import React, {
  Fragment,
  PureComponent,
  ReactNode,
  SFC,
  useEffect,
} from "react"
import { Table as UITable } from "reactstrap"
import {
  ArrowTable,
  ComponentProps,
  Streamlit,
  withStreamlitConnection,
} from "./streamlit"

interface TableProps {
  element: ArrowTable
}

class Table extends PureComponent<TableProps> {
  public render = (): ReactNode => {
    const table = this.props.element

    const hasHeader = table.headerRows > 0
    const hasData = table.dataRows > 0
    const id = table.uuid ? "T_" + table.uuid : undefined
    const classNames = hasData ? undefined : "empty-table"
    const caption = table.caption ? <caption>{table.caption}</caption> : null

    return (
      <div className="streamlit-table stTable">
        <style>{table.styles}</style>
        <UITable id={id} className={classNames} bordered>
          {caption}
          {hasHeader && (
            <thead>
              <TableRows isHeader={true} table={table} />
            </thead>
          )}
          <tbody>
            {hasData ? (
              <TableRows isHeader={false} table={table} />
            ) : (
              <tr>
                <td colSpan={table.columns || 1}>empty</td>
              </tr>
            )}
          </tbody>
        </UITable>
      </div>
    )
  }
}

/**
 * Purely functional component returning a list of rows.
 *
 * isHeader     - Whether to display the header.
 * table        - The table to display.
 */

interface TableRowsProps {
  isHeader: boolean
  table: ArrowTable
}

const TableRows: SFC<TableRowsProps> = props => {
  const { isHeader, table } = props
  const { headerRows, rows } = table
  const startRow = isHeader ? 0 : headerRows
  const endRow = isHeader ? headerRows : rows

  const tableRows = range(startRow, endRow).map(rowIndex => (
    <tr key={rowIndex}>
      <TableRow rowIndex={rowIndex} table={table} />
    </tr>
  ))

  return <Fragment>{tableRows}</Fragment>
}

/**
 * Purely functional component returning a list entries for a row.
 *
 * rowIndex - The row index.
 * table    - The table to display.
 */

interface TableRowProps {
  rowIndex: number
  table: ArrowTable
}

const TableRow: SFC<TableRowProps> = props => {
  const { rowIndex, table } = props
  const { columns } = table

  const cells = range(0, columns).map(columnIndex => {
    const { classNames, content, id, type } = table.getCell(
      rowIndex,
      columnIndex
    )

    // Format the content if needed
    const formattedContent = content.toString()

    switch (type) {
      case "blank": {
        return <th key={columnIndex} className={classNames} />
      }
      case "index": {
        return (
          <th key={columnIndex} scope="row" className={classNames}>
            {formattedContent}
          </th>
        )
      }
      case "columns": {
        return (
          <th key={columnIndex} scope="col" id={id} className={classNames}>
            {formattedContent}
          </th>
        )
      }
      case "data": {
        return (
          <td key={columnIndex} id={id} className={classNames}>
            {formattedContent}
          </td>
        )
      }
      default: {
        throw new Error(`Cannot parse type "${type}".`)
      }
    }
  })

  return <Fragment>{cells}</Fragment>
}

/**
 * Dataframe example using Apache Arrow.
 */
const CustomDataframe = (props: ComponentProps) => {
  useEffect(() => {
    Streamlit.setFrameHeight()
  })

  return <Table element={props.args.data} />
}

export default withStreamlitConnection(CustomDataframe)
