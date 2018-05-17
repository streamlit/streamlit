/**
 * Component display a Pandas Dataframe.
 */

import React, { PureComponent } from 'react';
import { Alert }  from 'reactstrap';
import { MultiGrid } from 'react-virtualized';
import { toFormattedString } from '../format';

import {
  dataFrameGetDimensions,
  indexGet,
  tableGet,
} from '../dataFrameProto';

import './DataFrame.css';

/**
 * Functional element representing a DataFrame.
 */

// let prev_df, prev_width = [null, null];

class DataFrame extends PureComponent {
  render() {
    // Get the properties.
    const {df, width} = this.props;

    try {
      // Calculate the dimensions of this array.
      const { headerRows, headerCols, cols, rows } = dataFrameGetDimensions(df);

      // Rendering constants.
      const rowHeight = 25;
      const headerHeight = rowHeight * headerRows;
      const border = 3;
      const height = Math.min(rows * rowHeight, 300) + border;

      // Get the cell renderer.
      const cellContents = getCellContents(df, headerRows, headerCols);
      const cellRenderer = getCellRenderer(cellContents);
      const {columnWidth, headerWidth} =
        getWidths(cols, rows, headerCols, width - border, cellContents);
      // width = tableWidth + border;

      // Put it all together.
      return (
        <div style={{width, height}}>
          <div style={{width, height, position: 'absolute'}}
            className="dataframe-container">
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
                width={width - border}
                classNameBottomLeftGrid='table-bottom-left'
                classNameTopRightGrid='table-top-right'
              />
              <div className="fixup fixup-top-right" style={{
                width: border,
                height: headerHeight,
              }}/>
              <div className="fixup fixup-bottom-left" style={{
                width: headerWidth,
                height: border,
              }}/>
          </div>
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
// const DataFrame = ({df, width}) => {
//
// }

/**
 * Returns a function which can render each cell.
 *
 * element    - the dataframe to render
 * headerRows - the number of frozen rows
 * headerCols - the number of frozen columns
 */
function getCellContents(df, headerRows, headerCols) {
  return (columnIndex, rowIndex) => {
    // All table elements have class 'dataframe'.
    let classes = 'dataframe';
    let contents = ''

    // Data lookups depend on where we are in the grid.
    if (columnIndex < headerCols) {
      if (rowIndex < headerRows)
        classes += ' corner'
      else {
        classes += ' col-header';
        contents = indexGet(df.get('index'),
          columnIndex, rowIndex - headerRows);
      }
    } else {
      if (rowIndex < headerRows) {
        classes += ' row-header';
        contents = indexGet(df.get('columns'),
          rowIndex, columnIndex - headerCols);
      }
      else {
        classes += ' data'
        contents = tableGet(df.get('data'),
            columnIndex - headerCols, rowIndex - headerRows)
      }
    }

    // Give special classes for even and odd rows.
    // We use + instead of - because they're equivalent mod 2.
    if ((rowIndex + headerCols) % 2 === 0)
      classes += ' even'
    else
      classes += ' odd'

    // Format floating point numbers nicely.
    contents = toFormattedString(contents);

    // Put it all together
    return {classes, contents};
  };
}

/**
 * Returns a function which can render an React element for each cell.
 */
function getCellRenderer(cellContents) {
  return ({columnIndex, key, rowIndex, style}) => {
    const {classes, contents} = cellContents(columnIndex, rowIndex);
    return (
      <div key={key} className={classes} style={style}>
        {contents}
      </div>
    );
  };
}

/**
 * Computes various dimensions for the table.
 */
function getWidths(cols, rows, headerCols, width, cellContents) {
  // Calculate column width based on character count alone.
   let columnWidth = ({index}) => {
    const colIndex = index;
    const fontSize = 10;
    const charWidth = fontSize * 8 / 10;
    const padding = 14;
    const [minWidth, maxWidth] = [25, 400];

    // Set the colWidth to the maximum width of a column. If more than maxRows
    // then select maxRows at random to measure.
    const maxRows = 100;
    let colWidth = minWidth;
    for (var i = 0 ; i < Math.min(rows, maxRows) ; i++) {
      const rowIndex = rows > maxRows ? Math.floor(Math.random() * rows) : i;
      const nChars = cellContents(colIndex, rowIndex).contents.length;
      const cellWidth = nChars * charWidth + padding;
      if (cellWidth > maxWidth)
        return maxWidth;
      else if (cellWidth > colWidth)
        colWidth = cellWidth;
    }
    return colWidth;
  };

  // Increase column with if the table is too narrow.
  let [tableWidth, headerWidth] = [0,0];
  for (var colIndex = 0 ; colIndex < cols ; colIndex++) {
    const colWidth = columnWidth({index: colIndex});
    tableWidth += colWidth;
    if (colIndex < headerCols)
      headerWidth += colWidth;
    else if (tableWidth >= width)
      break;
  }
  if (tableWidth < width) {
    const widthArray = Array.from({length: cols}, (_, colIndex) => (
      columnWidth({index: colIndex}) + (width - tableWidth) / cols
    ));
    columnWidth = ({index}) => widthArray[index];
  }

  return {columnWidth, headerWidth};
}


export default DataFrame;
