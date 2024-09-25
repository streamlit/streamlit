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

import React, { ReactElement, useCallback, useEffect } from "react"

import { BokehChart as BokehChartProto } from "@streamlit/lib/src/proto"
// We import Bokeh from a vendored source file, because it doesn't play well with Babel (https://github.com/bokeh/bokeh/issues/10658)
// Importing these files will cause global Bokeh to be mutated
// Consumers of this component will have to provide these js files
// bokeh.esm is renamed from bokeh-2.4.3.esm.min.js because addon bokeh scripts have hardcoded path to bokeh main script ("import main from “./bokeh.esm.js")
import Bokeh from "@streamlit/lib/src/vendor/bokeh/bokeh.esm"
import "@streamlit/lib/src/vendor/bokeh/bokeh-api-2.4.3.esm.min"
import "@streamlit/lib/src/vendor/bokeh/bokeh-gl-2.4.3.esm.min"
import "@streamlit/lib/src/vendor/bokeh/bokeh-mathjax-2.4.3.esm.min"
import "@streamlit/lib/src/vendor/bokeh/bokeh-tables-2.4.3.esm.min"
import "@streamlit/lib/src/vendor/bokeh/bokeh-widgets-2.4.3.esm.min"

export interface BokehChartProps {
  width: number
  element: BokehChartProto
  height?: number
}

interface Dimensions {
  chartWidth: number
  chartHeight: number
}

export function BokehChart({
  width,
  element,
  height,
}: Readonly<BokehChartProps>): ReactElement {
  const chartId = `bokeh-chart-${element.elementId}`

  const memoizedGetChartData = useCallback(() => {
    return JSON.parse(element.figure)
  }, [element])

  const getChartDimensions = useCallback(
    (plot: any): Dimensions => {
      // Default values
      let chartWidth: number = plot.attributes.plot_width
      let chartHeight: number = plot.attributes.plot_height

      // if is not fullscreen and useContainerWidth==false, we should use default values
      if (height) {
        chartWidth = width
        chartHeight = height
      } else if (element.useContainerWidth) {
        chartWidth = width
      }

      return { chartWidth, chartHeight }
    },
    [element.useContainerWidth, height, width]
  )

  const removeAllChildNodes = (element: Node): void => {
    while (element.lastChild) {
      element.lastChild.remove()
    }
  }

  const updateChart = (data: any): void => {
    const chart = document.getElementById(chartId)

    /**
     * When you create a bokeh chart in your python script, you can specify
     * the width: p = figure(title="simple line example", x_axis_label="x", y_axis_label="y", plot_width=200);
     * In that case, the json object will contains an attribute called
     * plot_width (or plot_heigth) inside the plot reference.
     * If that values are missing, we can set that values to make the chart responsive.
     */
    const plot =
      data && data.doc && data.doc.roots && data.doc.roots.references
        ? data.doc.roots.references.find((e: any) => e.type === "Plot")
        : undefined

    if (plot) {
      const { chartWidth, chartHeight } = getChartDimensions(plot)

      if (chartWidth > 0) {
        plot.attributes.plot_width = chartWidth
      }
      if (chartHeight > 0) {
        plot.attributes.plot_height = chartHeight
      }
    }

    if (chart !== null) {
      removeAllChildNodes(chart)
      // embed_item is actually an async function call, so a race condition
      // can occur if updateChart is called twice, leading to two Bokeh charts
      // to be embedded at the same time.
      Bokeh.embed.embed_item(data, chartId)
    }
  }

  const memoizedUpdateChart = useCallback(updateChart, [
    chartId,
    getChartDimensions,
  ])

  // We only want useEffect to run once per prop update, because of the embed_item
  // race condition mentioned per run. Thus we pass in all props and methods
  // into the useEffect dependency array.
  useEffect(() => {
    memoizedUpdateChart(memoizedGetChartData())
  }, [width, height, element, memoizedGetChartData, memoizedUpdateChart])

  return (
    <div id={chartId} className="stBokehChart" data-testid="stBokehChart" />
  )
}

export default BokehChart
