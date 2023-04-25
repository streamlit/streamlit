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

import React, { ReactElement, useEffect, useState } from "react"
import { Map as ImmutableMap } from "immutable"
import { MultiGrid } from "react-virtualized"
import withFullScreenWrapper from "src/lib/hocs/withFullScreenWrapper"
import {
  dataFrameGetDimensions,
  getSortedDataRowIndices,
  tableGetRowsAndCols,
} from "src/lib/dataframes/dataFrameProto"
import { SortDirection } from "./SortDirection"
import {
  StyledDataFrameContainer,
  StyledEmptyDataframe,
  StyledFixup,
} from "./styled-components"
import {
  CellContentsGetter,
  CellRenderer,
  CellRendererInput,
  getCellContentsGetter,
  getDimensions,
} from "./DataFrameUtil"
import DataFrameCell from "./DataFrameCell"

export interface DataFrameProps {
  width: number
  height?: number
  element: ImmutableMap<string, any>
}

/**
 * Functional element representing a DataFrame.
 */
export function DataFrame({
  element,
  height: propHeight,
  width,
}: DataFrameProps): ReactElement {
  const multiGridRef = React.useRef<MultiGrid>(null)

  /**
   * If true, then the user manually clicked on a column header to sort the
   * table.
   */
  const [sortedByUser, setSortedByUser] = useState(false)

  /**
   * Index of the column on which the table is sorted.
   * (Column 0 = row indices).
   */
  const [sortColumn, setSortColumn] = useState(0)

  /** Sort direction for table sorting. */
  const [sortDirection, setSortDirection] = useState(SortDirection.ASCENDING)

  // Calculate the dimensions of this array.
  const [, nCols] = tableGetRowsAndCols(element.get("data"))
  const { headerRows, headerCols, dataRows, cols, rows } =
    dataFrameGetDimensions(element)

  /**
   * Called when one of our column headers is clicked.
   * Changes the sort order of the table.
   */
  const toggleSortOrder = (columnIndex: number): void => {
    let newSortDirection = SortDirection.ASCENDING
    if (sortColumn === columnIndex) {
      // Clicking the same header toggles between ascending and descending.
      newSortDirection =
        sortDirection === SortDirection.ASCENDING
          ? SortDirection.DESCENDING
          : SortDirection.ASCENDING
    }
    setSortColumn(columnIndex)
    setSortDirection(newSortDirection)
    setSortedByUser(true)
  }

  /**
   * Returns a function that creates a DataFrameCell component for the given cell.
   */
  function getCellRenderer(
    cellContentsGetter: CellContentsGetter
  ): CellRenderer {
    // eslint-disable-next-line react/display-name
    return ({
      columnIndex,
      key,
      rowIndex,
      style: baseStyle,
    }: CellRendererInput): ReactElement => {
      const {
        Component,
        styles: additionalStyles,
        contents,
      } = cellContentsGetter(columnIndex, rowIndex)

      const headerClickedCallback =
        rowIndex === 0 ? toggleSortOrder : undefined

      const columnSortDirection =
        columnIndex === sortColumn ? sortDirection : undefined

      const isLastRow = rowIndex === dataRows
      const isLastCol = columnIndex === cols - headerCols

      // Merge our base styles with any additional cell-specific
      // styles returned by the cellContentsGetter
      const styles = {
        ...baseStyle,
        ...additionalStyles,
        borderBottom: isLastRow ? "none" : undefined,
        borderRight: isLastCol ? "none" : undefined,
      }

      return (
        <DataFrameCell
          key={key}
          CellType={Component}
          columnIndex={columnIndex}
          rowIndex={rowIndex}
          style={styles}
          contents={contents}
          sortedByUser={sortedByUser}
          columnSortDirection={columnSortDirection}
          headerClickedCallback={headerClickedCallback}
        />
      )
    }
  }

  /**
   * Returns the row indices, in display order, for this DataFrame,
   * given its sortColumn and sortDirection.
   */
  const getDataRowIndices = (nCols: number): number[] => {
    const { headerCols, dataRows } = dataFrameGetDimensions(element)

    const sortAscending = sortDirection !== SortDirection.DESCENDING

    // If we're sorting a header column, our sorted row indices are just the
    // row indices themselves (reversed, if SortDirection == DESCENDING)
    if (sortColumn < headerCols || sortColumn - headerCols >= nCols) {
      const rowIndices = new Array(dataRows)
      for (let i = 0; i < dataRows; i += 1) {
        rowIndices[i] = sortAscending ? i : dataRows - (i + 1)
      }

      return rowIndices
    }

    return getSortedDataRowIndices(
      element,
      sortColumn - headerCols,
      sortAscending
    )
  }

  /**
   * Schedule a gridSize recompute if we have a multigrid attached.
   * This should be called whenever our data may have changed (i.e., from the render() method).
   */
  const recomputeSizeIfNeeded = (): void => {
    setTimeout(() => {
      if (multiGridRef.current != null) {
        multiGridRef.current.recomputeGridSize()
      }
    }, 0)
  }

  const sortedDataRowIndices = getDataRowIndices(nCols)

  // Get the cell renderer.
  const cellContentsGetter = getCellContentsGetter({
    element,
    headerRows,
    sortedDataRowIndices,
  })
  const cellRenderer = getCellRenderer(cellContentsGetter)

  // Determine our rendering dimensions
  const {
    rowHeight,
    headerHeight,
    border,
    height,
    elementWidth,
    columnWidth,
    headerWidth,
  } = getDimensions(propHeight, width, element, cellContentsGetter)

  // Since this is a PureComponent, finding ourselves in this method
  // means that the props have changed, so we should force a rerender of the
  // widths.
  recomputeSizeIfNeeded()

  useEffect(() => {
    if (sortColumn - headerCols >= nCols) {
      setSortColumn(0)
      setSortDirection(SortDirection.ASCENDING)
      setSortedByUser(false)
    }
  }, [sortColumn, headerCols, nCols])

  // Put it all together.
  return (
    <StyledDataFrameContainer width={elementWidth} className="stDataFrame">
      <MultiGrid
        cellRenderer={cellRenderer}
        fixedColumnCount={headerCols}
        fixedRowCount={headerRows}
        columnWidth={columnWidth}
        columnCount={cols}
        enableFixedColumnScroll={false}
        enableFixedRowScroll={false}
        height={height}
        rowHeight={rowHeight}
        rowCount={rows}
        width={elementWidth}
        classNameBottomLeftGrid="table-bottom-left"
        classNameBottomRightGrid="table-bottom-right"
        classNameTopRightGrid="table-top-right"
        ref={multiGridRef}
      />
      <StyledFixup
        verticalLocator="top"
        horizontalLocator="right"
        width={border}
        height={headerHeight}
      />
      <StyledFixup
        verticalLocator="bottom"
        horizontalLocator="left"
        width={headerWidth}
        height={border}
      />
      {dataRows === 0 ? (
        <StyledEmptyDataframe>empty</StyledEmptyDataframe>
      ) : null}
    </StyledDataFrameContainer>
  )
}

export default withFullScreenWrapper(DataFrame)
