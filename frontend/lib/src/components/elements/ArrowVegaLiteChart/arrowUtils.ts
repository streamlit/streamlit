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

import {
  DataFrameCellType,
  getTimezone,
  isDatetimeType,
  isDateType,
  isNumericType,
} from "~lib/dataframes/arrowTypeUtils"
import { Quiver } from "~lib/dataframes/Quiver"
import { isNullOrUndefined } from "~lib/util/utils"

const MagicFields = {
  DATAFRAME_INDEX: "(index)",
}

/** All of the data that makes up a VegaLite chart. */
export interface VegaLiteChartElement {
  /**
   * The dataframe that will be used as the chart's main data source, if
   * specified using Vega-Lite's inline API.
   *
   * This is mutually exclusive with WrappedNamedDataset - if `data` is non-null,
   * `datasets` will not be populated; if `datasets` is populated, then `data`
   * will be null.
   */
  data: Quiver | null

  /** The a JSON-formatted string with the Vega-Lite spec. */
  spec: string

  /**
   * Dataframes associated with this chart using Vega-Lite's datasets API,
   * if any.
   */
  datasets: WrappedNamedDataset[]

  /** If True, will overwrite the chart width spec to fit to container. */
  useContainerWidth: boolean

  /** override the properties with a theme. Currently, only "streamlit" or None are accepted. */
  vegaLiteTheme: string

  /** The widget ID. Only set if selections are activated. */
  id: string

  /** Named selection parameters that are activated to trigger reruns. */
  selectionMode: string[]

  /** The form ID if the chart has activated selections and is used within a form. */
  formId: string
}

/** A mapping of `ArrowNamedDataSet.proto`. */
export interface WrappedNamedDataset {
  /** The dataset's optional name. */
  name: string | null

  /** True if the name field (above) was manually set. */
  hasName: boolean

  /** The data itself, wrapped in a Quiver object. */
  data: Quiver
}

export function getInlineData(
  quiverData: Quiver | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
): { [field: string]: any }[] | null {
  if (!quiverData || quiverData.dimensions.numDataRows === 0) {
    return null
  }

  return getDataArray(quiverData)
}

export function getDataArrays(
  datasets: WrappedNamedDataset[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
): { [dataset: string]: any[] } | null {
  const datasetMapping = getDataSets(datasets)
  if (isNullOrUndefined(datasetMapping)) {
    return null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  const datasetArrays: { [dataset: string]: any[] } = {}

  for (const [name, dataset] of Object.entries(datasetMapping)) {
    datasetArrays[name] = getDataArray(dataset)
  }

  return datasetArrays
}

export function getDataSets(
  datasets: WrappedNamedDataset[]
): { [dataset: string]: Quiver } | null {
  if (datasets?.length === 0) {
    return null
  }

  const datasetMapping: { [dataset: string]: Quiver } = {}

  datasets.forEach((x: WrappedNamedDataset) => {
    if (!x) {
      return
    }
    const name = x.hasName ? x.name : null
    datasetMapping[name as string] = x.data
  })

  return datasetMapping
}

/**
 * Retrieves an array of data from Quiver starting from a specified index.
 * Converts data values to a format compatible with VegaLite visualization.
 *
 * @param {Quiver} quiverData - The Quiver data object to extract data from.
 * @param {number} [startIndex=0] - The starting index for data extraction.
 * @returns {Array.<{ [field: string]: any }>} An array of data objects for visualization.
 */
export function getDataArray(
  quiverData: Quiver,
  startIndex = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
): { [field: string]: any }[] {
  if (quiverData.dimensions.numDataRows === 0) {
    return []
  }

  const dataArr = []
  const { numDataRows, numDataColumns, numIndexColumns } =
    quiverData.dimensions

  // This currently only implemented to work with a single index column.
  // If the dataframe is multi-index, the remaining index columns will be ignored.
  const firstIndexColumnType = quiverData.columnTypes[0] ?? undefined
  const hasSupportedIndex =
    firstIndexColumnType &&
    firstIndexColumnType.type === DataFrameCellType.INDEX &&
    (isNumericType(firstIndexColumnType) ||
      isDatetimeType(firstIndexColumnType) ||
      isDateType(firstIndexColumnType))

  for (let rowIndex = startIndex; rowIndex < numDataRows; rowIndex++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    const row: { [field: string]: any } = {}

    if (hasSupportedIndex) {
      const { content: indexValue } = quiverData.getCell(rowIndex, 0)
      // VegaLite can't handle BigInts, so they have to be converted to Numbers first
      // Converting to numbers here might loses accuracy for numbers larger than the max safe integer.
      row[MagicFields.DATAFRAME_INDEX] =
        typeof indexValue === "bigint" ? Number(indexValue) : indexValue
    }

    for (let colIndex = 0; colIndex < numDataColumns; colIndex++) {
      // The underlying dataframe expects the column position to start at 0 with
      // the index columns first. Therefore, we need to adjust the position
      // to account for the index columns.
      const colPos = colIndex + numIndexColumns
      const { content: dataValue, contentType: dataType } = quiverData.getCell(
        rowIndex,
        colPos
      )

      if (
        (dataValue instanceof Date ||
          (typeof dataValue === "number" && Number.isFinite(dataValue))) &&
        (isDatetimeType(dataType) || isDateType(dataType)) &&
        // Only convert dates without timezone information
        // to utc timezone
        !getTimezone(dataType)
      ) {
        // For dates that do not contain timezone information.
        // Vega JS assumes dates in the local timezone, so we need to convert
        // UTC date to be the same date in the local timezone.
        const offset = new Date(dataValue).getTimezoneOffset() * 60 * 1000 // minutes to milliseconds
        row[quiverData.columnNames[0][colPos]] = dataValue.valueOf() + offset
      } else {
        // VegaLite can't handle BigInts, so they have to be converted to Numbers first.
        // Converting to numbers here might loses accuracy for numbers larger than the max safe integer.
        row[quiverData.columnNames[0][colPos]] =
          typeof dataValue === "bigint" ? Number(dataValue) : dataValue
      }
    }
    dataArr.push(row)
  }

  return dataArr
}
