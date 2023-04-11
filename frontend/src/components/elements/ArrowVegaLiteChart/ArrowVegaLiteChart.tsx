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

import React, { PureComponent } from "react"
import { withTheme } from "@emotion/react"
import embed from "vega-embed"
import * as vega from "vega"
import { expressionInterpreter } from "vega-interpreter"

import { logMessage } from "src/lib/log"
import withFullScreenWrapper from "src/hocs/withFullScreenWrapper"
import { ensureError } from "src/lib/ErrorHandling"
import { IndexTypeName, Quiver } from "src/lib/Quiver"
import { Theme } from "src/theme"

import { applyStreamlitTheme, applyThemeDefaults } from "./CustomTheme"
import { StyledVegaLiteChartContainer } from "./styled-components"

const MagicFields = {
  DATAFRAME_INDEX: "(index)",
}

const DEFAULT_DATA_NAME = "source"

/**
 * Fix bug where Vega Lite was vertically-cropping the x-axis in some cases.
 * For example, in e2e/scripts/add_rows.py
 */
const BOTTOM_PADDING = 20

/** Types of dataframe-indices that are supported as x axis. */
const SUPPORTED_INDEX_TYPES = new Set([
  IndexTypeName.DatetimeIndex,
  IndexTypeName.Float64Index,
  IndexTypeName.Int64Index,
  IndexTypeName.RangeIndex,
  IndexTypeName.UInt64Index,
])

interface Props {
  element: VegaLiteChartElement
  theme: Theme
  width: number
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

export interface PropsWithHeight extends Props {
  height?: number
}

interface State {
  error?: Error
}

export class ArrowVegaLiteChart extends PureComponent<PropsWithHeight, State> {
  /**
   * The Vega view object
   */
  private vegaView?: vega.View

  /**
   * Finalizer for the embedded vega object. Must be called to dispose
   * of the vegaView when it's no longer used.
   */
  private vegaFinalizer?: () => void

  /**
   * The default data name to add to.
   */
  private defaultDataName = DEFAULT_DATA_NAME

  /**
   * The html element we attach the Vega view to.
   */
  private element: HTMLDivElement | null = null

  readonly state = {
    error: undefined,
  }

  public async componentDidMount(): Promise<void> {
    try {
      await this.createView()
    } catch (e) {
      const error = ensureError(e)
      this.setState({ error })
    }
  }

  public componentWillUnmount(): void {
    this.finalizeView()
  }

  /**
   * Finalize the view so it can be garbage collected. This should be done
   * when a new view is created, and when the component unmounts.
   */
  private finalizeView = (): any => {
    if (this.vegaFinalizer) {
      this.vegaFinalizer()
    }
    this.vegaFinalizer = undefined
    this.vegaView = undefined
  }

  public async componentDidUpdate(prevProps: PropsWithHeight): Promise<void> {
    const { element: prevElement, theme: prevTheme } = prevProps
    const { element, theme } = this.props

    const prevSpec = prevElement.spec
    const { spec } = element

    if (
      !this.vegaView ||
      prevSpec !== spec ||
      prevTheme !== theme ||
      prevProps.width !== this.props.width ||
      prevProps.height !== this.props.height ||
      prevProps.element.vegaLiteTheme !== this.props.element.vegaLiteTheme
    ) {
      logMessage("Vega spec changed.")
      try {
        await this.createView()
      } catch (e) {
        const error = ensureError(e)

        this.setState({ error })
      }
      return
    }

    const prevData = prevElement.data
    const { data } = element

    if (prevData || data) {
      this.updateData(this.defaultDataName, prevData, data)
    }

    const prevDataSets = getDataSets(prevElement) || {}
    const dataSets = getDataSets(element) || {}

    for (const [name, dataset] of Object.entries(dataSets)) {
      const datasetName = name || this.defaultDataName
      const prevDataset = prevDataSets[datasetName]

      this.updateData(datasetName, prevDataset, dataset)
    }

    // Remove all datasets that are in the previous but not the current datasets.
    for (const name of Object.keys(prevDataSets)) {
      if (!dataSets.hasOwnProperty(name) && name !== this.defaultDataName) {
        this.updateData(name, null, null)
      }
    }

    this.vegaView.resize().runAsync()
  }

