/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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

import React, { ReactElement, useEffect, useState } from "react"
import { MultiGrid } from "react-virtualized"

import withFullScreenWrapper from "src/hocs/withFullScreenWrapper"
import { DataType, Quiver } from "src/lib/Quiver"
import { SortDirection } from "./SortDirection"
import DataFrameCell from "./DataFrameCell"
import {
  CellContentsGetter,
  CellRenderer,
  CellRendererInput,
  getCellContentsGetter,
  getDimensions,
} from "./DataFrameUtil"
import {
  StyledDataFrameContainer,
  StyledEmptyDataframe,
  StyledFixup,
} from "./styled-components"

export interface DataFrameProps {
  element: Quiver
  height?: number
  width: number
}

/**
 * Functional element representing a DataFrame.
 */
export function ArrowDataFrame({
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
  const nCols = element.data.length > 0 ? element.data[0].length : 0
  const {
    headerRows,
    headerColumns,
    dataRows,
    columns,
    rows,
  } = element.dimensions

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
      const { Component, cssId, cssClass, contents } = cellContentsGetter(
        columnIndex,
        rowIndex
      )

      const headerClickedCallback =
        rowIndex === 0 ? toggleSortOrder : undefined

      const columnSortDirection =
        columnIndex === sortColumn ? sortDirection : undefined

      const cellDataType =
        element.types.data[columnIndex - headerColumns]?.pandas_type
      const isNumeric = cellDataType === "int64" || cellDataType === "float64"

      const hasData = dataRows !== 0
      const isLastRow = rowIndex === dataRows
      const isLastCol = columnIndex === columns - headerColumns

      // Merge our base styles with any additional cell-specific
      // styles returned by the cellContentsGetter
      const style: React.CSSProperties = {
        ...baseStyle,
        borderBottom: isLastRow && hasData ? "none" : undefined,
        borderRight: isLastCol ? "none" : undefined,
      }

      return (
        <DataFrameCell
          key={key}
          CellType={Component}
          id={cssId}
          className={cssClass}
          columnIndex={columnIndex}
          rowIndex={rowIndex}
          style={style}
          isNumeric={isNumeric}
          contents={contents}
          sortedByUser={sortedByUser}
          columnSortDirection={columnSortDirection}
          headerClickedCallback={headerClickedCallback}
        />
      )
    }
  }

  /**
   * Returns the row indices for a DataFrame, sorted based on the values in the given
   * columnIdx. (Note that the columnIdx is 0-based, and so does *not* include the header column;
   * similarly, the sorted row indices will not include the header row.)
   */
  const getSortedDataRowIndices = (
    sortColumnIdx: number,
    sortAscending: boolean
  ): number[] => {
    const [dataRows, dataColumns] =
      element.data.length > 0
        ? [element.data.length, element.data[0].length]
        : [0, 0]

    if (sortColumnIdx < 0 || sortColumnIdx >= dataColumns) {
      throw new Error(
        `Bad sortColumnIdx ${sortColumnIdx} (should be >= 0, < ${dataColumns})`
      )
    }

    const sortColumnType = Quiver.getTypeName(
      element.types.data[sortColumnIdx]
    )

    const indices = new Array(dataRows)
    for (let i = 0; i < dataRows; i += 1) {
      indices[i] = i
    }
    indices.sort((aRowIdx, bRowIdx) => {
      const aValue = element.data[aRowIdx][sortColumnIdx]
      const bValue = element.data[bRowIdx][sortColumnIdx]
      return sortAscending
        ? compareValues(aValue, bValue, sortColumnType)
        : compareValues(bValue, aValue, sortColumnType)
    })

    return indices
  }

  function compareValues(a: DataType, b: DataType, type: string): number {
    if (type === "unicode") {
      return compareStrings(a as string, b as string)
    }

    return compareAny(a, b)
  }

  function compareStrings(a: string, b: string): number {
    const STRING_COLLATOR = new Intl.Collator("en", {
      numeric: false,
      sensitivity: "base",
    })

    // using a Collator is faster than string.localeCompare:
    // https://stackoverflow.com/questions/14677060/400x-sorting-speedup-by-switching-a-localecompareb-to-ab-1ab10/52369951#52369951
    return STRING_COLLATOR.compare(a, b)
  }

  // Cannot enforce types here. Custom type operator overloading
  // is not supported in TypeScript.
  function compareAny(a: any, b: any): number {
    if (a < b) {
      return -1
    }
    if (a > b) {
      return 1
    }
    return 0
  }

  /**
   * Returns the row indices, in display order, for this DataFrame,
   * given its sortColumn and sortDirection.
   */
  const getDataRowIndices = (nCols: number): number[] => {
    const { headerColumns, dataRows } = element.dimensions

    const sortAscending = sortDirection !== SortDirection.DESCENDING

    // If we're sorting a header column, our sorted row indices are just the
    // row indices themselves (reversed, if SortDirection == DESCENDING)
    if (sortColumn < headerColumns || sortColumn - headerColumns >= nCols) {
      const rowIndices = new Array(dataRows)
      for (let i = 0; i < dataRows; i += 1) {
        rowIndices[i] = sortAscending ? i : dataRows - (i + 1)
      }

      return rowIndices
    }

    return getSortedDataRowIndices(sortColumn - headerColumns, sortAscending)
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
    if (sortColumn - headerColumns >= nCols) {
      setSortColumn(0)
      setSortDirection(SortDirection.ASCENDING)
      setSortedByUser(false)
    }
  }, [sortColumn, headerColumns, nCols])

  const { cssId, cssStyles } = element

  // Put it all together.
  return (
    <StyledDataFrameContainer
      id={cssId}
      className="stDataFrame"
      width={elementWidth}
    >
      {cssStyles && <style>{cssStyles}</style>}
      <MultiGrid
        cellRenderer={cellRenderer}
        fixedColumnCount={headerColumns}
        fixedRowCount={headerRows}
        columnWidth={columnWidth}
        columnCount={columns}
        enableFixedColumnScroll={false}
        enableFixedRowScroll={false}
        height={height}
        rowHeight={rowHeight}
        rowCount={rows}
        width={elementWidth}
        classNameBottomLeftGrid="table-bottom-left"
        classNameTopRightGrid="table-top-right"
        classNameBottomRightGrid="table-bottom-right"
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

export default withFullScreenWrapper(ArrowDataFrame)
