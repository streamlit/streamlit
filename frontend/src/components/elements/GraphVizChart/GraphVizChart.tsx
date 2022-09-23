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

import React, { ReactElement, useEffect } from "react"
import { select } from "d3"
import { graphviz } from "d3-graphviz"
import { logError } from "src/lib/log"
import withFullScreenWrapper from "src/hocs/withFullScreenWrapper"
import { GraphVizChart as GraphVizChartProto } from "src/autogen/proto"
import { StyledGraphVizChart } from "./styled-components"

export interface GraphVizChartProps {
  width: number
  element: GraphVizChartProto
  height: number | undefined
}

interface Dimensions {
  chartWidth: number
  chartHeight: number
}

// Use d3Graphviz in a dummy expression so the library actually gets loaded.
// This way it registers itself in d3 as a plugin at this point.
const dummyGraphviz = graphviz
dummyGraphviz // eslint-disable-line @typescript-eslint/no-unused-expressions

export function GraphVizChart({
  width: propWidth,
  element,
  height: propHeight,
}: GraphVizChartProps): ReactElement {
  const chartId = `graphviz-chart-${element.elementId}`

  let originalHeight = 0
  let originalWidth = 0

  const getChartData = (): string => {
    return element.spec
  }

  const getChartDimensions = (): Dimensions => {
    let chartWidth = originalWidth
    let chartHeight = originalHeight

    if (propHeight) {
      // fullscreen
      chartWidth = propWidth
      chartHeight = propHeight
    } else if (element.useContainerWidth) {
      chartWidth = propWidth
    }
    return { chartWidth, chartHeight }
  }

  const updateChart = (): void => {
    try {
      // Layout and render the graph
      const graph = select(`#${chartId}`)
        .graphviz()
        .zoom(false)
        .fit(true)
        .scale(1)
        .renderDot(getChartData())
        .on("end", () => {
          const node = select(`#${chartId} > svg`).node() as SVGGraphicsElement
          if (node) {
            originalHeight = node.getBBox().height
            originalWidth = node.getBBox().width
          }
        })

      const { chartHeight, chartWidth } = getChartDimensions()
      if (chartHeight > 0) {
        // Override or reset the graph height
        graph.height(chartHeight)
      }
      if (chartWidth > 0) {
        // Override or reset the graph width
        graph.width(chartWidth)
      }
    } catch (error) {
      logError(error)
    }
  }

  useEffect(() => {
    updateChart()
  })

  const elementDimensions = getChartDimensions()
  const width: number = elementDimensions.chartWidth
    ? elementDimensions.chartWidth
    : propWidth
  const height: number | undefined = elementDimensions.chartHeight
    ? elementDimensions.chartHeight
    : propHeight

  return (
    <StyledGraphVizChart
      className="graphviz stGraphVizChart"
      id={chartId}
      style={{ width, height }}
    />
  )
}

export default withFullScreenWrapper(GraphVizChart)
