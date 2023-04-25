/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Utilities to get information out of a proto.DataFrame.
 */

import camelcase from "camelcase"
import { fromJS } from "immutable"
import {
  dispatchOneOf,
  mapOneOf,
  updateOneOf,
} from "src/lib/util/immutableProto"
import { Format } from "src/lib/util/format"

// Must match dict_builder.py
export const INDEX_COLUMN_DESIGNATOR = "(index)"

const STRING_COLLATOR = new Intl.Collator("en", {
  numeric: false,
  sensitivity: "base",
})

function compareValues(a: any, b: any): number {
  if (a < b) {
    return -1
  }
  if (a > b) {
    return 1
  }
  return 0
}

function compareStrings(a: string, b: string): number {
  // using a Collator is faster than string.localeCompare:
  // https://stackoverflow.com/questions/14677060/400x-sorting-speedup-by-switching-a-localecompareb-to-ab-1ab10/52369951#52369951
  return STRING_COLLATOR.compare(a, b)
}

/**
 * Returns the row indices for a DataFrame, sorted based on the values in the given
 * columnIdx. (Note that the columnIdx is 0-based, and so does *not* include the header column;
 * similarly, the sorted row indices will not include the header row.)
 */
export function getSortedDataRowIndices(
  df: any,
  sortColumnIdx: number,
  sortAscending: boolean
): any[] {
  const table = df.get("data")
  const [nRows, nCols] = tableGetRowsAndCols(table)
  if (sortColumnIdx < 0 || sortColumnIdx >= nCols) {
    throw new Error(
      `Bad sortColumnIdx ${sortColumnIdx} (should be >= 0, < ${nCols})`
    )
  }

  const col = table.getIn(["cols", sortColumnIdx])
  const cmp = mapOneOf(col, "type", {
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
export function dataFrameGetDimensions(df: any): any {
  const index = df ? df.get("index") : null
  const data = df ? df.get("data") : null
  const columns = df ? df.get("columns") : null

  const [headerCols, dataRowsCheck] = index
    ? indexGetLevelsAndLength(index)
    : [0, 0]
  const [headerRows, dataColsCheck] = columns
    ? indexGetLevelsAndLength(columns)
    : [0, 0]
  const [dataRows, dataCols] = data
    ? tableGetRowsAndCols(data)
    : // If there is no data, default to the number of header columns
      [0, dataColsCheck]

  if (
    (dataRows !== 0 && dataRows !== dataRowsCheck) ||
    (dataCols !== 0 && dataCols !== dataColsCheck)
  ) {
    throw new Error(
      "Dataframe dimensions don't align: " +
        `rows(${dataRows} != ${dataRowsCheck}) OR ` +
        `cols(${dataCols} != ${dataColsCheck})`
    )
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
export function tableGetRowsAndCols(table: any): number[] {
  if (!table || !table.get("cols")) {
    return [0, 0]
  }

  const cols = table.get("cols").size
  if (cols === 0) {
    return [0, 0]
  }
  const rows = anyArrayLen(table.getIn(["cols", 0]))
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
export function dataFrameToArrayOfDicts(df: any): { [key: string]: any } {
  const dataArr = []
  const [nRows, nCols] = tableGetRowsAndCols(df.get("data"))

  const dfColumns = df.get("columns")
  const dfData = df.get("data")

  for (let r = 0; r < nRows; r++) {
    const rowDict: { [key: string]: any } = {}

    for (let c = 0; c < nCols; c++) {
      rowDict[indexGet(dfColumns, 0, c)] = tableGet(dfData, c, r)
    }

    dataArr.push(rowDict)
  }

  // TODO: Handle indices too.

  return dataArr
}

export type DataFrameCellType = "corner" | "col-header" | "row-header" | "data"
export interface DataFrameCell {
  contents: any
  styles: any
  type: DataFrameCellType
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
export function dataFrameGet(df: any, col: any, row: any): DataFrameCell {
  const { headerRows, headerCols, dataRows } = dataFrameGetDimensions(df)

  if (col < headerCols) {
    if (row < headerRows) {
      return {
        contents: "",
        styles: {},
        type: "corner",
      }
    }
    return {
      contents: indexGet(df.get("index"), col, row - headerRows),
      styles: {},
      type: "col-header",
    }
  }
  if (row < headerRows) {
    let styles = {}

    // Check if the table has data
    if (dataRows > 0) {
      // Align header columns to left when the first
      // data row content is not a number
      const firstDataRowContent = tableGet(
        df.get("data"),
        col - headerCols,
        row
      )
      if (typeof firstDataRowContent !== "number") {
        styles = {
          ...styles,
          textAlign: "left",
        }
      }
    }

    return {
      contents: indexGet(df.get("columns"), row, col - headerCols),
      styles,
      type: "row-header",
    }
  }
  // If we have a formatted display value for the cell, return that.
  // Else return the data itself.
  const customDisplayValue = tableStyleGetDisplayValue(
    df.get("style"),
    col - headerCols,
    row - headerRows
  )

  const contentsRaw = tableGet(
    df.get("data"),
    col - headerCols,
    row - headerRows
  )
  const contents =
    customDisplayValue != null ? customDisplayValue : contentsRaw

  let styles =
    tableStyleGetCSS(df.get("style"), col - headerCols, row - headerRows) || {}

  // align data columns to left when the content is not a number
  if (typeof contentsRaw !== "number") {
    styles = {
      ...styles,
      textAlign: "left",
    }
  }

  return {
    contents,
    styles,
    type: "data",
  }
}

/**
 * Returns the formatted string for the given element in a TableStyle,
 * or undefined if there's no such value.
 */
export function tableStyleGetDisplayValue(
  tableStyle: any,
  columnIndex: any,
  rowIndex: any
): any | undefined {
  if (tableStyle == null) {
    return undefined
  }

  const cellStyle = tableStyle.getIn(
    ["cols", columnIndex, "styles", rowIndex],
    undefined
  )
  if (cellStyle == null) {
    return undefined
  }

  return cellStyle.get("hasDisplayValue")
    ? cellStyle.get("displayValue")
    : undefined
}

/**
 * Returns a CSS style dictionary with keys that are formatted for use in a
 * JSX element's {style} attribute, or undefined if table/cell has no style.
 */
export function tableStyleGetCSS(
  tableStyle: any,
  columnIndex: any,
  rowIndex: any
): any | undefined {
  if (tableStyle == null) {
    return undefined
  }

  const cssStyles = tableStyle.getIn(
    ["cols", columnIndex, "styles", rowIndex, "css"],
    undefined
  )
  if (cssStyles == null) {
    return undefined
  }

  const styles: { [key: string]: any } = {}
  cssStyles.forEach((item: any) => {
    // React style property names are camelCased
    const property = item.get("property")
    styles[camelcase(property)] = item.get("value")
  })

  return styles
}

/**
 * Returns the given element from the table, formatted for display.
 */
export function tableGet(table: any, columnIndex: any, rowIndex: any): any {
  return anyArrayGet(table.getIn(["cols", columnIndex]), rowIndex)
}

/**
 * Returns the raw data of the given element from the table.
 */
export function tableData(table: any, columnIndex: any, rowIndex: any): any {
  return anyArrayData(table.getIn(["cols", columnIndex])).get(rowIndex)
}

/**
 * Returns [levels, length]. The former is the length of the index, while the
 * latter is 1 (or >1 for MultiIndex).
 */
export function indexGetLevelsAndLength(index: any): any {
  return dispatchOneOf(index, "type", {
    plainIndex: (idx: any) => [1, anyArrayLen(idx.get("data"))],
    rangeIndex: (idx: any) => [1, idx.get("stop") - idx.get("start")],
    multiIndex: (idx: any) =>
      idx.get("labels").size === 0
        ? [0, 0]
        : [idx.get("labels").size, idx.getIn(["labels", 0, "data"]).size],
    int_64Index: (idx: any) => [1, idx.getIn(["data", "data"]).size],
    float_64Index: (idx: any) => [1, idx.getIn(["data", "data"]).size],
    datetimeIndex: (idx: any) => [1, idx.getIn(["data", "data"]).size],
    timedeltaIndex: (idx: any) => [1, idx.getIn(["data", "data"]).size],
  })
}

/**
 * Returns the ith index value of the given level.
 */
export function indexGet(index: any, level: any, i: any): any {
  const type = index.get("type")
  if (type !== "multiIndex" && level !== 0) {
    throw new Error(`Attempting to access level ${level} of a ${type}.`)
  }
  return dispatchOneOf(index, "type", {
    plainIndex: (idx: any) => anyArrayGet(idx.get("data"), i),
    rangeIndex: (idx: any) => idx.get("start") + i,
    multiIndex: (idx: any) => {
      const levels = idx.getIn(["levels", level])
      const labels = idx.getIn(["labels", level])
      const label = labels.getIn(["data", i])
      if (label < 0) {
        return "NaN"
      }
      return indexGet(levels, 0, label)
    },
    int_64Index: (idx: any) => idx.getIn(["data", "data", i]),
    float_64Index: (idx: any) => idx.getIn(["data", "data", i]),
    datetimeIndex: (idx: any) =>
      Format.iso8601ToMoment(idx.getIn(["data", "data", i])),
    timedeltaIndex: (idx: any) =>
      Format.nanosToDuration(idx.getIn(["data", "data", i])),
  })
}

/**
 * Returns the numerical index of the column with the specified name within
 * this table. If no such column exists, returns -1.
 */
export function indexGetByName(index: any, name: string): number {
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
function anyArrayLen(anyArray: any): number {
  return anyArrayData(anyArray).size
}

/**
 * Returns the ith element of this AnyArray.
 */
function anyArrayGet(anyArray: any, i: any): any {
  const getData = (obj: any): any => obj.get("data").get(i)
  return dispatchOneOf(anyArray, "type", {
    strings: getData,
    doubles: getData,
    int64s: getData,
    datetimes: (obj: any) => Format.iso8601ToMoment(getData(obj)),
    timedeltas: (obj: any) => Format.nanosToDuration(getData(obj)),
  })
}

/**
 * Returns the data array of an proto.AnyArray.
 */
function anyArrayData(anyArray: any): any {
  const getData = (obj: any): any => obj.get("data")
  return dispatchOneOf(anyArray, "type", {
    strings: getData,
    doubles: getData,
    int64s: getData,
    datetimes: getData,
    timedeltas: getData,
  })
}

/**
 * Concatenates namedDataSet into element, returning a new element.
 */
export function addRows(element: any, namedDataSet: any): any {
  const name = namedDataSet.get("hasName") ? namedDataSet.get("name") : null
  const newRows = namedDataSet.get("data")
  const namedDataSets = getNamedDataSets(element)

  const [existingDatasetIndex, existingDataSet] = getNamedDataSet(
    namedDataSets,
    name
  )
  let dataframeToModify

  // There are 5 cases to consider:
  // 1. add_rows has a named dataset
  //   a) element has a named dataset with that name -> use that one
  //   b) element has no named dataset with that name -> put the new dataset into the element
  // 2. add_rows as an unnamed dataset
  //   a) element has an unnamed dataset -> use that one
  //   b) element has only named datasets -> use the first named dataset
  //   c) element has no dataset -> put the new dataset into the element
  if (namedDataSet.get("hasName")) {
    if (existingDataSet) {
      dataframeToModify = existingDataSet.get("data")
    } else {
      return pushNamedDataSet(element, namedDataSet)
    }
  } else {
    const existingDataFrame = getDataFrame(element)
    if (existingDataFrame) {
      dataframeToModify = existingDataFrame
    } else if (existingDataSet) {
      dataframeToModify = existingDataSet.get("data")
    } else {
      return setDataFrame(element, newRows)
    }
  }

  if (dataframeToModify.get("data") == null) {
    dataframeToModify = dataframeToModify.set("data", fromJS({ cols: [] }))
    dataframeToModify = dataframeToModify.set("style", fromJS({ cols: [] }))
  }

  let newDataFrame

  if (dataframeToModify.get("data").get("cols").isEmpty()) {
    newDataFrame = newRows
  } else {
    newDataFrame = dataframeToModify
      .update("index", (index: any) =>
        concatIndex(index, newRows.get("index"))
      )
      .updateIn(["data", "cols"], (cols: any) => {
        return cols.zipWith(
          (col1: any, col2: any) => concatAnyArray(col1, col2),
          newRows.getIn(["data", "cols"])
        )
      })
      .updateIn(["style", "cols"], (style_cols: any) => {
        return style_cols.zipWith(
          (col1: any, col2: any) => concatCellStyleArray(col1, col2),
          newRows.getIn(["style", "cols"])
        )
      })
  }

  if (existingDataSet) {
    return setDataFrameInNamedDataSet(
      element,
      existingDatasetIndex,
      newDataFrame
    )
  }
  return setDataFrame(element, newDataFrame)
}

/**
 * Concatenates the indices and returns a new index.
 */
function concatIndex(index1: any, index2: any): any {
  // Special case if index1 is empty.
  if (indexLen(index1) === 0) {
    return index2
  }

  // Otherwise, make sure the types match.
  const type1 = index1.get("type")
  const type2 = index2.get("type")
  if (type1 !== type2) {
    throw new Error(`Cannot concatenate ${type1} with ${type2}.`)
  }

  // ...and dispatch based on type.
  return updateOneOf(index1, "type", {
    plainIndex: (idx: any) =>
      idx.update("data", (data: any) =>
        concatAnyArray(data, index2.getIn(["plainIndex", "data"]))
      ),
    rangeIndex: (idx: any) =>
      idx.update("stop", (stop: any) => stop + indexLen(index2)),
    // multiIndex: <not supported>,
    int_64Index: (idx: any) =>
      idx.updateIn(["data", "data"], (data: any) =>
        data.concat(index2.getIn(["int_64Index", "data", "data"]))
      ),
    float_64Index: (idx: any) =>
      idx.updateIn(["data", "data"], (data: any) =>
        data.concat(index2.getIn(["float_64Index", "data", "data"]))
      ),
    datetimeIndex: (idx: any) =>
      idx.updateIn(["data", "data"], (data: any) =>
        data.concat(index2.getIn(["datetimeIndex", "data", "data"]))
      ),
    timedeltaIndex: (idx: any) =>
      idx.updateIn(["data", "data"], (data: any) =>
        data.concat(index2.getIn(["timedeltaIndex", "data", "data"]))
      ),
  })
}

/**
 * Concatenates both anyArrays, returning the result.
 */
function concatAnyArray(anyArray1: any, anyArray2: any): any {
  // Special case if the left array is empty.
  if (anyArrayLen(anyArray1) === 0) {
    return anyArray2
  }

  const type1 = anyArray1.get("type")
  const type2 = anyArray2.get("type")
  if (type1 !== type2) {
    throw new Error(`Cannot concatenate ${type1} and ${type2}.`)
  }

  return anyArray1.updateIn([type1, "data"], (array: any) =>
    array.concat(anyArray2.getIn([type2, "data"]))
  )
}

/**
 * Concatenates both CellStyleArrays, returning the result
 */
function concatCellStyleArray(array1: any, array2: any): any {
  // Special case if the left array is empty.
  if (array1.get("styles").length === 0) {
    return array2
  }
  return array1.update("styles", (styles: any) =>
    styles.concat(array2.get("styles"))
  )
}

/**
 * Extracts the dataframe from an element. The name is only used if it makes
 * sense for the given element.
 */
function getDataFrame(element: any): any {
  return dispatchOneOf(element, "type", {
    chart: (chart: any) => chart.get("data"),
    dataFrame: (df: any) => df,
    table: (df: any) => df,
    arrowTable: (df: any) => df,
    deckGlMap: (el: any) => el.get("data"),
    vegaLiteChart: (chart: any) => chart.get("data"),
  })
}

function getNamedDataSets(element: any): any {
  return dispatchOneOf(element, "type", {
    vegaLiteChart: (chart: any) => chart.get("datasets"),
    _else: () => null,
  })
}

/**
 * If there is only one NamedDataSet, returns [0, NamedDataSet] with the 0th
 * NamedDataSet.
 * Otherwise, returns the [index, NamedDataSet] with the NamedDataSet
 * matching the given name.
 */
function getNamedDataSet(namedDataSets: any, name: any): any {
  if (namedDataSets != null) {
    if (namedDataSets.size === 1) {
      const firstNamedDataSet = namedDataSets.first()
      return [0, firstNamedDataSet]
    }

    const namedDataSetEntry = namedDataSets.findEntry(
      (ds: any) => ds.get("hasName") && ds.get("name") === name
    )

    if (namedDataSetEntry) {
      return namedDataSetEntry
    }
  }

  return [-1, null]
}

/**
 * Sets the dataframe of this element.
 * Returns a new element -- NOT A DATAFRAME!
 */
function setDataFrame(element: any, df: any): any {
  return updateOneOf(element, "type", {
    chart: (chart: any) => chart.set("data", df),
    dataFrame: () => df,
    table: () => df,
    arrowTable: () => df,
    deckGlMap: (el: any) => el.set("data", df),
    vegaLiteChart: (chart: any) => chart.set("data", df),
  })
}

/**
 * Adds a named dataset to this element.
 * Returns a new element -- NOT A DATAFRAME!
 */
function pushNamedDataSet(element: any, namedDataset: any): any {
  return updateOneOf(element, "type", {
    vegaLiteChart: (chart: any) =>
      chart.update("datasets", (datasets: any) => datasets.push(namedDataset)),
  })
}

/**
 * Sets the named dataset of this element.
 * Returns a new element -- NOT A DATAFRAME!
 */
function setDataFrameInNamedDataSet(element: any, index: any, df: any): any {
  return updateOneOf(element, "type", {
    vegaLiteChart: (chart: any) =>
      chart.setIn(["datasets", index, "data"], df),
  })
}

/**
 * Returns the number of elements in an index.
 */
function indexLen(index: any): any {
  return dispatchOneOf(index, "type", {
    plainIndex: (idx: any) => anyArrayLen(idx.get("data")),
    rangeIndex: (idx: any) => idx.get("stop") - idx.get("start"),
    multiIndex: (idx: any) =>
      idx.get("labels").size === 0 ? 0 : idx.getIn(["labels", 0]).size,
    int_64Index: (idx: any) => idx.getIn(["data", "data"]).size,
    float_64Index: (idx: any) => idx.getIn(["data", "data"]).size,
    datetimeIndex: (idx: any) => idx.getIn(["data", "data"]).size,
    timedeltaIndex: (idx: any) => idx.getIn(["data", "data"]).size,
  })
}
