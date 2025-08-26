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

import React, { memo, ReactElement, useEffect } from "react"

import { select } from "d3"
import { Engine, graphviz } from "d3-graphviz"
import { getLogger } from "loglevel"

import {
  GraphVizChart as GraphVizChartProto,
  streamlit,
} from "@streamlit/protobuf"

import { shouldChildrenStretch } from "~lib/components/core/Layout/utils"
import { ElementFullscreenContext } from "~lib/components/shared/ElementFullscreen/ElementFullscreenContext"
import { withFullScreenWrapper } from "~lib/components/shared/FullScreenWrapper"
import Toolbar, {
  StyledToolbarElementContainer,
} from "~lib/components/shared/Toolbar"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"

import { StyledGraphVizChart } from "./styled-components"

export interface GraphVizChartProps {
  element: GraphVizChartProto
  disableFullscreenMode?: boolean
  widthConfig?: streamlit.IWidthConfig | null
}
export const LOG = getLogger("GraphVizChart")

function GraphVizChart({
  element,
  disableFullscreenMode,
  widthConfig,
}: Readonly<GraphVizChartProps>): ReactElement {
  const chartId = `st-graphviz-chart-${element.elementId}`

  const {
    expanded: isFullScreen,
    width,
    height: fullScreenHeight,
    expand,
    collapse,
  } = useRequiredContext(ElementFullscreenContext)

  // Determine if we should use container width based on layout config or legacy prop
  const shouldUseContainerWidth =
    shouldChildrenStretch(widthConfig) || element.useContainerWidth

  useEffect(() => {
    try {
      graphviz(`#${chartId}`)
        .zoom(false)
        .fit(true)
        .scale(1)
        .engine(element.engine as Engine)
        .renderDot(element.spec)

      if (isFullScreen || shouldUseContainerWidth) {
        const node = select(`#${chartId} > svg`).node() as SVGGraphicsElement
        // We explicitly remove width and height to let CSS and the SVG viewBox
        // define its dimensions
        node.removeAttribute("width")
        node.removeAttribute("height")
      }
    } catch (error) {
      LOG.error(error)
    }
  }, [
    chartId,
    element.engine,
    element.spec,
    shouldUseContainerWidth,
    isFullScreen,
  ])

  return (
    <StyledToolbarElementContainer
      width={width ?? 0}
      height={fullScreenHeight}
      useContainerWidth={isFullScreen || shouldUseContainerWidth}
    >
      <Toolbar
        target={StyledToolbarElementContainer}
        isFullScreen={isFullScreen}
        onExpand={expand}
        onCollapse={collapse}
        disableFullscreenMode={disableFullscreenMode}
      ></Toolbar>
      <StyledGraphVizChart
        className="stGraphVizChart"
        data-testid="stGraphVizChart"
        id={chartId}
        isFullScreen={isFullScreen}
        useContainerWidth={shouldUseContainerWidth}
      />
    </StyledToolbarElementContainer>
  )
}

const GraphVizChartWithFullScreen = withFullScreenWrapper(GraphVizChart)
export default memo(GraphVizChartWithFullScreen)
