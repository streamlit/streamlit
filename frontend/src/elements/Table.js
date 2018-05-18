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
    } else {
      throw new Error(`Cannot parse type "${type}".`)
    }
  };
  return entries;
}

export default Table;
