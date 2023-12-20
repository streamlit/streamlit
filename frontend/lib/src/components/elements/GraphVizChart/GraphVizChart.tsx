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

import React, { ReactElement, useEffect } from "react"
import { select } from "d3"
import { graphviz, Engine } from "d3-graphviz"
import { logError } from "@streamlit/lib/src/util/log"
import { withFullScreenWrapper } from "@streamlit/lib/src/components/shared/FullScreenWrapper"
import { GraphVizChart as GraphVizChartProto } from "@streamlit/lib/src/proto"
import { StyledGraphVizChart } from "./styled-components"

export interface GraphVizChartProps {
  element: GraphVizChartProto
  isFullScreen: boolean
}

export function GraphVizChart({
  element,
  isFullScreen,
}: GraphVizChartProps): ReactElement {
  const chartId = `graphviz-chart-${element.elementId}`

  useEffect(() => {
    try {
      graphviz(`#${chartId}`)
        .zoom(false)
        .fit(true)
        .scale(1)
        .engine(element.engine as Engine)
        .renderDot(element.spec)

      if (isFullScreen || element.useContainerWidth) {
        const node = select(`#${chartId} > svg`).node() as SVGGraphicsElement
        // We explicitly remove width and height to let CSS and the SVG viewBox
        // define its dimensions
        node.removeAttribute("width")
        node.removeAttribute("height")
      }
    } catch (error) {
      logError(error)
    }
  }, [
    chartId,
    element.engine,
    element.spec,
    element.useContainerWidth,
    isFullScreen,
  ])

  return (
    <StyledGraphVizChart
      className="graphviz stGraphVizChart"
      data-testid="stGraphVizChart"
      id={chartId}
      isFullScreen={isFullScreen}
    />
  )
}

export default withFullScreenWrapper(GraphVizChart)
