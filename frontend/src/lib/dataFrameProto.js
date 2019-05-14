/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

/**
 * Utilities to get information out of a protobuf.DataFrame.
 */

import camelcase from 'camelcase'
import { dispatchOneOf, mapOneOf, updateOneOf } from './immutableProto'
import { format } from './format'

export const INDEX_COLUMN_DESIGNATOR = 'index'

const STRING_COLLATOR = new Intl.Collator('en', {
  numeric: false,
  sensitivity: 'base',
})

function compareValues(a, b) {
  if (a < b) {
    return -1
  } else if (a > b) {
    return 1
  }
  return 0
}

function compareStrings(a, b) {
  // using a Collator is faster than string.localeCompare:
  // https://stackoverflow.com/questions/14677060/400x-sorting-speedup-by-switching-a-localecompareb-to-ab-1ab10/52369951#52369951
  return STRING_COLLATOR.compare(a, b)
}

/**
 * Returns the row indices for a DataFrame, sorted based on the values in the given
 * columnIdx. (Note that the columnIdx is 0-based, and so does *not* include the header column;
 * similarly, the sorted row indices will not include the header row.)
 */
export function getSortedDataRowIndices(df, sortColumnIdx, sortAscending) {
  const table = df.get('data')
  const [nRows, nCols] = tableGetRowsAndCols(table)
  if (sortColumnIdx < 0 || sortColumnIdx >= nCols) {
    throw new Error(
      `Bad sortColumnIdx ${sortColumnIdx} (should be >= 0, < ${nCols})`)
  }

  const col = table.getIn(['cols', sortColumnIdx])
  const cmp = mapOneOf(col, 'type', {
    strings: compareStrings,
    doubles: compareValues,
    int64s: compareValues,
    datetimes: compareValues,
    timedeltas: compareValues,
  })

  const indices = new Array(nRows)
  for (let i = 0; i < nRows; i += 1) {
    indices[i] = i
  }
  indices.sort((aRowIdx, bRowIdx) => {
    const aValue = tableData(table, sortColumnIdx, aRowIdx)
    const bValue = tableData(table, sortColumnIdx, bRowIdx)
    return sortAscending ? cmp(aValue, bValue) : cmp(bValue, aValue)
  })

  return indices
}

/**
 * Returns a dictionary of integers:
 *   { headerRows, headerCols, dataRows, dataCols, cols, rows }
 * for this DataFrame, where rows and cols are sums of the header and data
 * components.
 *
 * If df is null, this returns zeroes. If any of index/data/columns are null,
 * this treats them as empty (so their dimensions are [0, 0]).
 */
export function dataFrameGetDimensions(df) {
  const index = df ? df.get('index') : null
  const data = df ? df.get('data') : null
  const columns = df ? df.get('columns') : null

  const [headerCols, dataRowsCheck] = index ?
    indexGetLevelsAndLength(index) : [0, 0]
  const [headerRows, dataColsCheck] = columns ?
    indexGetLevelsAndLength(columns) : [0, 0]
  const [dataRows, dataCols] = data ?
    tableGetRowsAndCols(data) : [0, 0]

  if ((dataRows !== dataRowsCheck) || (dataCols !== dataColsCheck)) {
    throw new Error('Dataframe dimensions don\'t align: ' +
      `rows(${dataRows} != ${dataRowsCheck}) OR ` +
      `cols(${dataCols} != ${dataColsCheck})`)
  }

  const cols = headerCols + dataCols
  const rows = headerRows + dataRows

  return {
    headerRows,
    headerCols,
    dataRows,
    dataCols,
    cols,
    rows,
  }
}

/**
 * Returns [rows, cls] for this table.
 */
export function tableGetRowsAndCols(table) {
  if (!table || !table.get('cols')) {
    return [0, 0]
  }

  const cols = table.get('cols').size
  if (cols === 0) {
    return [0, 0]
  }
  const rows = anyArrayLen(table.getIn(['cols', 0]))
  return [rows, cols]
}

/**
 * Converts dataframe to array-of-dicts format.
 *
 * Example:
 *
 * [
 *   {index1: row1_col1, index2: row1_col2, ...},
 *   {index1: row2_col1, index2: row2_col2, ...},
 * ]
 */
