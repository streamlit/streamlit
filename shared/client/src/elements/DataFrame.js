/**
 * Component display a Pandas Dataframe.
 */

import React, { PureComponent } from 'react';
import { Alert }  from 'reactstrap';
import { MultiGrid } from 'react-virtualized';
import numeral from 'numeral';
import { format, Duration } from '../format';

import {
  indexGetLevelsAndLength,
  tableGetRowsAndCols,
  indexGet,
  tableGet
} from 'streamlit-shared/lib/dataFrameProto';

import './DataFrame.css';

/**
 * Functional element representing a DataFrame.
 */

// let prev_df, prev_width = [null, null];

class DataFrame extends PureComponent {
  render() {
    try {
      // Get the properties.
      const {df, width} = this.props;

      // Calculate the dimensions of this array.
      const [headerCols, dataRowsCheck] = indexGetLevelsAndLength(df.get('index'));
      const [headerRows, dataColsCheck] = indexGetLevelsAndLength(df.get('columns'));
      const [dataRows, dataCols] = tableGetRowsAndCols(df.get('data'));
      if ((dataRows !== dataRowsCheck) || (dataCols !== dataColsCheck)) {
        throw new Error("Dataframe dimensions don't align: " +
          `rows(${dataRows} != ${dataRowsCheck}) OR ` +
          `cols(${dataCols} != ${dataColsCheck})`)
      }
      const cols = headerCols + dataCols;
      const rows = headerRows + dataRows;

      // // Debug - begin
      // console.log('Rendering this DataFrame');
      // console.log('MAKE SURE THIS DOESNT HAPPEN TOO OFTEN!')
      // console.log(`Are thigns valid? df:${df === prev_df} width:${width === prev_width}`)
      // console.log(`Just checking the df:${df === df}`)
      // console.log(df ? df.toJS() : 'undefined df')
      // console.log(prev_df ? prev_df.toJS() : 'undefined prev_df')
      // prev_df = df;
      // prev_width = width;
      // // Debug - end

      // Rendering constants.
      const rowHeight = 25;
      const headerHeight = rowHeight * headerRows;
      const border = 3;
      const height = Math.min(rows * rowHeight, 300) + border;

      // Get the cell renderer.
      const cellContents = getCellContents(df, headerRows, headerCols);
      const cellRenderer = getCellRenderer(cellContents);
      const {columnWidth, headerWidth, tableWidth} =
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
        <Alert color="danger">
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
    if (isFloat(contents))
      contents = numeral(contents).format('0,0.0000');
    else if (contents instanceof Date)
      contents = format.dateToString(contents);
    else if (contents instanceof Duration)
      contents = format.durationToString(contents);
    else
      contents = contents.toString();

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

    // Set the colWidth to the maximum width of a colum
    let colWidth = minWidth;
    for (var rowIndex = 0 ; rowIndex < rows ; rowIndex++) {
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


/**
 * Returns true if this number is a float.
 */
function isFloat(n){
    return Number(n) === n && n % 1 !== 0;
}

export default DataFrame;
