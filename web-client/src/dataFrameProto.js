/**
 * Utilities to get information out of a protobuf.DataFrame.
 */

/**
 * Returns [rows, cols] for this table.
 */
export function tableGetRowsAndCols(table) {
  const cols = table.cols.length;
  if (cols === 0)
    return [0, 0];
  const rows = anyArrayLength(table.cols[0]);
  return [rows, cols];
}

/**
 * Returns the given element from the table.
 */
export function tableGet(table, columnIndex, rowIndex) {
   return anyArrayGet(table.cols[columnIndex], rowIndex);
}

/**
 * Returns [levels, length]. The former is the length of the index, while the
 * latter is 1 (or >1 for MultiIndex).
 */
export function indexGetLevelsAndLength(index) {
  let levels, length;
  if (index.plainIndex) {
    levels = 1;
    length = anyArrayLength(index.plainIndex.data)
  } else if (index.rangeIndex) {
    const {start, stop} = index.rangeIndex;
    levels = 1;
    length = stop - start;
  } else if (index.multiIndex) {
    levels = index.multiIndex.labels.length;
    if (levels === 0)
      return [0, 0];
    length = index.multiIndex.labels[0].data.length;
  } else if (index.int_64Index) {
    levels = 1;
    length = index.int_64Index.data.data.length;
  } else {
    throw new Error(`Index type "${index.type}" not understood.`)
  }
  return [levels, length];
}

/**
 * Returns the ith index value of the given level.
 */
export function indexGet(index, level, i) {
  if (index.plainIndex) {
    if (level !== 0)
      throw new Error(`Attempting to access level ${level} of a plainIndex.`)
    return anyArrayGet(index.plainIndex.data, i)
  } else if (index.rangeIndex) {
    if (level !== 0)
      throw new Error(`Attempting to access level ${level} of a rangeIndex.`)
    return index.rangeIndex.start + i * index.rangeIndex.step;
  } else if (index.multiIndex) {
    const levels = index.multiIndex.levels[level]
    const labels = index.multiIndex.labels[level]
    return indexGet(levels, 0, labels.data[i]);
  } else if (index.int_64Index) {
    if (level !== 0)
      throw new Error(`Attempting to access level ${level} of ${index.type}.`)
    return index.int_64Index.data.data[i]
  } else {
    throw new Error(`Index type "${index.type}" not understood.`)
  }
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
