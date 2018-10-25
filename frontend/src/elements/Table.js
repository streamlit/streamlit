/**
 * Component display a Pandas Dataframe.
 */

import React, { PureComponent } from 'react';
import { Alert, Table as ReactTable }  from 'reactstrap';
import { toFormattedString } from '../format';

import {
  dataFrameGet,
  dataFrameGetDimensions,
} from '../dataFrameProto';

import './Table.css';

/**
 * Functional element representing a DataFrame.
 */

class Table extends PureComponent {
  render() {
    const { df, width } = this.props;
    const { headerRows, rows, cols } = dataFrameGetDimensions(df);

    const hasNoData = rows === headerRows;

    // TODO(tvst): Make tables have a max width with overflow: scroll (when
    // media==screen). But need to fix the autosizer first.
    try {
      return (
        <div className='streamlit-table'>
          <ReactTable className={ hasNoData ? 'empty-table' : ''}>
            <thead>
              <TableRows df={df} header={true}/>
            </thead>
            <tbody>
              { hasNoData ?
                <tr>
                  <td colSpan={cols || 1}>empty</td>
                </tr>
                : <TableRows df={df} header={false}/>
              }
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
 * df         - The dataFrame to display.
 * header     - Whether to display the header.
 * headerRows - Number of rows in the header.
 * rows       - number of rows in the table (header + data).
 * cols       - numver of colums in the table.
 */
function TableRows({df, header, headerRows, rows, cols}) {
  const startRow = header ? 0 : headerRows;
  const endRow = header ? headerRows : rows;
  const rowArray = [];
  for (let rowIdx = startRow; rowIdx < endRow; rowIdx++) {
    rowArray.push(
      <tr key={rowIdx}>
        <TableRow df={df} rowIdx={rowIdx} cols={cols}/>
      </tr>
    );
  }
  return rowArray;
}

/**
 * Purely functional component returning a list entries for a row.
 *
 * df     - The dataFrame to display.
 * rowIdx - The row index.
 * cols   - numver of colums in the table.
 */
function TableRow({df, rowIdx, cols}) {
  const entries = [];
  for (let colIdx = 0; colIdx < cols; colIdx++) {
    const { contents, type } = dataFrameGet(df, colIdx, rowIdx);
    const formattedContents = toFormattedString(contents);
    if (type === "corner") {
      entries.push(<th key={colIdx}>&nbsp;</th>);
    } else if (type === "row-header") {
      entries.push(<th key={colIdx} scope="row">{ formattedContents }</th>);
    } else if (type === "col-header") {
      entries.push(<th key={colIdx}>{ formattedContents }</th>);
    } else if (type === "data") {
      entries.push(<td key={colIdx}>{ formattedContents }</td>);
    } else {
      throw new Error(`Cannot parse type "${type}".`)
    }
  };
  return entries;
}

export default Table;
