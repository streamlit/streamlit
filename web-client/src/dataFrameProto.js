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
