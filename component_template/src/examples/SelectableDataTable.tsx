import React, { useState, useEffect } from "react"
import { SelectionState, IntegratedSelection } from "@devexpress/dx-react-grid"
import {
  Grid,
  VirtualTable,
  TableHeaderRow,
  TableSelection,
} from "@devexpress/dx-react-grid-material-ui"
import Paper from "@material-ui/core/Paper"
import { range } from "lodash"
import {
  ArrowTable,
  ComponentProps,
  withStreamlitConnection,
} from "../streamlit"

/**
 * Function returning a list of rows.
 *
 * isHeader     - Whether to display the header.
 * table        - The table to display.
 */

interface TableRowsProps {
  isHeader: boolean
  table: ArrowTable
}

const tableRows = (props: TableRowsProps): string[][] => {
  const { isHeader, table } = props
  const { headerRows, rows } = table
  const startRow = isHeader ? 0 : headerRows
  const endRow = isHeader ? headerRows : rows

  const tableRows = range(startRow, endRow).map(rowIndex =>
    tableRow({ rowIndex, table })
  )

  return tableRows
}

/**
 * Function returning a list entries for a row.
 *
 * rowIndex - The row index.
 * table    - The table to display.
 */

interface TableRowProps {
  rowIndex: number
  table: ArrowTable
}

const tableRow = (props: TableRowProps): string[] => {
  const { rowIndex, table } = props
  const { columns } = table

  const cells = range(0, columns).map(columnIndex => {
    const { content } = table.getCell(rowIndex, columnIndex)
    return content.toString()
  })

  return cells
}

// (HK) TODO: Cleanup
const generateReactGridDataRows = (rows: string[][], columns: string[][]) =>
  rows.map((row: string[]) =>
    columns[0].reduce((obj: any = {}, key: string, i: number) => {
      obj[key] = row[i]
      return obj
    }, {})
  )

// (HK) TODO: Cleanup & handle multiheader grids
const generateReactGridDataColumns = (columns: string[][]) =>
  columns[0].map((column: string) => ({
    name: column,
  }))

const SelectableDataTable = (props: ComponentProps) => {
  useEffect(() => {
    props.updateFrameHeight(350)
  })

  const handleSelectionChange = (value: any): void => {
    setSelection(value)
    props.setWidgetValue(value)
  }

  const [selection, setSelection] = useState<Array<number | string>>([])
  const table = props.args.data
  const columns = tableRows({ isHeader: true, table })
  const rows = tableRows({ isHeader: false, table })

  return (
    <Paper>
      <Grid
        rows={generateReactGridDataRows(rows, columns)}
        columns={generateReactGridDataColumns(columns)}
      >
        <SelectionState
          selection={selection}
          onSelectionChange={handleSelectionChange}
        />
        <IntegratedSelection />
        <VirtualTable />
        <TableHeaderRow />
        <TableSelection showSelectAll />
      </Grid>
    </Paper>
  )
}

export default withStreamlitConnection(SelectableDataTable)
