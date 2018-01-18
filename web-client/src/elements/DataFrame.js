/**
 * Component display a Pandas Dataframe.
 */

// import React, { PureComponent } from 'react';

import React from 'react';
import { Alert }  from 'reactstrap';
import { AutoSizer, MultiGrid } from 'react-virtualized';

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
    const [headerCols, dataRowsCheck] = indexGetRowsAndCols(element.index);
    const [headerRows, dataColsCheck] = indexGetRowsAndCols(element.columns);
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

    function cellRenderer({columnIndex, key, rowIndex, style}) {
      let backgroundColor = '#ddd';
      if ((columnIndex + rowIndex) % 2 === 0) {
        backgroundColor = '#eee';
      }
      const the_style = {
        ...style,
        backgroundColor: backgroundColor
      };
      return (
        <div key={key} style={the_style}>
          {columnIndex}, {rowIndex}, {key}
        </div>
      );
    }

    // Rendering constants.
    const height = 300;
    const border = 2;

    // Put it all together.
    return (
      <div style={{height}}>
        <AutoSizer>
            {({width}) => (
              <div style={{width:width, border:'1px solid black'}}>
                <MultiGrid
                  className="dataFrame"
                  cellRenderer={cellRenderer}
                  fixedColumnCount={headerCols}
                  fixedRowCount={headerRows}
                  columnWidth={100}
                  columnCount={cols}
                  enableFixedColumnScroll
                  enableFixedRowScroll
                  height={height}
                  rowHeight={30}
                  rowCount={rows}
                  width={width - border}
                />
            </div>
          )}
        </AutoSizer>
      </div>
    );
  } catch (e) {
    return (
      <Alert color="danger">
        <strong>{e.name}</strong>: {e.message}
      </Alert>
    );
  }
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
function indexGetRowsAndCols(index) {
  let levels, length;
  if (index.type === 'plainIndex') {
    levels = 1;
    length = anyArrayLength(index.plainIndex.data)
  } else if (index.type === 'multiIndex') {
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
  if (index.type === 'plainIndex') {
    if (level !== 0)
      throw new Error(`Attempting to access level ${level} of a plainIndex.`)
    return anyArrayGet(index.plainIndex.data, i)
  } else if (index.type === 'multiIndex') {
    const levels = index.multiIndex.levels[level]
    const labels = index.multiIndex.labels[level]
    return indexGet(levels, 0, labels.data[i]);
  } else {
    throw new Error(`Index type "${index.type}" not understood.`)
  }
}

/**
 * Returns [rows, cols] where rows is the length of the index and cols is 1
 * (or >1 for MultiIndices).
 */
function indexGetRowsAndCols(index) {
  let rows, cols;
  if (index.type === 'plainIndex') {
    rows = 1;
    cols = anyArrayLength(index.plainIndex.data)
  } else if (index.type === 'multiIndex') {
    rows = index.multiIndex.labels.length;
    if (rows === 0)
      return [0, 0];
    cols = index.multiIndex.labels[0].data.length;
  } else {
    throw new Error(`Index type "${index.type}" not understood.`)
  }
  return [rows, cols];
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

export default DataFrame;
