/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { logMessage } from "@streamlit/lib/src/util/log"
import { withFullScreenWrapper } from "@streamlit/lib/src/components/shared/FullScreenWrapper"
import { ensureError } from "@streamlit/lib/src/util/ErrorHandling"
import { Quiver } from "@streamlit/lib/src/dataframes/Quiver"
import { EmotionTheme } from "@streamlit/lib/src/theme"

import "@streamlit/lib/src/assets/css/vega-embed.css"
import "@streamlit/lib/src/assets/css/vega-tooltip.css"

import {
  getDataSets,
  VegaLiteChartElement,
  getDataArray,
  dataIsAnAppendOfPrev,
  getDataArrays,
  getInlineData,
} from "./arrowUtils"
import { applyStreamlitTheme, applyThemeDefaults } from "./CustomTheme"
import { StyledVegaLiteChartContainer } from "./styled-components"

const DEFAULT_DATA_NAME = "source"

/**
 * Fix bug where Vega Lite was vertically-cropping the x-axis in some cases.
 * For example, in e2e/scripts/add_rows.py
 */
const BOTTOM_PADDING = 20

interface Props {
  element: VegaLiteChartElement
  theme: EmotionTheme
  width: number
}

export interface PropsWithFullScreen extends Props {
  height?: number
  isFullScreen: boolean
}

interface State {
  error?: Error
}

export class ArrowVegaLiteChart extends PureComponent<
  PropsWithFullScreen,
  State
> {
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

  public async componentDidUpdate(
    prevProps: PropsWithFullScreen
  ): Promise<void> {
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
    const { element: el, theme, isFullScreen, width, height } = this.props
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

    if (isFullScreen) {
      spec.width = width
      spec.height = height

      if ("vconcat" in spec) {
        spec.vconcat.forEach((child: any) => {
          child.width = width
        })
      }
    } else if (useContainerWidth) {
      spec.width = width

      if ("vconcat" in spec) {
        spec.vconcat.forEach((child: any) => {
          child.width = width
        })
      }
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
      // Adds interpreter support for Vega expressions that is compliant with CSP
      ast: true,
      expr: expressionInterpreter,

      // Disable default styles so that vega doesn't inject <style> tags in the
      // DOM. We set these styles manually for finer control over them and to
      // avoid inlining styles.
      tooltip: { disableDefaultStyle: true },
      defaultStyle: false,
      forceActionsMenu: true,
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
        useContainerWidth={this.props.element.useContainerWidth}
        isFullScreen={this.props.isFullScreen}
        ref={c => {
          this.element = c
        }}
      />
    )
  }
}

export default withTheme(withFullScreenWrapper(ArrowVegaLiteChart))
