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

import React from "react"
import { Map as ImmutableMap } from "immutable"
import { MultiGrid } from "react-virtualized"
import DataFrameCell from "./DataFrameCell"
import { SortDirection } from "./SortDirection"
import withFullScreenWrapper from "hocs/withFullScreenWrapper"
import {
  dataFrameGet,
  dataFrameGetDimensions,
  getSortedDataRowIndices,
} from "lib/dataFrameProto"
import { toFormattedString } from "lib/format"
import "./DataFrame.scss"

/**
 * Size of the optional sort icon displayed in column headers
 */
const SORT_ICON_WIDTH_PX = 10

/**
 * Minimum size of a dataframe cell.
 */
export const MIN_CELL_WIDTH_PX = 25

/**
 * Maximum size of a dataframe cell.
 */
const MAX_CELL_WIDTH_PX = 200

/**
 * Maximum size of a dataframe cell in a 1-column dataframe.
 */
const MAX_LONELY_CELL_WIDTH_PX = 400

export interface Props {
  width: number
  height: number | undefined
  element: ImmutableMap<string, any>
}

interface State {
  /**
   * If true, then the user manually clicked on a column header to sort the
   * table.
   */
  sortedByUser: boolean

  /**
   * Index of the column on which the table is sorted.
   * (Column 0 = row indices).
   */
  sortColumn: number

  /** Sort direction for table sorting. */
  sortDirection: SortDirection
}

interface Dimensions {
  rowHeight: number
  headerHeight: number
  border: number
  height: number
  elementWidth: number
  columnWidth: ({ index }: { index: number }) => number
  headerWidth: number
}

interface CellContents {
  classes: string
  styles: object
  contents: string
}

interface CellContentsGetter {
  (columnIndex: number, rowIndex: number): CellContents
}

interface ComputedWidths {
  elementWidth: number
  columnWidth: ({ index }: { index: number }) => number
  headerWidth: number
}

interface CellRendererInput {
  columnIndex: number
  key: string
  rowIndex: number
  style: object
}

interface CellRenderer {
  (input: CellRendererInput): React.ReactNode
}

const DEFAULT_HEIGHT = 300

/**
 * Functional element representing a DataFrame.
 */
export class DataFrame extends React.PureComponent<Props, State> {
  private multiGridRef = React.createRef<MultiGrid>()

  public constructor(props: Props) {
    super(props)
    this.state = {
      /**
       * If true, then the user manually clicked on a column header to sort the
       * table.
       */
      sortedByUser: false,

      /**
       * Index of the column on which the table is sorted.
       * (Column 0 = row indices).
       */
      sortColumn: 0,

      /** Sort direction for table sorting. */
      sortDirection: SortDirection.ASCENDING,
    }

    this.toggleSortOrder = this.toggleSortOrder.bind(this)
  }

  /**
   * Returns a function that creates a DataFrameCell component for the given cell.
   */
  private getCellRenderer(
    cellContentsGetter: CellContentsGetter
  ): CellRenderer {
    return ({
      columnIndex,
      key,
      rowIndex,
      style: baseStyle,
    }: CellRendererInput): React.ReactNode => {
      const {
        classes,
        styles: additionalStyles,
        contents,
      } = cellContentsGetter(columnIndex, rowIndex)
      const headerClickedCallback =
        rowIndex === 0 ? this.toggleSortOrder : undefined
      const sortDirection =
        columnIndex === this.state.sortColumn
          ? this.state.sortDirection
          : undefined

      // Merge our base styles with any additional cell-specific
      // styles returned by the cellContentsGetter
      const styles = { ...baseStyle, ...additionalStyles }

      return (
        <DataFrameCell
          key={key}
          columnIndex={columnIndex}
          rowIndex={rowIndex}
          className={classes}
          style={styles}
          contents={contents}
          sortedByUser={this.state.sortedByUser}
          columnSortDirection={sortDirection}
          headerClickedCallback={headerClickedCallback}
        />
      )
    }
  }

  /**
   * Called when one of our column headers is clicked.
   * Changes the sort order of the table.
   */
  private toggleSortOrder(columnIndex: number): void {
    let sortDirection = SortDirection.ASCENDING
    if (this.state.sortColumn === columnIndex) {
      // Clicking the same header toggles between ascending and descending
      sortDirection =
        this.state.sortDirection !== SortDirection.ASCENDING
          ? SortDirection.ASCENDING
          : SortDirection.DESCENDING
    }

    this.setState({
      sortColumn: columnIndex,
      sortDirection,
      sortedByUser: true,
    })
  }

