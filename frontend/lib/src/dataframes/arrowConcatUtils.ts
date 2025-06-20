/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
 * Utility functions used to concatenate Arrow tables. This is used by
 * the add row functionality for dataframe, table & charts.
 */

import range from "lodash/range"
import zip from "lodash/zip"

import { Data, IndexData } from "./arrowParseUtils"
import {
  ArrowType,
  getPandasTypeName,
  isRangeIndexType,
  PandasRangeIndex,
} from "./arrowTypeUtils"

/** True if both arrays contain the same data types in the same order.
 *
 * Dataframes to have the same types if all columns that exist in t1
 * also exist in t2 in the same order and with the same type. t2 can be larger
 * than t1 but not the other way around.
 */
function sameDataTypes(t1: ArrowType[], t2: ArrowType[]): boolean {
  // Make sure both datasets have same data types.
  return t1.every(
    (type: ArrowType, index: number) =>
      type.pandasType?.pandas_type === t2[index]?.pandasType?.pandas_type
  )
}

/** True if both arrays contain the same index types in the same order.
 * If the arrays have different lengths, they are never the same
 */
function sameIndexTypes(t1: ArrowType[], t2: ArrowType[]): boolean {
  // Make sure both indexes have same dimensions.
  if (t1.length !== t2.length) {
    return false
  }

  return t1.every(
    (type: ArrowType, index: number) =>
      index < t2.length &&
      getPandasTypeName(type) === getPandasTypeName(t2[index])
  )
}

/** Concatenate the original DataFrame index with the given one. */
function concatIndexes(
  baseIndex: IndexData,
  baseIndexTypes: ArrowType[],
  appendIndex: IndexData,
  appendIndexTypes: ArrowType[]
): IndexData {
  // If one of the `index` arrays is empty, return the other one.
  // Otherwise, they will have different types and an error will be thrown.
  if (appendIndex.length === 0) {
    return baseIndex
  }
  if (baseIndex.length === 0) {
    return appendIndex
  }

  // Make sure indexes have same types.
  if (!sameIndexTypes(baseIndexTypes, appendIndexTypes)) {
    const receivedIndexTypes = appendIndexTypes.map(index =>
      getPandasTypeName(index)
    )
    const expectedIndexTypes = baseIndexTypes.map(index =>
      getPandasTypeName(index)
    )

    throw new Error(`
Unsupported operation. The data passed into \`add_rows()\` must have the same
index signature as the original data.

In this case, \`add_rows()\` received \`${JSON.stringify(receivedIndexTypes)}\`
but was expecting \`${JSON.stringify(expectedIndexTypes)}\`.
`)
  }

  if (baseIndexTypes.length === 0) {
    // This should never happen!
    throw new Error("There was an error while parsing index types.")
  }

  // NOTE: "range" index cannot be a part of a multi-index, i.e.
  // if the index type is "range", there will only be one element in the index array.
  if (isRangeIndexType(baseIndexTypes[0])) {
    // Continue the sequence for a "range" index.
    // NOTE: The metadata of the original index will be used, i.e.
    // if both indexes are of type "range" and they have different
    // metadata (start, step, stop) values, the metadata of the given
    // index will be ignored.
    const { step, stop } = baseIndexTypes[0].pandasType
      ?.metadata as PandasRangeIndex
    appendIndex = [
      range(
        stop,
        // End is not inclusive
        stop + appendIndex[0].length * step,
        step
      ),
    ]
  }

  // Concatenate each index with its counterpart in the other table
  const zipped = zip(baseIndex, appendIndex)
  // @ts-expect-error We know the two indexes are of the same size
  return zipped.map(a => a[0].concat(a[1]))
}

/** Concatenate the original DataFrame data with the given one. */
function concatData(
  baseData: Data,
  baseDataType: ArrowType[],
  appendData: Data,
  appendDataType: ArrowType[]
): Data {
  // If one of the `data` arrays is empty, return the other one.
  // Otherwise, they will have different types and an error will be thrown.
  if (appendData.numCols === 0) {
    return baseData
  }
  if (baseData.numCols === 0) {
    return appendData
  }

  // Make sure `data` arrays have the same types.
  if (!sameDataTypes(baseDataType, appendDataType)) {
    const receivedDataTypes = appendDataType.map(
      t => t.pandasType?.pandas_type
    )
    const expectedDataTypes = baseDataType.map(t => t.pandasType?.pandas_type)

    throw new Error(`
Unsupported operation. The data passed into \`add_rows()\` must have the same
data signature as the original data.

In this case, \`add_rows()\` received \`${JSON.stringify(receivedDataTypes)}\`
but was expecting \`${JSON.stringify(expectedDataTypes)}\`.
`)
  }

  // Remove extra columns from the "append" DataFrame.
  // Columns from appendData are used by index without checking column names.
  const slicedAppendData = appendData.selectAt(range(0, baseData.numCols))
  return baseData.concat(slicedAppendData)
}

