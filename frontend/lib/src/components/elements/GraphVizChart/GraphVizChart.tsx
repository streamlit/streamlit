/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { memo, ReactElement, useEffect } from "react"

import { Engine, graphviz } from "d3-graphviz"
import { getLogger } from "loglevel"

import {
  GraphVizChart as GraphVizChartProto,
  streamlit,
} from "@streamlit/protobuf"

import {
  shouldHeightStretch,
  shouldWidthStretch,
} from "~lib/components/core/Layout/utils"
import { ElementFullscreenContext } from "~lib/components/shared/ElementFullscreen/ElementFullscreenContext"
import withFullScreenWrapper from "~lib/components/shared/FullScreenWrapper/withFullScreenWrapper"
import { StyledToolbarElementContainer } from "~lib/components/shared/Toolbar/styled-components"
import Toolbar from "~lib/components/shared/Toolbar/Toolbar"
import { useCalculatedDimensions } from "~lib/hooks/useCalculatedDimensions"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"
import { BLOCKED_LINK_URI, isDangerousLinkUri } from "~lib/util/UriUtil"

import { StyledGraphVizChart } from "./styled-components"

export interface GraphVizChartProps {
  element: GraphVizChartProto
  disableFullscreenMode?: boolean
  widthConfig?: streamlit.IWidthConfig | null
  heightConfig?: streamlit.IHeightConfig | null
}
export const LOG = getLogger("GraphVizChart")

const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink"

function sanitizeLinkAttribute(element: Element, attributeName: string): void {
  const attributeValue = element.getAttribute(attributeName)

  if (attributeValue !== null && isDangerousLinkUri(attributeValue)) {
    element.setAttribute(attributeName, BLOCKED_LINK_URI)
  }
}

function sanitizeNamespacedXlinkHref(element: Element): void {
  const attributeValue = element.getAttributeNS(XLINK_NAMESPACE, "href")

  if (attributeValue !== null && isDangerousLinkUri(attributeValue)) {
    element.setAttributeNS(XLINK_NAMESPACE, "xlink:href", BLOCKED_LINK_URI)
  }
}

/**
 * Neutralizes dangerous link URIs in the rendered Graphviz SVG.
 *
 * Graphviz emits link targets as either `href` or `xlink:href`, and depending
 * on how the SVG was parsed the latter may be reachable by qualified name
 * (`getAttribute("xlink:href")`) and/or by namespace
 * (`getAttributeNS(...)`). We handle all three to sanitize the value
 * regardless of environment (e.g. jsdom vs. a real browser SVG DOM).
 */
export function sanitizeGraphVizLinkUris(container: Element): void {
  // Graphviz link targets are exclusively on SVG `<a>` elements, so we only
  // need to inspect those rather than walking every node in the SVG subtree.
  container.querySelectorAll("a").forEach(element => {
    sanitizeLinkAttribute(element, "href")
    sanitizeLinkAttribute(element, "xlink:href")
    sanitizeNamespacedXlinkHref(element)
  })
}

function GraphVizChart({
  element,
  disableFullscreenMode,
  widthConfig,
  heightConfig,
}: Readonly<GraphVizChartProps>): ReactElement {
  const chartId = `st-graphviz-chart-${element.elementId}`

  const {
    width: containerWidth,
    height: containerHeight,
    elementRef,
  } = useCalculatedDimensions()

  const {
    expanded: isFullScreen,
    width,
    height: fullScreenHeight,
    expand,
    collapse,
  } = useRequiredContext(ElementFullscreenContext)

  // Determine if we should use container width based on layout config
  const shouldUseContainerWidth = shouldWidthStretch(widthConfig)

  const shouldUseContainerHeight = shouldHeightStretch(heightConfig)

  useEffect(() => {
    try {
      const graphvizInstance = graphviz(`#${chartId}`).zoom(false)

      // Set the dimensions explicitly when height stretching is enabled.
      // This is necessary for height stretch to work properly in webkit.
      if (heightConfig?.useStretch) {
        graphvizInstance
          // We must also set width for the height stretch to work properly.
          .width(containerWidth < 0 ? 0 : containerWidth)
          .height(containerHeight < 0 ? 0 : containerHeight)
      }

      graphvizInstance
        .fit(true)
        .scale(1)
        .engine(element.engine as Engine)
        // Sanitize links once rendering completes. Graphviz inserts the SVG
        // synchronously here, so there is only a negligible window (before this
        // callback runs) where an unsanitized link could exist in the DOM.
        .renderDot(element.spec, () => {
          const chartElement = document.getElementById(chartId)

          if (chartElement) {
            sanitizeGraphVizLinkUris(chartElement)
          }
        })
    } catch (error) {
      LOG.error(error)
    }
  }, [
    chartId,
    element.engine,
    element.spec,
    containerWidth,
    containerHeight,
    isFullScreen,
    heightConfig?.useStretch,
  ])

  return (
    <StyledToolbarElementContainer
      width={width ?? 0}
      height={
        !isFullScreen
          ? (heightConfig?.pixelHeight ?? undefined)
          : (fullScreenHeight ?? undefined)
      }
      useContainerWidth={isFullScreen || shouldUseContainerWidth}
      useContainerHeight={shouldUseContainerHeight}
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
        shouldUseFullWidth={isFullScreen || shouldUseContainerWidth}
        shouldUseFullHeight={isFullScreen || shouldUseContainerHeight}
        ref={elementRef}
      />
    </StyledToolbarElementContainer>
  )
}

const GraphVizChartWithFullScreen = withFullScreenWrapper(GraphVizChart)
export default memo(GraphVizChartWithFullScreen)
