import { range } from "lodash"
import React, { ReactElement } from "react"

import withFullScreenWrapper from "src/hocs/withFullScreenWrapper"
import { Quiver } from "src/lib/Quiver"
import {
  StyledEmptyTableCell,
  StyledTable,
  StyledTableCell,
  StyledTableCellHeader,
  StyledTableContainer,
} from "./styled-components"

export interface TableProps {
  element: Quiver
}

export function ArrowTable(props: TableProps): ReactElement {
  const table = props.element
  const { cssId, cssStyles, caption } = table
  const { headerRows, rows, columns } = table.dimensions
  const allRows = range(rows)
  const columnHeaders = allRows.slice(0, headerRows)
  const dataRows = allRows.slice(headerRows)

  return (
    <StyledTableContainer data-testid="stTable">
      {cssStyles && <style>{cssStyles}</style>}
      <StyledTable id={cssId}>
        {caption && (
          <caption>
            <small>{caption}</small>
          </caption>
        )}
        {columnHeaders.length > 0 && (
          <thead>
            {columnHeaders.map(rowIndex =>
              generateTableRow(table, rowIndex, columns)
            )}
          </thead>
        )}
        <tbody>
          {dataRows.length === 0 ? (
            <tr>
              <StyledEmptyTableCell colSpan={columns || 1}>
                empty
              </StyledEmptyTableCell>
            </tr>
          ) : (
            dataRows.map(rowIndex =>
              generateTableRow(table, rowIndex, columns)
            )
          )}
        </tbody>
      </StyledTable>
    </StyledTableContainer>
  )
}

function generateTableRow(
  table: Quiver,
  rowIndex: number,
  columns: number
): ReactElement {
  return (
    <tr key={rowIndex}>
      {range(columns).map(columnIndex =>
        generateTableCell(table, rowIndex, columnIndex)
      )}
    </tr>
  )
}

function generateTableCell(
  table: Quiver,
  rowIndex: number,
  columnIndex: number
): ReactElement {
  const {
    type,
    cssId,
    cssClass,
    content,
    contentType,
    displayContent,
  } = table.getCell(rowIndex, columnIndex)

  const formattedContent =
    displayContent || Quiver.format(content, contentType)

  const { headerColumns } = table.dimensions
  const cellDataType =
    table.types.data[columnIndex - headerColumns]?.pandas_type
  const isNumeric = cellDataType === "int64" || cellDataType === "float64"

  const style: React.CSSProperties = {
    textAlign: isNumeric ? "right" : "left",
  }

  switch (type) {
    case "blank": {
      return (
        <StyledTableCellHeader key={columnIndex} className={cssClass}>
          &nbsp;
        </StyledTableCellHeader>
      )
    }
    case "index": {
      return (
        <StyledTableCellHeader
          key={columnIndex}
          scope="row"
          id={cssId}
          className={cssClass}
        >
          {formattedContent}
        </StyledTableCellHeader>
      )
    }
    case "columns": {
      return (
        <StyledTableCellHeader
          key={columnIndex}
          scope="col"
          className={cssClass}
          style={style}
        >
          {formattedContent}
        </StyledTableCellHeader>
      )
    }
    case "data": {
      return (
        <StyledTableCell key={columnIndex} id={cssId} style={style}>
          {formattedContent}
        </StyledTableCell>
      )
    }
    default: {
      throw new Error(`Cannot parse type "${type}".`)
    }
  }
}

export default withFullScreenWrapper(ArrowTable)