  /**
   * Returns the row indices, in display order, for this DataFrame,
   * given its sortColumn and sortDirection.
   */
  private getDataRowIndices(): number[] {
    const { element } = this.props
    const { sortColumn, sortDirection } = this.state
    const { headerCols, dataRows } = dataFrameGetDimensions(element)

    const sortAscending = sortDirection !== SortDirection.DESCENDING

    // If we're sorting a header column, our sorted row indices are just the
    // row indices themselves (reversed, if SortDirection == DESCENDING)
    if (sortColumn < headerCols) {
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
   * Returns rendering dimensions for this DataFrame
   */
  private getDimensions(cellContentsGetter: CellContentsGetter): Dimensions {
    const { element, width, height } = this.props

    const {
      headerRows,
      headerCols,
      dataRows,
      cols,
      rows,
    } = dataFrameGetDimensions(element)

    // Rendering constants.
    const rowHeight = 25
    const headerHeight = rowHeight * headerRows
    const border = 2

    let { elementWidth, columnWidth, headerWidth } = getWidths(
      cols,
      rows,
      headerCols,
      headerRows,
      width - border,
      cellContentsGetter
    )

    // Add space for the "empty" text when the table is empty.
    const EMPTY_WIDTH = 60 // px
    if (dataRows === 0 && elementWidth < EMPTY_WIDTH) {
      elementWidth = EMPTY_WIDTH
      headerWidth = EMPTY_WIDTH
      let totalWidth = 0
      for (let i = 0; i < cols; i++) {
        totalWidth += columnWidth({ index: i })
      }
      if (totalWidth < EMPTY_WIDTH) {
        columnWidth = () => EMPTY_WIDTH / cols
      }
    }

    return {
      rowHeight,
      headerHeight,
      border,
      height: Math.min(rows * rowHeight, height || DEFAULT_HEIGHT),
      elementWidth,
      columnWidth,
      headerWidth,
    }
  }

  /**
   * Schedule a gridSize recompute if we have a multigrid attached.
   * This should be called whenever our data may have changed (i.e., from the render() method).
   */
  private recomputeSizeIfNeeded(): void {
    setTimeout(() => {
      if (this.multiGridRef.current != null) {
        this.multiGridRef.current.recomputeGridSize()
      }
    }, 0)
  }

  public render(): React.ReactNode {
    // Get the properties.
    const { element } = this.props

    // Calculate the dimensions of this array.
    const {
      headerRows,
      headerCols,
      dataRows,
      cols,
      rows,
    } = dataFrameGetDimensions(element)

    const sortedDataRowIndices = this.getDataRowIndices()

    // Get the cell renderer.
    const cellContentsGetter = getCellContentsGetter(
      element,
      headerRows,
      headerCols,
      sortedDataRowIndices
    )
    const cellRenderer = this.getCellRenderer(cellContentsGetter)

    // Determine our rendering dimensions
    const {
      rowHeight,
      headerHeight,
      border,
      height,
      elementWidth,
      columnWidth,
      headerWidth,
    } = this.getDimensions(cellContentsGetter)

    // Since this is a PureComponent, finding ourselves in this method
    // means that the props have changed, so we should force a rerender of the
    // widths.
    this.recomputeSizeIfNeeded()

    // Put it all together.
    return (
      <div
        style={{ width: elementWidth }}
        className="dataframe-container stDataFrame"
      >
        <MultiGrid
          className="dataFrame"
          cellRenderer={cellRenderer}
          fixedColumnCount={headerCols}
          fixedRowCount={headerRows}
          columnWidth={columnWidth}
          columnCount={cols}
          enableFixedColumnScroll
          enableFixedRowScroll
          height={height}
          rowHeight={rowHeight}
          rowCount={rows}
          width={elementWidth}
          classNameBottomLeftGrid="table-bottom-left"
          classNameTopRightGrid="table-top-right"
          ref={this.multiGridRef}
        />
        <div
          className="fixup fixup-top-right"
          style={{
            width: border,
            height: headerHeight,
          }}
        />
        <div
          className="fixup fixup-bottom-left"
          style={{
            width: headerWidth,
            height: border,
          }}
        />
        {dataRows === 0 ? <div className="empty-dataframe">empty</div> : null}
      </div>
    )
  }
}

/**
 * Returns a function which can access individual cell data in a DataFrame.
 *
 * The returned function has the form:
 *
 * cellContentsGetter(columnIndex: int, rowIndex: int) -> {
 *    classes: str - a css class string
 *    styles: {property1: value1, ...} - css styles to apply to the cell
 *    contents: str - the cell's formatted display string
 * }
 *
 * element              - a DataFrame
 * headerRows           - the number of frozen rows
 * headerCols           - the number of frozen columns
 * sortedDataRowIndices - (optional) an array containing an ordering for row indices
 */
function getCellContentsGetter(
  element: ImmutableMap<string, any>,
  headerRows: number,
  headerCols: number,
  sortedDataRowIndices?: number[]
): CellContentsGetter {
  return (columnIndex: number, rowIndex: number): CellContents => {
    if (sortedDataRowIndices != null && rowIndex >= headerRows) {
      // If we have a sortedDataRowIndices Array, it contains a mapping of row indices for
      // all *data* (non-header) rows.
      const sortIdx = rowIndex - headerRows
      if (sortIdx >= 0 && sortIdx < sortedDataRowIndices.length) {
        rowIndex = sortedDataRowIndices[sortIdx]
        rowIndex += headerRows
      } else {
        console.warn(
          `Bad sortedDataRowIndices (` +
            `rowIndex=${rowIndex}, ` +
            `headerRows=${headerRows}, ` +
            `sortedDataRowIndices.length=${sortedDataRowIndices.length}`
        )
      }
    }

    const { contents, styles, type } = dataFrameGet(
      element,
      columnIndex,
      rowIndex
    )

    // All table elements have class 'dataframe'.
    const classes = `dataframe ${type}`

    // Format floating point numbers nicely.
    const fsContents = toFormattedString(contents)

    // Put it all together
    return { classes, styles, contents: fsContents }
  }
}

/**
 * Computes various dimensions for the table.
 *
 * First of all we create an array containing all the calculated column widths,
 * if the difference between the total of columns and the container width is negative
 * we put a width limit, if not, we divide the remaining space by each exceeding width
 */
function getWidths(
  cols: number,
  rows: number,
  headerCols: number,
  headerRows: number,
  containerWidth: number,
  cellContentsGetter: CellContentsGetter
): ComputedWidths {
  const minWidth = MIN_CELL_WIDTH_PX
  const maxWidth =
    cols > 2 // 2 because 1 column is the index.
      ? MAX_CELL_WIDTH_PX
      : MAX_LONELY_CELL_WIDTH_PX

  // Calculate column width based on character count alone.
  const calculateColumnWidth = ({ index }: { index: number }): number => {
    const colIndex = index
    const fontSize = 10
    const charWidth = (fontSize * 8) / 10
    const padding = 14 + SORT_ICON_WIDTH_PX // 14 for whitespace; an extra 10 for the optional sort arrow icon

    // Set the colWidth to the maximum width of a column.
    const maxRows = 100
    let colWidth = minWidth
    for (let i = 0; i < Math.min(rows, maxRows); i++) {
      let rowIndex = -1
      if (i < headerRows) {
        // Always measure all the header rows.
        rowIndex = i
      } else if (rows > maxRows) {
        // If there are a lot of rows, then pick some at random.
        rowIndex = Math.floor(Math.random() * rows)
      } else {
        // Otherwise, just measure every row.
        rowIndex = i
      }
      const contents = cellContentsGetter(colIndex, rowIndex).contents
      const nChars = contents ? contents.length : 0
      const cellWidth = nChars * charWidth + padding

      if (cellWidth > colWidth) {
        colWidth = cellWidth
      }
    }
    return colWidth
  }

  let distributedTable: Array<number> = []
  const tableColumnWidth: Array<number> = Array.from(Array(cols), (_, index) =>
    calculateColumnWidth({ index })
  )
  const totalTableWidth = tableColumnWidth.reduce((a, b) => a + b, 0)
  const remainingSpace = containerWidth - totalTableWidth
  const getColumnsThatExceedMaxWidth = (
    columns: Array<number>
  ): Array<number> => columns.filter(width => width > maxWidth)

  if (remainingSpace < 0) {
    distributedTable = tableColumnWidth.map(width =>
      width > maxWidth ? maxWidth : width
    )
  } else {
    const columnsThatExceed = getColumnsThatExceedMaxWidth(tableColumnWidth)
    const remainingSpaceByColumn = remainingSpace / columnsThatExceed.length

    distributedTable = tableColumnWidth.map((width, id) => {
      if (id in columnsThatExceed.keys()) {
        return width + remainingSpaceByColumn
      }

      return width
    })
  }

  let distributedTableTotal = distributedTable.reduce((a, b) => a + b, 0)
  if (
    distributedTableTotal > containerWidth * (2 / 3) &&
    distributedTableTotal < containerWidth
  ) {
    const remainingSpace = (containerWidth - distributedTableTotal) / cols
    distributedTable = distributedTable.map(width => width + remainingSpace)
    distributedTableTotal = distributedTable.reduce((a, b) => a + b, 0)
  }

  const elementWidth = Math.min(distributedTableTotal, containerWidth)
  const columnWidth = ({ index }: { index: number }): number =>
    distributedTable[index]

  const headerWidth = distributedTable
    .slice(0, headerCols)
    .reduce((prev, curr) => prev + curr)

  return {
    elementWidth,
    columnWidth,
    headerWidth,
  }
}

export default withFullScreenWrapper(DataFrame)
