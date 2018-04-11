/**
 * Utilities to get information out of a protobuf.DataFrame.
 */

import { dispatchOneOf, updateOneOf } from './immutableProto';
import { format } from './format';

/**
 * Returns [rows, cls] for this table.
 */
export function tableGetRowsAndCols(table) {
  const cols = table.get('cols').size;
  if (cols === 0)
    return [0, 0];
  const rows = anyArrayLen(table.getIn(['cols', 0]));
  return [rows, cols];
}

/**
 * Returns the given element from the table.
 */
export function tableGet(table, columnIndex, rowIndex) {
   return anyArrayGet(table.getIn(['cols', columnIndex]), rowIndex);
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
  });
}

/**
 * Returns the ith index value of the given level.
 */
export function indexGet(index, level, i) {
  const type = index.get('type');
  if ((type !== 'multiIndex') && (level !== 0))
    throw new Error(`Attempting to access level ${level} of a ${type}.`);
  return dispatchOneOf(index, 'type', {
    plainIndex: (idx) => anyArrayGet(idx.get('data'), i),
    rangeIndex: (idx) => idx.get('start') + i,
    multiIndex: (idx) => {
      const levels = idx.getIn(['levels', level]);
      const labels = idx.getIn(['labels', level]);
      return indexGet(levels, 0, labels.getIn(['data', i]));
    },
    int_64Index: (idx) => idx.getIn(['data', 'data', i]),
    float_64Index: (idx) => idx.getIn(['data', 'data', i]),
    datetimeIndex: (idx) => format.nanosToDate(idx.getIn(['data', 'data', i])),
    timedeltaIndex: (idx) => format.nanosToDuration(idx.getIn(['data', 'data', i])),
  });
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
  const getData = (obj) => obj.get('data').get(i)
  return dispatchOneOf(anyArray, 'type', {
    strings: getData,
    doubles: getData,
    int64s: getData,
    datetimes: obj => format.nanosToDate(getData(obj)),
    timedeltas: obj => format.nanosToDuration(getData(obj)),
  });
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
  });
}

/**
 * Concatenates delta1 and delta2 together, returning a new Delta.
 */
export function addRows(element, newRows) {
  const newDataFrame = getDataFrame(element)
    .update('index', (index) => (
      concatIndex(index, newRows.get('index'))))
    .updateIn(['data', 'cols'], (cols) => (
        cols.zipWith((col1, col2) => concatAnyArray(col1, col2),
          newRows.getIn(['data', 'cols']))
      ));
  return setDataFrame(element, newDataFrame);
}

/**
 * Concatenates the indices and returns a new index.
 */
function concatIndex(index1, index2) {
  // Special case if index1 is empty.
  if (indexLen(index1) === 0)
      return index2;

  // Otherwise, make sure the types match.
  const type1 = index1.get('type');
  const type2 = index2.get('type');
  if (type1 !== type2)
    throw new Error(`Cannot concatenate ${type1} with ${type2}.`)

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
  });
}

/**
 * Concatenates both anyArrays, returning the result.
 */
function concatAnyArray(anyArray1, anyArray2) {
  // Special case if the left array is empty.
  if (anyArrayLen(anyArray1) === 0)
    return anyArray2;

  const type1 = anyArray1.get('type');
  const type2 = anyArray2.get('type');
  if (type1 !== type2)
    throw new Error(`Cannot concatenate ${type1} and ${type2}.`)

  return anyArray1.updateIn([type1, 'data'], (array) =>
    array.concat(anyArray2.getIn([type2, 'data'])));
}

/**
 * Extracts the dataframe from an element.
 */
function getDataFrame(element) {
  return dispatchOneOf(element, 'type', {
    dataFrame: (df) => df,
    chart: (chart) => chart.get('data'),
  });
}

/**
 * Sets the dataframe of this element. Returning a new element.
 */
function setDataFrame(element, df) {
  return updateOneOf(element, 'type', {
    dataFrame: () => df,
    chart: (chart) => chart.set('data', df),
  });
}

/**
 * Returns the number of elements in an index.
 */
function indexLen(index) {
  return dispatchOneOf(index, 'type', {
    plainIndex:  (idx) => ( anyArrayLen(idx.get('data')) ),
    rangeIndex:  (idx) => ( idx.get('stop') - idx.get('start') ),
    multiIndex:  (idx) => ( idx.get('labels').size === 0 ? 0 :
                            idx.getIn(['labels', 0]).size ),
    int_64Index: (idx) => ( idx.getIn(['data', 'data']).size ),
    float_64Index: (idx) => ( idx.getIn(['data', 'data']).size ),
    datetimeIndex: (idx) => ( idx.getIn(['data', 'data']).size ),
    timedeltaIndex: (idx) => ( idx.getIn(['data', 'data']).size ),
  });
}
