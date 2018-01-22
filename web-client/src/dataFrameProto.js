/**
 * Utilities to get information out of a protobuf.DataFrame.
 */

 import { dispatchOneOf, updateOneOf } from './immutableProto';

/**
 * Returns [rows, cols] for this table.
 */
export function tableGetRowsAndCols(table) {
  const cols = table.get('cols').size;
  if (cols === 0)
    return [0, 0];
  const rows = anyArrayLength(table.getIn(['cols', 0]));
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
    plainIndex: (idx) => [1, anyArrayLength(idx.get('data'))],
    rangeIndex: (idx) => [1, idx.get('stop') - idx.get('start')],
    multiIndex: (idx) => (idx.get('labels').size === 0 ? [0, 0] :
      [idx.get('labels').size, idx.getIn(['labels', 0, 'data']).size]),
    int_64Index: (idx) => [1, idx.getIn(['data', 'data']).size],
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
  });
}

/**
 * Returns the length of an AnyArray.
 */
function anyArrayLength(anyArray) {
  return anyArrayData(anyArray).size
}

/**
 * Returns the ith element of this AnyArray.
 */
function anyArrayGet(anyArray, i) {
  return anyArrayData(anyArray).get(i);
}

/**
 * Returns the data array of an protobuf.AnyArray.
 */
function anyArrayData(anyArray) {
  const getData = (obj) => obj.get('data')
  return dispatchOneOf(anyArray, 'type', {
    strings: getData,
    doubles: getData,
    int32s: getData
  });
}

/**
 * Concatenates delta1 and delta2 together, returning a new Delta.
 */
export function addRows(element, newRows) {
  return getDataFrame(element)
    .update('index', (index) => concatIndex(index, newRows.get('index')));
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
    int_64Index: (idx) => {
      throw new Error('Need to implement concatIndex for int_64Index');
    }
  });
}

/**
 * Concatenates both anyArrays, returning the result.
 */
function concatAnyArray(anyArray1, anyArray2) {
  throw new Error('Need to implement.');
}
    // """Merges elements from any_array_2 into any_array_1."""
    // type1 = any_array_1.WhichOneof('type')
    // type2 = any_array_2.WhichOneof('type')
    // assert type1 == type2, f'Cannot concatenate {type1} with {type2}.'
    // getattr(any_array_1, type1).data.extend(getattr(any_array_2, type2).data)

/**
 * Extracts the dataframe from an element.
 */
function getDataFrame(element) {
  return element.get('dataFrame')

  // type = delta.WhichOneof('type')
  // if type == 'new_element':
  //     return delta.new_element.data_frame
  // elif type == 'add_rows':
  //     return delta.add_rows
  // else:
  //     raise RuntimeError(f'Cannot extract DataFrame from {type}.')
}

/**
 * Returns the number of elements in an index.
 */
function indexLen(index) {
  // return dispatchOneOf(index, 'type', {
  //   plainIndex:  (idx) => ( anyArrayLen(idx.get('data')) ),
  //   rangeIndex:  (idx) => ( idx.get('stop') - idx.get('start') ),
  //   multiIndex:  (idx) => ( idx.get('labels').size === 0 ? 0 :
  //                           idx.getIn(['labels', 0]).size ),
  //   int_64Index: (idx) => ( idx.getIn(['data', 'data']).size ),
  // });
  throw new Error('Must implement.')
}

/**
 * Returns the length of an anyArray
 */
function anyArrayLen(anyArray) {
  return anyArray.getIn([anyArray.get('type'), 'data']).size;
}

// prediction: this will become line 165