  public generateSpec = (): any => {
    const { element: el, theme } = this.props
    const spec = JSON.parse(el.spec)
    const { useContainerWidth } = el
    if (el.vegaLiteTheme === "streamlit") {
      spec.config = applyStreamlitTheme(spec.config, theme)
    } else if (spec.usermeta?.embedOptions?.theme === "streamlit") {
      spec.config = applyStreamlitTheme(spec.config, theme)
      // Remove the theme from the usermeta so it doesn't get picked up by vega embed.
      spec.usermeta.embedOptions.theme = undefined
    } else {
      // Apply minor theming improvements to work better with Streamlit
      spec.config = applyThemeDefaults(spec.config, theme)
    }

    if (this.props.height) {
      // fullscreen
      spec.width = this.props.width
      spec.height = this.props.height
    } else if (useContainerWidth) {
      spec.width = this.props.width
    }

    if (!spec.padding) {
      spec.padding = {}
    }

    if (spec.padding.bottom == null) {
      spec.padding.bottom = BOTTOM_PADDING
    }

    if (spec.datasets) {
      throw new Error("Datasets should not be passed as part of the spec")
    }

    return spec
  }

  /**
   * Update the dataset in the Vega view. This method tried to minimize changes
   * by automatically creating and applying diffs.
   *
   * @param name The name of the dataset.
   * @param prevData The dataset before the update.
   * @param data The dataset at the current state.
   */
  private updateData(
    name: string,
    prevData: Quiver | null,
    data: Quiver | null
  ): void {
    if (!this.vegaView) {
      throw new Error("Chart has not been drawn yet")
    }

    if (!data || data.data.numRows === 0) {
      const view = this.vegaView as any
      // eslint-disable-next-line no-underscore-dangle
      const viewHasDataWithName = view._runtime.data.hasOwnProperty(name)
      if (viewHasDataWithName) {
        this.vegaView.remove(name, vega.truthy)
      }
      return
    }

    if (!prevData || prevData.data.numRows === 0) {
      this.vegaView.insert(name, getDataArray(data))
      return
    }

    const { dataRows: prevNumRows, dataColumns: prevNumCols } =
      prevData.dimensions
    const { dataRows: numRows, dataColumns: numCols } = data.dimensions

    // Check if dataframes have same "shape" but the new one has more rows.
    if (
      dataIsAnAppendOfPrev(
        prevData,
        prevNumRows,
        prevNumCols,
        data,
        numRows,
        numCols
      )
    ) {
      if (prevNumRows < numRows) {
        this.vegaView.insert(name, getDataArray(data, prevNumRows))
      }
    } else {
      // Clean the dataset and insert from scratch.
      const cs = vega
        .changeset()
        .remove(vega.truthy)
        .insert(getDataArray(data))
      this.vegaView.change(name, cs)
      logMessage(
        `Had to clear the ${name} dataset before inserting data through Vega view.`
      )
    }
  }

  /**
   * Create a new Vega view and add the data.
   */
  private async createView(): Promise<void> {
    logMessage("Creating a new Vega view.")

    if (!this.element) {
      throw Error("Element missing.")
    }

    // Finalize the previous view so it can be garbage collected.
    this.finalizeView()

    const el = this.props.element
    const spec = this.generateSpec()
    const options = {
      defaultStyle: true,
      // Adds interpreter support for Vega expressions that is compliant with CSP
      ast: true,
      expr: expressionInterpreter,
    }

    const { vgSpec, view, finalize } = await embed(this.element, spec, options)

    this.vegaView = view
    this.vegaFinalizer = finalize

    const datasets = getDataArrays(el)

    // Heuristic to determine the default dataset name.
    const datasetNames = datasets ? Object.keys(datasets) : []
    if (datasetNames.length === 1) {
      const [datasetName] = datasetNames
      this.defaultDataName = datasetName
    } else if (datasetNames.length === 0 && vgSpec.data) {
      this.defaultDataName = DEFAULT_DATA_NAME
    }

    const dataObj = getInlineData(el)
    if (dataObj) {
      view.insert(this.defaultDataName, dataObj)
    }
    if (datasets) {
      for (const [name, data] of Object.entries(datasets)) {
        view.insert(name, data)
      }
    }

    await view.runAsync()

    // Fix bug where the "..." menu button overlaps with charts where width is
    // set to -1 on first load.
    this.vegaView.resize().runAsync()
  }

