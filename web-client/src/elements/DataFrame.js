/**
 * Component display a Pandas Dataframe.
 */

// import React, { PureComponent } from 'react';

import React from 'react';
import { Alert }  from 'reactstrap';
import { AutoSizer, MultiGrid } from 'react-virtualized';
import numeral from 'numeral';

import './DataFrame.css';

/**
* Represents a Pandas Dataframe on the screen.
*/
// class DataFrame extends PureComponent {
//   constructor(props) {
//     super(props);
//     this._cellRenderer = this._cellRenderer.bind(this)
//   }
//

//   }
//
//   // Renders out each cell
//   _cellRenderer({columnIndex, key, rowIndex, style}) {

//   }
// }

function takesAnIndex(index) {
  console.log(index);
}

 /**
  * Functional element representing a DataFrame.
  */
const DataFrame = ({element}) => {
  try {
    // Calculate the dimensions of this array.
    const [headerCols, dataRowsCheck] = indexGetLevelsAndLength(element.index);
    const [headerRows, dataColsCheck] = indexGetLevelsAndLength(element.columns);
    const [dataRows, dataCols] = tableGetRowsAndCols(element.data);
    if ((dataRows !== dataRowsCheck) || (dataCols !== dataColsCheck))
      throw new Error("Dataframe dimensions don't align.")
    const cols = headerCols + dataCols;
    const rows = headerRows + dataRows;

    // Debug - begin
    console.log('Rendering this DataFrame');
    console.log('MAKE SURE THIS DOESNT HAPPEN TOO OFTEN!')
    console.log('headerRows', headerRows)
    console.log('headerCols', headerCols)
    console.log('dataRows', dataRows)
    console.log('dataCols', dataCols)
    // Debug - end

    // Get the cell renderer.
    const cellContents = getCellContents(element, headerRows, headerCols);
    const cellRenderer = getCellRenderer(cellContents);

    // Rendering constants.
    const rowHeight = 25;
    const headerHeight = rowHeight * headerRows;
    const border = 3;
    const height = Math.min(rows * rowHeight, 300) + border;

    // Put it all together.
    return (
      <div style={{height}}>
        <AutoSizer>
            {({width}) => {
              const {columnWidth, headerWidth} =
                getWidths(cols, rows, headerCols, width - border, cellContents);
              return (
                <div style={{width, height}}
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
              );
            }
          }
        </AutoSizer>
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

/**
 * Returns a function which can render each cell.
 *
 * element    - the dataframe to render
 * headerRows - the number of frozen rows
 * headerCols - the number of frozen columns
 */
function getCellContents(element, headerRows, headerCols) {
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
        contents = indexGet(element.index,
          columnIndex, rowIndex - headerRows);
      }
    } else {
      if (rowIndex < headerRows) {
        classes += ' row-header';
        contents = indexGet(element.columns,
          rowIndex, columnIndex - headerCols);
      }
      else {
        classes += ' data'
        contents = tableGet(element.data,
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
  const fontSize = 10;
  const charWidth = fontSize * 8 / 10;
  const padding = 14;
  const colWidthArray = Array(cols).fill(0).map((_, colIndex) => (
    padding + Math.max(...(Array(rows).fill(0).map((_, rowIndex) => (
      cellContents(colIndex, rowIndex).contents.length * charWidth
    ))))
  ));

  // Grow the cells to fill the array width.
  const sum = (array) => array.reduce((a, b) => a + b, 0);
  const totalWidth = sum(colWidthArray);
  if (totalWidth < width) {
    for (let i = headerCols ; i < cols ; i++) {
      colWidthArray[i] += (width - totalWidth) / (cols - headerCols);
    }
  }

  // Package up return values.
  const headerWidth = sum(colWidthArray.slice(0, headerCols));
  const columnWidth = ({index}) => (colWidthArray[index]);
  return {columnWidth, headerWidth};
}

/**
 * Returns [rows, cols] for this table.
 */
function tableGetRowsAndCols(table) {
  const cols = table.cols.length;
  if (cols === 0)
    return [0, 0];
  const rows = anyArrayLength(table.cols[0]);
  return [rows, cols];
}

/**
 * Returns the given element from the table.
 */
function tableGet(table, columnIndex, rowIndex) {
   return anyArrayGet(table.cols[columnIndex], rowIndex);
}

/**
 * Returns [levels, length]. The former is the length of the index, while the
 * latter is 1 (or >1 for MultiIndex).
 */
function indexGetLevelsAndLength(index) {
  let levels, length;
  if (index.plainIndex) {
    levels = 1;
    length = anyArrayLength(index.plainIndex.data)
  } else if (index.rangeIndex) {
    const {start, stop, step} = index.rangeIndex;
    levels = 1;
    length = Math.floor((stop - start) / step);
  } else if (index.multiIndex) {
    levels = index.multiIndex.labels.length;
    if (levels === 0)
      return [0, 0];
    length = index.multiIndex.labels[0].data.length;
  } else {
    throw new Error(`Index type "${index.type}" not understood.`)
  }
  return [levels, length];
}

/**
 * Returns the ith index value of the given level.
 */
function indexGet(index, level, i) {
  if (index.plainIndex) {
    if (level !== 0)
      throw new Error(`Attempting to access level ${level} of a plainIndex.`)
    return anyArrayGet(index.plainIndex.data, i)
  } else if (index.rangeIndex) {
    if (level !== 0)
      throw new Error(`Attempting to access level ${level} of a rangeIndex.`)
    return index.rangeIndex.start + i * index.rangeIndex.step;
  } else if (index.multiIndex) {
    const levels = index.multiIndex.levels[level]
    const labels = index.multiIndex.labels[level]
    return indexGet(levels, 0, labels.data[i]);
  } else {
    throw new Error(`Index type "${index.type}" not understood.`)
  }
}

/**
 * Returns the length of an AnyArray.
 */
function anyArrayLength(anyArray) {
  return anyArrayData(anyArray).length
}

/**
 * Returns the ith element of this AnyArray.
 */
function anyArrayGet(anyArray, i) {
  return anyArrayData(anyArray)[i];
}

/**
 * Returns the data array of an protobuf.AnyArray.
 */
function anyArrayData(anyArray) {
  return (
    anyArray.strings ||
    anyArray.doubles ||
    anyArray.int32s
  ).data
}

/**
 * Returns true if this number is a float.
 */
function isFloat(n){
    return Number(n) === n && n % 1 !== 0;
}

export default DataFrame;