export function dataFrameToArrayOfDicts(df) {
  const dataArr = []
  const [nRows, nCols] = tableGetRowsAndCols(df.get('data'))

  const dfColumns = df.get('columns')
  const dfData = df.get('data')

  for (let r = 0; r < nRows; r++) {
    const rowDict = {}

    for (let c = 0; c < nCols; c++) {
      rowDict[indexGet(dfColumns, 0, c)] = tableGet(dfData, c, r)
    }

    dataArr.push(rowDict)
  }

  // TODO: Handle indices too.

  return dataArr
}

/**
 * Return the (i, j)th element of the DataFrame viewed as a big table including
 * header columns and rows. Returns a dict of
 * {
 *  contents: <the cell contents, nicely formatted as a string>,
 *  styles: {property1: value1, ...} <css styles to apply to the cell>
 *  type: 'corner' | 'row-header' | 'col-header' | 'data'
 * }
 */
export function dataFrameGet(df, col, row) {
  const { headerRows, headerCols } = dataFrameGetDimensions(df)
  if (col < headerCols) {
    if (row < headerRows) {
      return {
        contents: '',
        styles: {},
        type: 'corner',
      }
    } else {
      return {
        contents: indexGet(df.get('index'), col, row - headerRows),
        styles: {},
        type: 'col-header',
      }
    }
  } else {
    if (row < headerRows) {
      return {
        contents: indexGet(df.get('columns'), row, col - headerCols),
        styles: {},
        type: 'row-header',
      }
    } else {
      // If we have a formatted display value for the cell, return that.
      // Else return the data itself.
      const customDisplayValue = tableStyleGetDisplayValue(
        df.get('style'), col - headerCols, row - headerRows)

      const contents = customDisplayValue != null ?
        customDisplayValue :
        tableGet(df.get('data'), col - headerCols, row - headerRows)

      return {
        contents: contents,
        styles: tableStyleGetCSS(
          df.get('style'), col - headerCols, row - headerRows) || {},
        type: 'data',
      }
    }
  }
}

/**
 * Returns the formatted string for the given element in a TableStyle,
 * or undefined if there's no such value.
 */
export function tableStyleGetDisplayValue(tableStyle, columnIndex, rowIndex) {
  if (tableStyle == null) {
    return undefined
  }

  const cellStyle = tableStyle.getIn(
    ['cols', columnIndex, 'styles', rowIndex], undefined)
  if (cellStyle == null) {
    return undefined
  }

  return cellStyle.get('hasDisplayValue') ?
    cellStyle.get('displayValue') : undefined
}

/**
 * Returns a CSS style dictionary with keys that are formatted for use in a
 * JSX element's {style} attribute, or undefined if table/cell has no style.
 */
export function tableStyleGetCSS(tableStyle, columnIndex, rowIndex) {
  if (tableStyle == null) {
    return undefined
  }

  const cssStyles = tableStyle.getIn(
    ['cols', columnIndex, 'styles', rowIndex, 'css'], undefined)
  if (cssStyles == null) {
    return undefined
  }

  const styles = {}
  cssStyles.forEach((item) => {
    // React style property names are camelCased
    const property = item.get('property')
    styles[camelcase(property)] = item.get('value')
  })

  return styles
}

/**
 * Returns the given element from the table, formatted for display.
 */
export function tableGet(table, columnIndex, rowIndex) {
  return anyArrayGet(table.getIn(['cols', columnIndex]), rowIndex)
}

/**
 * Returns the raw data of the given element from the table.
 */
export function tableData(table, columnIndex, rowIndex) {
  return anyArrayData(table.getIn(['cols', columnIndex]))
    .get(rowIndex)
}

/**
 * Returns [levels, length]. The former is the length of the index, while the
 * latter is 1 (or >1 for MultiIndex).
 */
export function indexGetLevelsAndLength(index) {
  return dispatchOneOf(index, 'type', {
    plainIndex: (idx) => [1, anyArrayLen(idx.get('data'))],
    rangeIndex: (idx) => [1, idx.get('stop') - idx.get('start')],
    multiIndex: (idx) => (idx.get('labels').size === 0 ? [0, 0] :
      [idx.get('labels').size, idx.getIn(['labels', 0, 'data']).size]),
    int_64Index: (idx) => [1, idx.getIn(['data', 'data']).size],
    float_64Index: (idx) => [1, idx.getIn(['data', 'data']).size],
    datetimeIndex: (idx) => [1, idx.getIn(['data', 'data']).size],
    timedeltaIndex: (idx) => [1, idx.getIn(['data', 'data']).size],
  })
}

/**
 * Returns the ith index value of the given level.
 */