  public render(): JSX.Element {
    if (this.state.error) {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw this.state.error
    }

    return (
      // Create the container Vega draws inside.
      <StyledVegaLiteChartContainer
        data-testid="stArrowVegaLiteChart"
        ref={c => {
          this.element = c
        }}
      />
    )
  }
}

function getInlineData(
  el: VegaLiteChartElement
): { [field: string]: any }[] | null {
  const dataProto = el.data

  if (!dataProto || dataProto.data.numRows === 0) {
    return null
  }

  return getDataArray(dataProto)
}

function getDataArrays(
  el: VegaLiteChartElement
): { [dataset: string]: any[] } | null {
  const datasets = getDataSets(el)
  if (datasets == null) {
    return null
  }

  const datasetArrays: { [dataset: string]: any[] } = {}

  for (const [name, dataset] of Object.entries(datasets)) {
    datasetArrays[name] = getDataArray(dataset)
  }

  return datasetArrays
}

function getDataSets(
  el: VegaLiteChartElement
): { [dataset: string]: Quiver } | null {
  if (el.datasets?.length === 0) {
    return null
  }

  const datasets: { [dataset: string]: Quiver } = {}

  el.datasets.forEach((x: WrappedNamedDataset) => {
    if (!x) {
      return
    }
    const name = x.hasName ? x.name : null
    datasets[name as string] = x.data
  })

  return datasets
}

export function getDataArray(
  dataProto: Quiver,
  startIndex = 0
): { [field: string]: any }[] {
  if (dataProto.isEmpty()) {
    return []
  }

  const dataArr = []
  const { dataRows: rows, dataColumns: cols } = dataProto.dimensions

  const indexType = Quiver.getTypeName(dataProto.types.index[0])
  const hasSupportedIndex = SUPPORTED_INDEX_TYPES.has(
    indexType as IndexTypeName
  )

  for (let rowIndex = startIndex; rowIndex < rows; rowIndex++) {
    const row: { [field: string]: any } = {}

    if (hasSupportedIndex) {
      const indexValue = dataProto.getIndexValue(rowIndex, 0)
      // VegaLite can't handle BigInts, so they have to be converted to Numbers first
      row[MagicFields.DATAFRAME_INDEX] =
        typeof indexValue === "bigint" ? Number(indexValue) : indexValue
    }

    for (let colIndex = 0; colIndex < cols; colIndex++) {
      const dataValue = dataProto.getDataValue(rowIndex, colIndex)
      row[dataProto.columns[0][colIndex]] =
        typeof dataValue === "bigint" ? Number(dataValue) : dataValue
    }
    dataArr.push(row)
  }

  return dataArr
}

/**
 * Checks if data looks like it's just prevData plus some appended rows.
 */
function dataIsAnAppendOfPrev(
  prevData: Quiver,
  prevNumRows: number,
  prevNumCols: number,
  data: Quiver,
  numRows: number,
  numCols: number
): boolean {
  // Check whether dataframes have the same shape.

  // not an append
  if (prevNumCols !== numCols) {
    return false
  }

  // Data can be updated, but still have the same number of rows.
  // We consider the case an append only when the number of rows has increased
  if (prevNumRows >= numRows) {
    return false
  }

  // if no previous data, render from scratch
  if (prevNumRows === 0) {
    return false
  }

  const c = numCols - 1
  const r = prevNumRows - 1

  // Check if the new dataframe looks like it's a superset of the old one.
  // (this is a very light check, and not guaranteed to be right!)
  if (
    prevData.getDataValue(0, c) !== data.getDataValue(0, c) ||
    prevData.getDataValue(r, c) !== data.getDataValue(r, c)
  ) {
    return false
  }

  return true
}

export default withTheme(withFullScreenWrapper(ArrowVegaLiteChart))
