/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 *
 * @fileoverview Component display a Pandas Dataframe.
 */

import React, { PureComponent } from 'react';
import { Alert } from 'reactstrap';
import { MultiGrid } from 'react-virtualized';
import { toFormattedString } from '../format';
import DataFrameCell from './DataFrameCell';
import { dataFrameGet, dataFrameGetDimensions, getSortedDataRowIndices } from '../dataFrameProto';
import './DataFrame.css';
import { SortDirection } from '../SortDirection';

const SORT_ICON_WIDTH = 10; // size of the optional sort icon displayed in column headers

/**
 * Functional element representing a DataFrame.
 */
class DataFrame extends PureComponent {
  constructor(props) {
    super(props);
    this.multGridRef = React.createRef();
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
    };

    this.toggleSortOrder = this.toggleSortOrder.bind(this);
  }

  /**
   * Returns a function that creates a DataFrameCell component for the given cell.
   */
  getCellRenderer(cellContentsGetter) {
    return ({ columnIndex, key, rowIndex, style: baseStyle }) => {
      const { classes, styles: additionalStyles, contents } = cellContentsGetter(columnIndex, rowIndex);
      const headerClickedCallback = rowIndex === 0 ? this.toggleSortOrder : null;
      const sortDirection = columnIndex === this.state.sortColumn ?
        this.state.sortDirection : null;

      // Merge our base styles with any additional cell-specific
      // styles returned by the cellContentsGetter
      const styles = { ...baseStyle, ...additionalStyles };

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
      );
    };
  }

  /**
   * Called when one of our column headers is clicked.
   * Changes the sort order of the table.
   */
  toggleSortOrder(columnIndex) {
    let sortDirection = SortDirection.ASCENDING;
    if (this.state.sortColumn === columnIndex) {
      // Clicking the same header toggles between ascending and descending
      sortDirection = this.state.sortDirection !== SortDirection.ASCENDING ?
        SortDirection.ASCENDING :
        SortDirection.DESCENDING;
    }

    this.setState({
      sortColumn: columnIndex,
      sortDirection,
      sortedByUser: true,
    });
  }

  /**
   * Returns the row indices, in display order, for this DataFrame,
   * given its sortColumn and sortDirection.
   */
  getDataRowIndices() {
    const {df} = this.props;
    const {sortColumn, sortDirection} = this.state;
    const {headerCols, dataRows} = dataFrameGetDimensions(df);

    const sortAscending = sortDirection !== SortDirection.DESCENDING;

    // If we're sorting a header column, our sorted row indices are just the
    // row indices themselves (reversed, if SortDirection == DESCENDING)
    if (sortColumn < headerCols) {
      let rowIndices = new Array(dataRows);
      for (let i = 0; i < dataRows; i += 1) {
        rowIndices[i] = sortAscending ? i : dataRows - (i + 1);
      }

      return rowIndices;
    }

    return getSortedDataRowIndices(df, sortColumn - headerCols, sortAscending);
  }

  /**
   * Returns rendering dimensions for this DataFrame
   */
  getDimensions(cellContentsGetter) {
    const {df, width} = this.props;

    const { headerRows, headerCols, dataRows, cols, rows } =
      dataFrameGetDimensions(df);

    // Rendering constants.
    const rowHeight = 25;
    const headerHeight = rowHeight * headerRows;
    const border = 3;
    const height = Math.min(rows * rowHeight, 300) + border;

    let {elementWidth, columnWidth, headerWidth} = getWidths(
      cols, rows, headerCols, headerRows, width - border, cellContentsGetter);

    // Add space for the "empty" text.
    if (dataRows === 0 && elementWidth < 60) {
      elementWidth = 60;
      headerWidth = 60;
      if (columnWidth * cols < 60) {
        columnWidth = 60 / cols;
      }
    }

    return {rowHeight, headerHeight, border, height, elementWidth, columnWidth, headerWidth};
  }

  /**
   * Schedule a gridSize recompute if we have a multigrid attached.
   * This should be called whenever our data may have changed (i.e., from the render() method).
   */
  recomputeSizeIfNeeded() {
    setTimeout(() => {
      if (this.multGridRef.current != null) {
        this.multGridRef.current.recomputeGridSize();
      }
    }, 0);
  }

  render() {
    // Get the properties.
    const {df, width} = this.props;

    try {
      // Calculate the dimensions of this array.
      const { headerRows, headerCols, dataRows, cols, rows } =
          dataFrameGetDimensions(df);

      const sortedDataRowIndices = this.getDataRowIndices();

      // Get the cell renderer.
      const cellContentsGetter = getCellContentsGetter(df, headerRows, headerCols, sortedDataRowIndices);
      const cellRenderer = this.getCellRenderer(cellContentsGetter);

      // Determine our rendering dimensions
      const {
        rowHeight,
        headerHeight,
        border,
        height,
        elementWidth,
        columnWidth,
        headerWidth,
      } = this.getDimensions(cellContentsGetter);

      // Since this is a PureComponent, finding ourselves in this method
      // means that the props have changed, so we should force a rerender of the
      // widths.
      this.recomputeSizeIfNeeded();

      // Put it all together.
      return (
        <div style={{width: elementWidth}} className="dataframe-container">
          <MultiGrid
            className="dataFrame"
            cellRenderer={cellRenderer}
            fixedColumnCount={headerCols}
            fixedRowCount={headerRows}
            columnWidth={columnWidth}
            columnCount={cols}
            enableFixedColumnScroll
            enableFixedRowScroll
            height={height - border}
            rowHeight={rowHeight}
            rowCount={rows}
            width={elementWidth}
            classNameBottomLeftGrid="table-bottom-left"
            classNameTopRightGrid="table-top-right"
            ref={this.multGridRef}
          />
          <div className="fixup fixup-top-right" style={{
            width: border,
            height: headerHeight,
          }}/>
          <div className="fixup fixup-bottom-left" style={{
            width: headerWidth,
            height: border,
          }}/>
          {
            dataRows === 0 ?
              <div className="empty-dataframe">
                  empty
              </div>
              : null
          }
        </div>
      );
    } catch (e) {
      console.log(e.stack);
      return (
        <Alert style={{width}} color="danger">
          <strong>{e.name}</strong>: {e.message}
        </Alert>
      );
    }
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
 * df                   - a DataFrame
 * headerRows           - the number of frozen rows
 * headerCols           - the number of frozen columns
 * sortedDataRowIndices - (optional) an array containing an ordering for row indices
 */
function getCellContentsGetter(df, headerRows, headerCols, sortedDataRowIndices = null) {
  return (columnIndex, rowIndex) => {
    if (sortedDataRowIndices != null && rowIndex >= headerRows) {
      // If we have a sortedDataRowIndices Array, it contains a mapping of row indices for
      // all *data* (non-header) rows.
      const sortIdx = rowIndex - headerRows;
      if (sortIdx >= 0 && sortIdx < sortedDataRowIndices.length) {
        rowIndex = sortedDataRowIndices[sortIdx];
        rowIndex += headerRows;
      } else {
        console.warn(`Bad sortedDataRowIndices (` +
          `rowIndex=${rowIndex}, ` +
          `headerRows=${headerRows}, ` +
          `sortedDataRowIndices.length=${sortedDataRowIndices.length}`);
      }
    }

    let { contents, styles, type } = dataFrameGet(df, columnIndex, rowIndex);

    // All table elements have class 'dataframe'.
    let classes = `dataframe ${type}`;

    // Format floating point numbers nicely.
    contents = toFormattedString(contents);

    // Put it all together
    return {classes, styles, contents};
  };
}

/**
 * Computes various dimensions for the table.
 */
function getWidths(cols, rows, headerCols, headerRows, width, cellContents) {
  // Calculate column width based on character count alone.
  let columnWidth = ({index}) => {
    const colIndex = index;
    const fontSize = 10;
    const charWidth = fontSize * 8 / 10;
    const padding = 14 + SORT_ICON_WIDTH; // 14 for whitespace; an extra 10 for the optional sort arrow icon
    const [minWidth, maxWidth] = [25, 400];

    // Set the colWidth to the maximum width of a column.
    const maxRows = 100;
    let colWidth = minWidth;
    for (let i = 0; i < Math.min(rows, maxRows); i++) {
      let rowIndex = -1;
      if (i < headerRows) {
        // Always measure all the header rows.
        rowIndex = i;
      } else if (rows > maxRows) {
        // If there are a lot of rows, then pick some at random.
        rowIndex = Math.floor(Math.random() * rows);
      } else {
        // Otherwise, just measure every row.
        rowIndex = i;
      }
      const nChars = cellContents(colIndex, rowIndex).contents.length;
      const cellWidth = nChars * charWidth + padding;
      if (cellWidth > maxWidth) {
        return maxWidth;
      } else if (cellWidth > colWidth) {
        colWidth = cellWidth;
      }
    }
    return colWidth;
  };

  // Increase column with if the table is somewhat narrow (but not super narrow)

  let tableWidth = 0;
  let headerWidth = 0;

  for (let colIndex = 0; colIndex < cols; colIndex++) {
    const colWidth = columnWidth({ index: colIndex });
    tableWidth += colWidth;
    if (colIndex < headerCols) {
      headerWidth += colWidth;
    } else if (tableWidth >= width) {
      // No need to continue. We already know the followign "if" condition will fail.
      break;
    }
  }

  let elementWidth = Math.min(tableWidth, width);

  if (tableWidth > width * (2 / 3) && tableWidth < width) {
    const widthArray = Array.from({length: cols}, (_, colIndex) => (
      columnWidth({index: colIndex}) + (width - tableWidth) / cols
    ));
    columnWidth = ({index}) => widthArray[index];
    elementWidth = width;
  }

  return {elementWidth, columnWidth, headerWidth};
}


export default DataFrame;
