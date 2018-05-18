/**
 * Component display a Pandas Dataframe.
 */

import React, { PureComponent } from 'react';
import { Alert, Table as ReactTable }  from 'reactstrap';
import { toFormattedString } from '../format';

import {
  dataFrameGet,
  dataFrameGetDimensions,
  indexGet,
  indexGetLevelsAndLength,
  tableGet,
  tableGetRowsAndCols,
} from '../dataFrameProto';

import './Table.css';

/**
 * Functional element representing a DataFrame.
 */

class Table extends PureComponent {
  render() {
    // Get the properties.
    const {df, width} = this.props;

    try {
      return (
        <div class='streamlit-table'>
          <ReactTable>
            <thead>
              <TableRows df={df} header={true}/>
            </thead>
            <tbody>
              <TableRows df={df} header={false}/>
            </tbody>
          </ReactTable>
        </div>
      );

      // // Rendering constants.
      // const rowHeight = 25;
      // const headerHeight = rowHeight * headerRows;
      // const border = 3;
      // const height = Math.min(rows * rowHeight, 300) + border;
      //
      // // Get the cell renderer.
      // const cellContents = getCellContents(df, headerRows, headerCols);
      // const cellRenderer = getCellRenderer(cellContents);
      // const {columnWidth, headerWidth} =
      //   getWidths(cols, rows, headerCols, width - border, cellContents);
      // // width = tableWidth + border;
      //
      // // Put it all together.
      // return (
      //   <div style={{width, height}}>
      //     <div style={{width, height, position: 'absolute'}}
      //       className="dataframe-container">
      //         <MultiGrid
      //           className="dataFrame"
      //           cellRenderer={cellRenderer}
      //           fixedColumnCount={headerCols}
      //           fixedRowCount={headerRows}
      //           columnWidth={columnWidth}
      //           columnCount={cols}
      //           enableFixedColumnScroll
      //           enableFixedRowScroll
      //           height={height - border}
      //           rowHeight={rowHeight}
      //           rowCount={rows}
      //           width={width - border}
      //           classNameBottomLeftGrid='table-bottom-left'
      //           classNameTopRightGrid='table-top-right'
      //         />
      //         <div className="fixup fixup-top-right" style={{
      //           width: border,
      //           height: headerHeight,
      //         }}/>
      //         <div className="fixup fixup-bottom-left" style={{
      //           width: headerWidth,
      //           height: border,
      //         }}/>
      //     </div>
      //   </div>
      // );
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
 * Purely functional component returning a list of rows.
 *
 * df     - The dataFrame to display.
 * header - Whether to display the header.
 */
function TableRows({df, header}) {
  const { headerRows, rows } = dataFrameGetDimensions(df);
  const rowArray = [];
  const startRow = header ? 0 : headerRows;
  const endRow = header ? headerRows : rows;
  for (var rowIdx = startRow ; rowIdx < endRow ; rowIdx++)
    rowArray.push(
      <tr key={rowIdx}>
        <TableRow df={df} rowIdx={rowIdx}/>
      </tr>
    );
  return rowArray;
}

/**
 * Purely functional component returning a list entries for a row.
 *
 * df     - The dataFrame to display.
 * rowIdx - The row index.
 */
function TableRow({df, rowIdx}) {
  const { headerRows, headerCols, dataRows, dataCols, cols, rows } = dataFrameGetDimensions(df);
  const isColHeader = rowIdx < headerRows;
  const entries = [];
  for (var colIdx = 0 ; colIdx < cols ; colIdx++) {
    const { contents, type } = dataFrameGet(df, colIdx, rowIdx);
    const formattedContents = toFormattedString(contents);
    if (type === "corner") {
      entries.push(<th>&nbsp;</th>);
    } else if (type === "row-header") {
      entries.push(<th scope="row"> { formattedContents } </th>);
    } else if (type === "col-header") {
      entries.push(<th> { formattedContents } </th>);
    } else if (type === "data") {
      entries.push(<td> { formattedContents } </td>);
    }
  };
  return entries;
}

// /**
//  * Returns a function which can render each cell.
//  *
//  * element    - the dataframe to render
//  * headerRows - the number of frozen rows
//  * headerCols - the number of frozen columns
//  */
// function getCellContents(df, headerRows, headerCols) {
//   return (columnIndex, rowIndex) => {
//     // All table elements have class 'dataframe'.
//     let classes = 'dataframe';
//     let contents = ''
//
//     // Data lookups depend on where we are in the grid.
//     if (columnIndex < headerCols) {
//       if (rowIndex < headerRows)
//         classes += ' corner'
//       else {
//         classes += ' col-header';
//         contents = indexGet(df.get('index'),
//           columnIndex, rowIndex - headerRows);
//       }
//     } else {
//       if (rowIndex < headerRows) {
//         classes += ' row-header';
//         contents = indexGet(df.get('columns'),
//           rowIndex, columnIndex - headerCols);
//       }
//       else {
//         classes += ' data'
//         contents = tableGet(df.get('data'),
//             columnIndex - headerCols, rowIndex - headerRows)
//       }
//     }
//
//     // Give special classes for even and odd rows.
//     // We use + instead of - because they're equivalent mod 2.
//     if ((rowIndex + headerCols) % 2 === 0)
//       classes += ' even'
//     else
//       classes += ' odd'
//
//     // Format floating point numbers nicely.
//     if (isFloat(contents))
//       contents = numeral(contents).format('0,0.0000');
//     else if (contents instanceof Date)
//       contents = format.dateToString(contents);
//     else if (contents instanceof Duration)
//       contents = format.durationToString(contents);
//     else
//       contents = contents.toString();
//
//     // Put it all together
//     return {classes, contents};
//   };
// }
//
// /**
//  * Returns a function which can render an React element for each cell.
//  */
// function getCellRenderer(cellContents) {
//   return ({columnIndex, key, rowIndex, style}) => {
//     const {classes, contents} = cellContents(columnIndex, rowIndex);
//     return (
//       <div key={key} className={classes} style={style}>
//         {contents}
//       </div>
//     );
//   };
// }
//
// /**
//  * Computes various dimensions for the table.
//  */
// function getWidths(cols, rows, headerCols, width, cellContents) {
//   // Calculate column width based on character count alone.
//    let columnWidth = ({index}) => {
//     const colIndex = index;
//     const fontSize = 10;
//     const charWidth = fontSize * 8 / 10;
//     const padding = 14;
//     const [minWidth, maxWidth] = [25, 400];
//
//     // Set the colWidth to the maximum width of a column. If more than maxRows
//     // then select maxRows at random to measure.
//     const maxRows = 100;
//     let colWidth = minWidth;
//     for (var i = 0 ; i < Math.min(rows, maxRows) ; i++) {
//       const rowIndex = rows > maxRows ? Math.floor(Math.random() * rows) : i;
//       const nChars = cellContents(colIndex, rowIndex).contents.length;
//       const cellWidth = nChars * charWidth + padding;
//       if (cellWidth > maxWidth)
//         return maxWidth;
//       else if (cellWidth > colWidth)
//         colWidth = cellWidth;
//     }
//     return colWidth;
//   };
//
//   // Increase column with if the table is too narrow.
//   let [tableWidth, headerWidth] = [0,0];
//   for (var colIndex = 0 ; colIndex < cols ; colIndex++) {
//     const colWidth = columnWidth({index: colIndex});
//     tableWidth += colWidth;
//     if (colIndex < headerCols)
//       headerWidth += colWidth;
//     else if (tableWidth >= width)
//       break;
//   }
//   if (tableWidth < width) {
//     const widthArray = Array.from({length: cols}, (_, colIndex) => (
//       columnWidth({index: colIndex}) + (width - tableWidth) / cols
//     ));
//     columnWidth = ({index}) => widthArray[index];
//   }
//
//   return {columnWidth, headerWidth};
// }
//
//
// /**
//  * Returns true if this number is a float.
//  */
// function isFloat(n){
//     return Number(n) === n && n % 1 !== 0;
// }

export default Table;