export function indexGet(index, level, i) {
  const type = index.get('type')
  if ((type !== 'multiIndex') && (level !== 0)) {
    throw new Error(`Attempting to access level ${level} of a ${type}.`)
  }
  return dispatchOneOf(index, 'type', {
    plainIndex: (idx) => anyArrayGet(idx.get('data'), i),
    rangeIndex: (idx) => idx.get('start') + i,
    multiIndex: (idx) => {
      const levels = idx.getIn(['levels', level])
      const labels = idx.getIn(['labels', level])
      const label = labels.getIn(['data', i])
      if (label < 0) {
        return 'NaN'
      } else {
        return indexGet(levels, 0, label)
      }
    },
    int_64Index: (idx) => idx.getIn(['data', 'data', i]),
    float_64Index: (idx) => idx.getIn(['data', 'data', i]),
    datetimeIndex: (idx) => format.nanosToDate(idx.getIn(['data', 'data', i])),
    timedeltaIndex: (idx) => format.nanosToDuration(
      idx.getIn(['data', 'data', i])),
  })
}

/**
 * Returns the numerical index of the column with the specified name within
 * this table. If no such column exists, returns -1.
 */
export function indexGetByName(index, name) {
  const len = indexLen(index)
  for (let i = 0; i < len; i++) {
    if (indexGet(index, 0, i) === name) {
      return i
    }
  }
  return -1
}

/**
 * Returns the length of an AnyArray.
 */
function anyArrayLen(anyArray) {
  return anyArrayData(anyArray).size
}

/**
 * Returns the ith element of this AnyArray.
 */
function anyArrayGet(anyArray, i) {
  const getData = (obj) => obj.get('data')
    .get(i)
  return dispatchOneOf(anyArray, 'type', {
    strings: getData,
    doubles: getData,
    int64s: getData,
    datetimes: obj => format.nanosToDate(getData(obj)),
    timedeltas: obj => format.nanosToDuration(getData(obj)),
  })
}

/**
 * Returns the data array of an protobuf.AnyArray.
 */
function anyArrayData(anyArray) {
  const getData = (obj) => obj.get('data')
  return dispatchOneOf(anyArray, 'type', {
    strings: getData,
    doubles: getData,
    int64s: getData,
    datetimes: getData,
    timedeltas: getData,
  })
}

/**
 * Concatenates delta1 and delta2 together, returning a new element.
 */
export function addRows(element, namedDataSet) {
  const name = namedDataSet.get('hasName') ?
    namedDataSet.get('name') : null
  const newRows = namedDataSet.get('data')

  const existingDataFrame = getDataFrame(element, name)

  if (!existingDataFrame) {
    return setDataFrame(element, newRows, name)
  }

  const newDataFrame = existingDataFrame
    .update('index', index => concatIndex(index, newRows.get('index')))
    .updateIn(['data', 'cols'], (cols) => {
      return cols.zipWith(
        (col1, col2) => concatAnyArray(col1, col2),
        newRows.getIn(['data', 'cols']),
      )
    })
    .updateIn(['style', 'cols'], (style_cols) => {
      return style_cols.zipWith(
        (col1, col2) => concatCellStyleArray(col1, col2),
        newRows.getIn(['style', 'cols']),
      )
    })

  return setDataFrame(element, newDataFrame, name)
}

/**
 * Concatenates the indices and returns a new index.
 */
function concatIndex(index1, index2) {
  // Special case if index1 is empty.
  if (indexLen(index1) === 0) {
    return index2
  }

  // Otherwise, make sure the types match.
  const type1 = index1.get('type')
  const type2 = index2.get('type')
  if (type1 !== type2) {
    throw new Error(`Cannot concatenate ${type1} with ${type2}.`)
  }

  // ...and dispatch based on type.
  return updateOneOf(index1, 'type', {
    plainIndex: (idx) => idx.update('data', (data) => (
      concatAnyArray(data, index2.getIn(['plainIndex', 'data'])))),
    rangeIndex: (idx) => idx.update('stop', (stop) => (
      stop + indexLen(index2))),
    // multiIndex: <not supported>,
    int_64Index: (idx) => idx.updateIn(['data', 'data'], (data) => (
      data.concat(index2.getIn(['int_64Index', 'data', 'data'])))),
    float_64Index: (idx) => idx.updateIn(['data', 'data'], (data) => (
      data.concat(index2.getIn(['float_64Index', 'data', 'data'])))),
    datetimeIndex: (idx) => idx.updateIn(['data', 'data'], (data) => (
      data.concat(index2.getIn(['datetimeIndex', 'data', 'data'])))),
    timedeltaIndex: (idx) => idx.updateIn(['data', 'data'], (data) => (
      data.concat(index2.getIn(['timedeltaIndex', 'data', 'data'])))),
  })
}

