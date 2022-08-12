import React, { ReactElement } from "react"
import { Map as ImmutableMap } from "immutable"
import { range } from "lodash"
import { toFormattedString } from "src/lib/format"
import { dataFrameGet, dataFrameGetDimensions } from "src/lib/dataFrameProto"
import withFullScreenWrapper from "src/hocs/withFullScreenWrapper"
import {
  StyledTable,
  StyledEmptyTableCell,
  StyledTableCell,
  StyledTableCellHeader,
  StyledTableContainer,
} from "./styled-components"

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
      return <StyledTableCellHeader key={colIdx}>&nbsp;</StyledTableCellHeader>
    case "row-header":
      return (
        <StyledTableCellHeader key={colIdx} scope="row">
          {formattedContents}
        </StyledTableCellHeader>
      )
    case "col-header":
      return (
        <StyledTableCellHeader scope="column" key={colIdx}>
          {formattedContents}
        </StyledTableCellHeader>
      )
    case "data":
      return (
        <StyledTableCell key={colIdx} style={styles}>
          {formattedContents}
        </StyledTableCell>
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
    <StyledTableContainer data-testid="stTable">
      <StyledTable>
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
              <StyledEmptyTableCell colSpan={cols || 1}>
                empty
              </StyledEmptyTableCell>
            </tr>
          )}
        </tbody>
      </StyledTable>
    </StyledTableContainer>
  )
}

export default withFullScreenWrapper(Table)