/** Concatenate index and data types. */
function concatTypes(
  baseIndexTypes: ArrowType[],
  baseDataTypes: ArrowType[],
  appendIndexTypes: ArrowType[],
  appendDataTypes: ArrowType[]
): { indexTypes: ArrowType[]; dataTypes: ArrowType[] } {
  const indexTypes = concatIndexTypes(baseIndexTypes, appendIndexTypes)
  const dataTypes = concatDataTypes(baseDataTypes, appendDataTypes)
  return { indexTypes, dataTypes }
}

/** Concatenate index types. */
function concatIndexTypes(
  baseIndexTypes: ArrowType[],
  appendIndexTypes: ArrowType[]
): ArrowType[] {
  // If one of the `types` arrays is empty, return the other one.
  // Otherwise, an empty array will be returned.
  if (appendIndexTypes.length === 0) {
    return baseIndexTypes
  }
  if (baseIndexTypes.length === 0) {
    return appendIndexTypes
  }

  // Make sure indexes have same types.
  if (!sameIndexTypes(baseIndexTypes, appendIndexTypes)) {
    const receivedIndexTypes = appendIndexTypes.map(index =>
      getPandasTypeName(index)
    )
    const expectedIndexTypes = baseIndexTypes.map(index =>
      getPandasTypeName(index)
    )

    throw new Error(`
Unsupported operation. The data passed into \`add_rows()\` must have the same
index signature as the original data.

In this case, \`add_rows()\` received \`${JSON.stringify(receivedIndexTypes)}\`
but was expecting \`${JSON.stringify(expectedIndexTypes)}\`.
`)
  }

  // TL;DR This sets the new stop value.
  return baseIndexTypes.map(indexType => {
    // NOTE: "range" index cannot be a part of a multi-index, i.e.
    // if the index type is "range", there will only be one element in the index array.
    if (isRangeIndexType(indexType) && indexType.pandasType) {
      const { stop, step } = indexType.pandasType.metadata as PandasRangeIndex
      const {
        start: appendStart,
        stop: appendStop,
        step: appendStep,
      } = appendIndexTypes[0].pandasType?.metadata as PandasRangeIndex
      const appendRangeIndexLength = (appendStop - appendStart) / appendStep
      const newStop = stop + appendRangeIndexLength * step
      return {
        ...indexType,
        pandasType: {
          ...indexType.pandasType,
          metadata: {
            ...indexType.pandasType.metadata,
            stop: newStop,
          },
        },
      }
    }
    return indexType
  })
}

/** Concatenate types of data columns. */
function concatDataTypes(
  baseDataTypes: ArrowType[],
  appendDataTypes: ArrowType[]
): ArrowType[] {
  if (baseDataTypes.length === 0) {
    return appendDataTypes
  }

  return baseDataTypes
}

/** Concatenate the index, data, and types of parsed arrow tables. */
export function concat(
  baseDataTypes: ArrowType[],
  baseIndexTypes: ArrowType[],
  baseIndex: IndexData,
  baseData: Data,
  appendDataTypes: ArrowType[],
  appendIndexTypes: ArrowType[],
  appendIndex: IndexData,
  appendData: Data
): {
  index: IndexData
  data: Data
  indexTypes: ArrowType[]
  dataTypes: ArrowType[]
} {
  // Concatenate all data into temporary variables. If any of
  // these operations fail, an error will be thrown and we'll prematurely
  // exit the function.
  const index = concatIndexes(
    baseIndex,
    baseIndexTypes,
    appendIndex,
    appendIndexTypes
  )
  const data = concatData(baseData, baseDataTypes, appendData, appendDataTypes)
  const { indexTypes, dataTypes } = concatTypes(
    baseIndexTypes,
    baseDataTypes,
    appendIndexTypes,
    appendDataTypes
  )

  return { index, data, indexTypes, dataTypes }
}
