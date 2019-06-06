/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 *
 * @fileoverview Component display a Pandas Dataframe.
 */

import React from 'react'
import { PureStreamlitElement } from 'components/shared/StreamlitElement/'
import { Table as ReactTable }  from 'reactstrap'
import { toFormattedString } from '../../../lib/format'

import {
  dataFrameGet,
  dataFrameGetDimensions,
} from '../../../lib/dataFrameProto'

import './Table.scss'

/**
 * Functional element representing a DataFrame.
 */

class Table extends PureStreamlitElement {
  safeRender() {
    const { element } = this.props
    const { headerRows, rows, cols } = dataFrameGetDimensions(element)

    const hasNoData = rows === headerRows

    // TODO(tvst): Make tables have a max width with overflow: scroll (when
    // media==screen). But need to fix the autosizer first.
    return (
      <div className="streamlit-table stTable">
        <ReactTable className={hasNoData ? 'empty-table' : ''}>
          <thead>
            <TableRows
              df={element}
              header={true}
              headerRows={headerRows}
              rows={rows}
              cols={cols}
            />
          </thead>
          <tbody>
            { hasNoData ?
              <tr>
                <td colSpan={cols || 1}>empty</td>
              </tr>
              :
              <TableRows
                df={element}
                headerRows={headerRows}
                rows={rows}
                cols={cols}
              />
            }
          </tbody>
        </ReactTable>
      </div>
    )
  }
}


/**
 * Purely functional component returning a list of rows.
 *
 * df         - The dataFrame to display.
 * header     - Whether to display the header.
 * headerRows - Number of rows in the header.
 * rows       - Number of rows in the table (header + data).
 * cols       - Number of colums in the table.
 */
function TableRows({df, header, headerRows, rows, cols}) {
  const startRow = header ? 0 : headerRows
  const endRow = header ? headerRows : rows
  const rowArray = []
  for (let rowIdx = startRow; rowIdx < endRow; rowIdx++) {
    rowArray.push(
      <tr key={rowIdx}>
        <TableRow df={df} rowIdx={rowIdx} cols={cols}/>
      </tr>
    )
  }
  return rowArray
}

/**
 * Purely functional component returning a list entries for a row.
 *
 * df     - The dataFrame to display.
 * rowIdx - The row index.
 * cols   - numver of colums in the table.
 */
function TableRow({df, rowIdx, cols}) {
  const entries = []
  for (let colIdx = 0; colIdx < cols; colIdx++) {
    const { contents, styles, type } = dataFrameGet(df, colIdx, rowIdx)
    const formattedContents = toFormattedString(contents)
    if (type === 'corner') {
      entries.push(<th key={colIdx}>&nbsp;</th>)
    } else if (type === 'row-header') {
      entries.push(<th key={colIdx} scope="row">{ formattedContents }</th>)
    } else if (type === 'col-header') {
      entries.push(<th key={colIdx}>{ formattedContents }</th>)
    } else if (type === 'data') {
      entries.push(<td style={styles} key={colIdx}>{ formattedContents }</td>)
    } else {
      throw new Error(`Cannot parse type "${type}".`)
    }
  }
  return entries
}

export default Table
