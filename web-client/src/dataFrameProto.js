/**
 * Utilities to get information out of a protobuf.DataFrame.
 */

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
  let levels, length;
  if (index.get('plainIndex')) {
    levels = 1;
    length = anyArrayLength(index.getIn(['plainIndex', 'data']))
  } else if (index.get('rangeIndex')) {
    const {start, stop} = index.get('rangeIndex').toJS();
    levels = 1;
    length = stop - start;
  } else if (index.get('multiIndex')) {
    levels = index.getIn(['multiIndex', 'labels']).size;
    if (levels === 0)
      return [0, 0];
    length = index.getIn(['multiIndex', 'labels', 0, 'data']).size;
  } else if (index.get('int_64Index')) {
    levels = 1;
    length = index.getIn(['int_64Index', 'data', 'data']).size;
  } else {
    throw new Error(`Index type "${index.get('type')}" not understood.`)
  }
  return [levels, length];
}

/**
 * Returns the ith index value of the given level.
 */
export function indexGet(index, level, i) {
  if (index.get('plainIndex')) {
    if (level !== 0)
      throw new Error(`Attempting to access level ${level} of a plainIndex.`);
    return anyArrayGet(index.getIn(['plainIndex', 'data']), i);
  } else if (index.get('rangeIndex')) {
    if (level !== 0)
      throw new Error(`Attempting to access level ${level} of a rangeIndex.`)
    return index.getIn(['rangeIndex', 'start']) + i;
  } else if (index.get('multiIndex')) {
    const levels = index.getIn(['multiIndex', 'levels', level]);
    const labels = index.getIn(['multiIndex', 'labels', level]);
    return indexGet(levels, 0, labels.getIn(['data', i]));
  } else if (index.get('int_64Index')) {
    if (level !== 0)
      throw new Error(`Attempting to access level ${level} of ${index.get('type')}.`)
    return index.getIn(['int_64Index', 'data', 'data', i])
  } else {
    throw new Error(`Index type "${index.get('type')}" not understood.`)
  }
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
  return (
    anyArray.get('strings') ||
    anyArray.get('doubles') ||
    anyArray.get('int32s')
  ).get('data')
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

  // Otherwise, dispatch based on type.
  const type1 = index1.get('type');
  const type2 = index2.get('type');
  if (type1 !== type2)
    throw new Error(`Cannot concatenate ${type1} with ${type2}.`)
  if (type1 === 'plainIndex') {
    return index1.updateIn(['plainIndex', 'data'], (data) => (
      concatAnyArray(data, index2.getIn(['plainIndex', 'data']))));
  } else if (type1 === 'rangeIndex') {
    return index1.updateIn(['rangeIndex', 'stop'], (stop) => (
      stop + indexLen(index2)));
  } else if (type1 === 'multiIndex') {
    throw new Error('Cannot yet concatenate multiIndices.')
  } else if (type1 === 'int_64_index') {
    throw new Error('I need to implement this.')
    // index1.int_64_index.data.data.extend(index2.int_64_index.data.data)
  } else {
    throw new Error(`Cannot concatenate "${type1}" indices.`);
  }
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
