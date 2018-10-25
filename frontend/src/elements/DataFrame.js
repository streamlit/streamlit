/**
 * Component display a Pandas Dataframe.
 */

import React, { PureComponent } from 'react';
import { Alert }  from 'reactstrap';
import { MultiGrid } from 'react-virtualized';
import { toFormattedString } from '../format';

import {
  dataFrameGet,
  dataFrameGetDimensions,
} from '../dataFrameProto';

import './DataFrame.css';

/**
 * Functional element representing a DataFrame.
 */

// let prev_df, prev_width = [null, null];

class DataFrame extends PureComponent {
  constructor(props) {
    super(props);
    this.multGridRef = React.createRef();
  }

  render() {
    // Get the properties.
    const {df, width} = this.props;

    try {
      // Calculate the dimensions of this array.
      const { headerRows, headerCols, dataRows, cols, rows } =
          dataFrameGetDimensions(df);

      // Rendering constants.
      const rowHeight = 25;
      const headerHeight = rowHeight * headerRows;
      const border = 3;
      const height = Math.min(rows * rowHeight, 300) + border;

      // Get the cell renderer.
      const cellContents = getCellContents(df, headerRows, headerCols);
      const cellRenderer = getCellRenderer(cellContents);
      let {elementWidth, columnWidth, headerWidth} = getWidths(
          cols, rows, headerCols, headerRows, width - border, cellContents);

      // Add space for the "(empty)" text.
      if (dataRows == 0 && elementWidth < 60) {
        elementWidth = 60;
        headerWidth = 60;
        if (columnWidth * cols < 60) {
          columnWidth = 60/cols;
        }
      }

      // Since this is a PureComponent, finding ourselves in this method
      // means that the props have chaged, so we should force a rerender of the
      // widths.
      setTimeout(() => {
        if (this.multGridRef.current !== null) {
          this.multGridRef.current.recomputeGridSize();
        }
      }, 0);

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
              classNameBottomLeftGrid='table-bottom-left'
              classNameTopRightGrid='table-top-right'
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
              dataRows == 0 ?
                <div className="empty-dataframe">
                  (empty)
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
 * Returns a function which can render each cell.
 *
 * element    - the dataframe to render
 * headerRows - the number of frozen rows
 * headerCols - the number of frozen columns
 */
function getCellContents(df, headerRows, headerCols) {
  return (columnIndex, rowIndex) => {
    // All table elements have class 'dataframe'.

    let { contents, type } = dataFrameGet(df, columnIndex, rowIndex);
    let classes = `dataframe ${type}`;

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
function getWidths(cols, rows, headerCols, headerRows, width, cellContents) {
  // Calculate column width based on character count alone.
   let columnWidth = ({index}) => {
    const colIndex = index;
    const fontSize = 10;
    const charWidth = fontSize * 8 / 10;
    const padding = 14;
    const [minWidth, maxWidth] = [25, 400];

    // Set the colWidth to the maximum width of a column.
    const maxRows = 100;
    let colWidth = minWidth;
    for (var i = 0 ; i < Math.min(rows, maxRows) ; i++) {
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
      if (cellWidth > maxWidth)
        return maxWidth;
      else if (cellWidth > colWidth)
        colWidth = cellWidth;
    }
    return colWidth;
  };

  // Increase column with if the table is somewhat narrow (but not super narrow)

  let tableWidth = 0;
  let headerWidth = 0;

  for (var colIndex = 0 ; colIndex < cols ; colIndex++) {
    const colWidth = columnWidth({index: colIndex});
    tableWidth += colWidth;
    if (colIndex < headerCols) {
      headerWidth += colWidth;
    } else if (tableWidth >= width) {
      // No need to continue. We already know the followign "if" condition will fail.
      break;
    }
  }

  let elementWidth = Math.min(tableWidth, width);

  if (tableWidth > width * 2/3 && tableWidth < width) {
    const widthArray = Array.from({length: cols}, (_, colIndex) => (
      columnWidth({index: colIndex}) + (width - tableWidth) / cols
    ));
    columnWidth = ({index}) => widthArray[index];
    elementWidth = width;
  }

  return {elementWidth, columnWidth, headerWidth};
}


export default DataFrame;
