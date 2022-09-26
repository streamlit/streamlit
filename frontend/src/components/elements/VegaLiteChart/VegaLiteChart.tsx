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
import { logMessage } from "src/lib/log"
import { Map as ImmutableMap } from "immutable"
import merge from "lodash/merge"
import withFullScreenWrapper from "src/hocs/withFullScreenWrapper"
import {
  tableGetRowsAndCols,
  indexGet,
  tableGet,
} from "src/lib/dataFrameProto"
import { ensureError } from "src/lib/ErrorHandling"
import { Theme } from "src/theme"
import embed from "vega-embed"
import * as vega from "vega"
import { StyledVegaLiteChartContainer } from "./styled-components"

const MagicFields = {
  DATAFRAME_INDEX: "(index)",
}

const DEFAULT_DATA_NAME = "source"

/**
 * Horizontal space needed for the embed actions button.
 */
const EMBED_PADDING = 38

/**
 * Fix bug where Vega Lite was vertically-cropping the x-axis in some cases.
 * For example, in e2e/scripts/add_rows.py
 */
const BOTTOM_PADDING = 20

/** Types of dataframe-indices that are supported as x axes. */
const SUPPORTED_INDEX_TYPES = new Set([
  "datetimeIndex",
  "float_64Index",
  "int_64Index",
  "rangeIndex",
  "timedeltaIndex",
  "uint_64Index",
])

interface Props {
  width: number
  element: ImmutableMap<string, any>
  theme: Theme
}

export interface PropsWithHeight extends Props {
  height: number | undefined
}

interface State {
  error?: Error
}

export class VegaLiteChart extends PureComponent<PropsWithHeight, State> {
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

    const prevSpec = prevElement.get("spec")
    const spec = element.get("spec")

    if (
      !this.vegaView ||
      prevSpec !== spec ||
      prevTheme !== theme ||
      prevProps.width !== this.props.width ||
      prevProps.height !== this.props.height
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

    const prevData = prevElement.get("data")
    const data = element.get("data")

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
    const spec = JSON.parse(el.get("spec"))
    const useContainerWidth = JSON.parse(el.get("useContainerWidth"))

    spec.config = configWithThemeDefaults(spec.config, theme)

    if (this.props.height) {
      // fullscreen
      spec.width = this.props.width - EMBED_PADDING
      spec.height = this.props.height
    } else if (useContainerWidth) {
      spec.width = this.props.width - EMBED_PADDING
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
    prevData: ImmutableMap<string, any> | null,
    data: ImmutableMap<string, any> | null
  ): void {
    if (!this.vegaView) {
      throw new Error("Chart has not been drawn yet")
    }

    if (!data || !data.get("data")) {
      const view = this.vegaView as any
      // eslint-disable-next-line no-underscore-dangle
      const viewHasDataWithName = view._runtime.data.hasOwnProperty(name)
      if (viewHasDataWithName) {
        this.vegaView.remove(name, vega.truthy)
      }
      return
    }

    if (!prevData || !prevData.get("data")) {
      this.vegaView.insert(name, getDataArray(data))
      return
    }

    const [prevNumRows, prevNumCols] = tableGetRowsAndCols(
      prevData.get("data")
    )
    const [numRows, numCols] = tableGetRowsAndCols(data.get("data"))

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
    const { vgSpec, view, finalize } = await embed(this.element, spec)

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
        data-testid="stVegaLiteChart"
        ref={c => {
          this.element = c
        }}
      />
    )
  }
}

function getInlineData(
  el: ImmutableMap<string, any>
): { [field: string]: any }[] | null {
  const dataProto = el.get("data")

  if (!dataProto) {
    return null
  }

  return getDataArray(dataProto)
}

function getDataArrays(
  el: ImmutableMap<string, any>
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
  el: ImmutableMap<string, any>
): { [dataset: string]: ImmutableMap<string, any> } | null {
  if (!el.get("datasets") || el.get("datasets").isEmpty()) {
    return null
  }

  const datasets: { [dataset: string]: any } = {}

  el.get("datasets").forEach((x: any, i: number) => {
    if (!x) {
      return
    }
    const name = x.get("hasName") ? x.get("name") : null
    datasets[name] = x.get("data")
  })

  return datasets
}

function getDataArray(
  dataProto: ImmutableMap<string, any>,
  startIndex = 0
): { [field: string]: any }[] {
  if (!dataProto.get("data")) {
    return []
  }
  if (!dataProto.get("index")) {
    return []
  }
  if (!dataProto.get("columns")) {
    return []
  }

  const dataArr = []
  const [rows, cols] = tableGetRowsAndCols(dataProto.get("data"))

  const indexType = dataProto.get("index").get("type")
  const hasSupportedIndex = SUPPORTED_INDEX_TYPES.has(indexType)

  for (let rowIndex = startIndex; rowIndex < rows; rowIndex++) {
    const row: { [field: string]: any } = {}

    if (hasSupportedIndex) {
      row[MagicFields.DATAFRAME_INDEX] = indexGet(
        dataProto.get("index"),
        0,
        rowIndex
      )
    }

    for (let colIndex = 0; colIndex < cols; colIndex++) {
      row[indexGet(dataProto.get("columns"), 0, colIndex)] = tableGet(
        dataProto.get("data"),
        colIndex,
        rowIndex
      )
    }

    dataArr.push(row)
  }

  return dataArr
}

/**
 * Checks if data looks like it's just prevData plus some appended rows.
 */
export function dataIsAnAppendOfPrev(
  prevData: ImmutableMap<string, number>,
  prevNumRows: number,
  prevNumCols: number,
  data: ImmutableMap<string, number>,
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

  const df0 = prevData.get("data")
  const df1 = data.get("data")
  const c = numCols - 1
  const r = prevNumRows - 1

  // Check if the new dataframe looks like it's a superset of the old one.
  // (this is a very light check, and not guaranteed to be right!)
  if (
    tableGet(df0, c, 0) !== tableGet(df1, c, 0) ||
    tableGet(df0, c, r) !== tableGet(df1, c, r)
  ) {
    return false
  }

  return true
}

function configWithThemeDefaults(config: any, theme: Theme): any {
  const { colors, fontSizes, genericFonts } = theme
  const themeFonts = {
    labelFont: genericFonts.bodyFont,
    titleFont: genericFonts.bodyFont,
    labelFontSize: fontSizes.twoSmPx,
    titleFontSize: fontSizes.twoSmPx,
  }
  const themeDefaults = {
    background: colors.bgColor,
    axis: {
      labelColor: colors.bodyText,
      titleColor: colors.bodyText,
      gridColor: colors.fadedText10,
      ...themeFonts,
    },
    legend: {
      labelColor: colors.bodyText,
      titleColor: colors.bodyText,
      ...themeFonts,
    },
    title: {
      color: colors.bodyText,
      subtitleColor: colors.bodyText,
      ...themeFonts,
    },
    header: {
      labelColor: colors.bodyText,
    },
    view: {
      continuousHeight: 300,
      continuousWidth: 400,
    },
  }

  if (!config) {
    return themeDefaults
  }

  // Fill in theme defaults where the user didn't specify config options.
  return merge({}, themeDefaults, config || {})
}

export default withTheme(withFullScreenWrapper(VegaLiteChart))
