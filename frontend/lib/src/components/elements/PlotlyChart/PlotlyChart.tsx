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

import React, {
  ReactElement,
  useCallback,
  useLayoutEffect,
  useState,
} from "react"
import { useTheme } from "@emotion/react"
import { EmotionTheme } from "@streamlit/lib/src/theme"
import {
  Figure as FigureProto,
  PlotlyChart as PlotlyChartProto,
} from "@streamlit/lib/src/proto"
import withFullScreenWrapper from "@streamlit/lib/src/hocs/withFullScreenWrapper"
import Plot from "react-plotly.js"
import {
  applyStreamlitTheme,
  layoutWithThemeDefaults,
  replaceTemporaryColors,
} from "./CustomTheme"
import {
  PlotHoverEvent,
  PlotMouseEvent,
  PlotRelayoutEvent,
  PlotSelectionEvent,
} from "plotly.js"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"

export interface PlotlyChartProps {
  width: number
  element: PlotlyChartProto
  height: number | undefined
  widgetMgr: WidgetStateManager
}

export interface PlotlyIFrameProps {
  width: number
  height: number | undefined
  url: string
}

export interface InteractivePlotlyReturnValue {
  x: number
  y: number
  pointNumber: number
  pointIndex: number
}

export const DEFAULT_HEIGHT = 450

function isFullScreen(height: number | undefined): boolean {
  return !!height
}

/** Render an iframed Plotly chart from a URL */
function renderIFrame({
  url,
  width,
  height: propHeight,
}: PlotlyIFrameProps): ReactElement {
  const height = propHeight || DEFAULT_HEIGHT
  return <iframe title="Plotly" src={url} style={{ width, height }} />
}

/** Render a Plotly chart from a FigureProto */
function PlotlyFigure({
  element,
  width,
  height,
  widgetMgr,
}: PlotlyChartProps): ReactElement {
  const figure = element.figure as FigureProto

  const theme: EmotionTheme = useTheme()

  const generateSpec = useCallback((): any => {
    const spec = JSON.parse(
      replaceTemporaryColors(figure.spec, theme, element.theme)
    )
    const initialHeight = spec.layout.height
    const initialWidth = spec.layout.width

    if (isFullScreen(height)) {
      spec.layout.width = width
      spec.layout.height = height
    } else if (element.useContainerWidth) {
      spec.layout.width = width
    } else {
      spec.layout.width = initialWidth
      spec.layout.height = initialHeight
    }
    if (element.theme === "streamlit") {
      applyStreamlitTheme(spec, theme)
    } else {
      // Apply minor theming improvements to work better with Streamlit
      spec.layout = layoutWithThemeDefaults(spec.layout, theme)
    }

    return spec
  }, [
    element.theme,
    element.useContainerWidth,
    figure.spec,
    height,
    theme,
    width,
  ])

  const [config, setConfig] = useState(JSON.parse(figure.config))
  const [spec, setSpec] = useState(generateSpec())

  // Update config and spec references iff the theme or props change
  // Use useLayoutEffect to synchronize rerender by updating state
  // More information: https://kentcdodds.com/blog/useeffect-vs-uselayouteffect
  useLayoutEffect(() => {
    setConfig(JSON.parse(figure.config))
    setSpec(generateSpec())
  }, [element, theme, height, width, figure.config, generateSpec])

  const { data, layout, frames } = spec

  const handleClick = (event: PlotMouseEvent): void => {
    // Build array of points to return
    const selectedPoints: Array<InteractivePlotlyReturnValue> = []
    event.points.forEach(function (point: any) {
      selectedPoints.push({
        x: point.x,
        y: point.y,
        pointNumber: point.pointNumber,
        pointIndex: point.pointIndex,
      })
    })

    console.log("Handling select")
    console.log(selectedPoints)
    widgetMgr.setJsonValue(element, selectedPoints, { fromUi: true })
    console.log("Done handling select")
  }

  const handleHover = (event: PlotHoverEvent): void => {
    console.log("Handle Hover")
    console.log(event)
    console.log("Done Handle Hover")
  }

  const handleZoomAndPan = (event: PlotRelayoutEvent): void => {
    console.log("Handle ZoomAndPan")
    console.log(event)
    console.log("Done Handle ZoomAndPan")
  }

  const handleSelect = (event: PlotSelectionEvent): void => {
    // Build array of points to return
    const selectedPoints: Array<InteractivePlotlyReturnValue> = []
    event.points.forEach(function (point: any) {
      selectedPoints.push({
        x: point.x,
        y: point.y,
        pointNumber: point.pointNumber,
        pointIndex: point.pointIndex,
      })
    })

    console.log("Handling select")
    console.log(selectedPoints)
    widgetMgr.setJsonValue(element, selectedPoints, { fromUi: true })
    console.log("Done handling select")
  }

  return (
    <Plot
      key={isFullScreen(height) ? "fullscreen" : "original"}
      className="stPlotlyChart"
      data={data}
      layout={layout}
      config={config}
      frames={frames}
      onClick={handleClick}
      onHover={handleHover}
      onRelayout={handleZoomAndPan}
      onSelected={handleSelect}
    />
  )
}

export function PlotlyChart({
  width,
  element,
  height,
  widgetMgr,
}: PlotlyChartProps): ReactElement {
  switch (element.chart) {
    case "url":
      return renderIFrame({
        url: element.url as string,
        height,
        width,
      })
    case "figure":
      return (
        <PlotlyFigure
          width={width}
          element={element}
          height={height}
          widgetMgr={widgetMgr}
        />
      )
    default:
      throw new Error(`Unrecognized PlotlyChart type: ${element.chart}`)
  }
}

export default withFullScreenWrapper(PlotlyChart)