/**
 * Concatenates both anyArrays, returning the result.
 */
function concatAnyArray(anyArray1, anyArray2) {
  // Special case if the left array is empty.
  if (anyArrayLen(anyArray1) === 0) {
    return anyArray2
  }

  const type1 = anyArray1.get('type')
  const type2 = anyArray2.get('type')
  if (type1 !== type2) {
    throw new Error(`Cannot concatenate ${type1} and ${type2}.`)
  }

  return anyArray1.updateIn([type1, 'data'], (array) =>
    array.concat(anyArray2.getIn([type2, 'data'])))
}

/**
 * Concatenates both CellStyleArrays, returning the result
 */
function concatCellStyleArray(array1, array2) {
  // Special case if the left array is empty.
  if (array1.get('styles').length === 0) {
    return array2
  }
  return array1.update('styles', styles => styles.concat(array2.get('styles')))
}

/**
 * Extracts the dataframe from an element. The name is only used if it makes
 * sense for the given element.
 */
function getDataFrame(element, name = null) {
  return dispatchOneOf(element, 'type', {
    chart: (chart) => chart.get('data'),
    dataFrame: (df) => df,
    table: (df) => df,
    deckGlMap: (el) => el.get('data'),
    vegaLiteChart: (chart) => getDataFrameByName(chart, name),
  })
}


/**
 * If name is null, gets DataFrame from element.data or element.datasets[0].
 * If name is non-null, gets DataFrame from element.datasets matching the
 * provided name.
 */
function getDataFrameByName(proto, name) {
  if (name == null && proto.get('data') != null) {
    return proto.get('data')
  }

  const namedDataSetEntry = getNamedDataSet(proto.get('datasets'), name)
  return namedDataSetEntry[1].get('data')
}


/**
 * If there is only one NamedDataSet, returns [0, NamedDataSet] with the 0th
 * NamedDataSet.
 * Otherwise, returns the [index, NamedDataSet] with the NamedDataSet
 * matching the given name.
 * If no matches, raises exception.
 */
function getNamedDataSet(namedDataSets, name) {
  if (namedDataSets != null) {
    if (namedDataSets.size === 1) {
      const firstNamedDataSet = namedDataSets.first()
      return [0, firstNamedDataSet]
    }

    const namedDataSetEntry = namedDataSets.findEntry(
      ds => ds.get('hasName') && ds.get('name') === name)

    if (namedDataSetEntry) {
      return namedDataSetEntry
    }
  }

  throw new Error(`Element does not have a dataset named "${name}"`)
}


/**
 * Sets the dataframe of this element.
 * Returns a new element -- NOT A DATAFRAME!
 */
function setDataFrame(element, df, name = null) {
  return updateOneOf(element, 'type', {
    chart: (chart) => chart.set('data', df),
    dataFrame: () => df,
    table: () => df,
    deckGlMap: (el) => el.set('data', df),
    vegaLiteChart: (chart) => setDataFrameByName(chart, df, name),
  })
}

/**
 * If name is null, puts df into proto.data.
 * If name is non-null, puts df into proto.datasets using the provided name.
 * Returns a new subelement -- NOT A DATAFRAME!
 */
function setDataFrameByName(proto, df, name = null) {
  if (name == null) {
    return proto.set('data', df)
  }

  const namedDataSets = proto.get('datasets')

  const namedDataSetEntry = getNamedDataSet(namedDataSets, name)
  const namedDataSet = namedDataSetEntry[1].set('data', df)

  return proto.setIn(['datasets', namedDataSetEntry[0]], namedDataSet)
}

/**
 * Returns the number of elements in an index.
 */
function indexLen(index) {
  return dispatchOneOf(index, 'type', {
    plainIndex: (idx) => (anyArrayLen(idx.get('data'))),
    rangeIndex: (idx) => (idx.get('stop') - idx.get('start')),
    multiIndex: (idx) => (idx.get('labels').size === 0 ?
      0 : idx.getIn(['labels', 0]).size),
    int_64Index: (idx) => (idx.getIn(['data', 'data']).size),
    float_64Index: (idx) => (idx.getIn(['data', 'data']).size),
    datetimeIndex: (idx) => (idx.getIn(['data', 'data']).size),
    timedeltaIndex: (idx) => (idx.getIn(['data', 'data']).size),
  })
}
