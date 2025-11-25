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
  ArrowNamedDataSet,
  ArrowVegaLiteChart as ArrowVegaLiteChartProto,
  IArrow,
} from "@streamlit/protobuf"

import {
  DataFrameCellType,
  getTimezone,
  isDatetimeType,
  isDateType,
  isNumericType,
} from "~lib/dataframes/arrowTypeUtils"
import {
  createQuiverFromProto,
  createQuiverOrNull,
  mergeQuiverData,
} from "~lib/dataframes/dataframeUtils"
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

  /** Raw Arrow data for ReadOnlyGrid (avoids accessing Quiver internals). */
  rawData?: IArrow | null

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

  /** Raw Arrow data for ReadOnlyGrid (avoids accessing Quiver internals). */
  rawData?: IArrow | null | undefined
}

interface BuildVegaLiteChartElementArgs {
  proto: ArrowVegaLiteChartProto
  addedRowsList?: ArrowNamedDataSet[]
}

function hasDatasetData(
  dataset: ArrowVegaLiteChartProto["datasets"][number]
): dataset is ArrowVegaLiteChartProto["datasets"][number] & { data: IArrow } {
  return !isNullOrUndefined(dataset.data)
}

function getNamedDataset(
  datasets: WrappedNamedDataset[],
  name: string | null
): WrappedNamedDataset | undefined {
  if (datasets.length === 1) {
    return datasets[0]
  }

  return datasets.find(dataset => dataset.hasName && dataset.name === name)
}

/**
 * Build a VegaLiteChartElement from the raw proto and optional addRows data.
 *
 * This mirrors the historical ElementNode.vegaLiteChartAddRowsHelper behavior:
 * - If there is exactly one dataset, new rows are merged into that dataset.
 * - Otherwise, if a dataset exists with a matching name, new rows are merged into it.
 * - Otherwise, if inline data exists, new rows are merged into that data.
 * - Otherwise, the new rows are used as the sole data source.
 *
 * Multiple add_rows calls are applied sequentially in the order they were received.
 */
export function buildVegaLiteChartElement({
  proto,
  addedRowsList,
}: BuildVegaLiteChartElementArgs): VegaLiteChartElement {
  let baseData = createQuiverOrNull(proto.data ?? null)
  let rawData: IArrow | null = proto.data ?? null

  const baseDatasets: WrappedNamedDataset[] =
    proto.datasets && proto.datasets.length > 0
      ? proto.datasets.filter(hasDatasetData).map(dataset => ({
          hasName: dataset.hasName ?? false,
          name: dataset.name ?? "",
          data: createQuiverFromProto(dataset.data),
          rawData: dataset.data ?? undefined,
        }))
      : []

  // Apply all added rows sequentially
  if (addedRowsList) {
    for (const addRowsData of addedRowsList) {
      if (!addRowsData?.data) {
        continue
      }

      const newDataSetName = addRowsData.hasName
        ? (addRowsData.name ?? null)
        : null

      const existingDataset = getNamedDataset(baseDatasets, newDataSetName)

      if (existingDataset) {
        // Merge into existing dataset
        existingDataset.data = mergeQuiverData(
          existingDataset.data,
          addRowsData.data
        )
      } else if (baseData) {
        // Merge into inline data
        baseData = mergeQuiverData(baseData, addRowsData.data)
      } else {
        // No datasets matched and there is no base data:
        // treat added rows as the sole data source
        baseData = createQuiverFromProto(addRowsData.data)
        rawData = addRowsData.data ?? rawData
      }
    }
  }

  return {
    data: baseData,
    rawData,
    spec: proto.spec ?? "",
    datasets: baseDatasets,
    useContainerWidth: proto.useContainerWidth ?? false,
    vegaLiteTheme: proto.theme ?? "streamlitTheme",
    id: proto.id ?? "",
    selectionMode: proto.selectionMode ?? [],
    formId: proto.formId ?? "",
  }
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
