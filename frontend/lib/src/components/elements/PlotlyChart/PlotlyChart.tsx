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
  useEffect,
  useLayoutEffect,
  useRef,
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
  x: any
  y: any
  z?: any
  hoverText?: string
  markerSize?: any
  pointNumber: number
  pointIndex: number
}

type DragMode =
  | "zoom"
  | "pan"
  | "select"
  | "lasso"
  | "orbit"
  | "turntable"
  | false

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

  const [config] = useState(JSON.parse(figure.config))
  const dragmode = useRef<DragMode>(false)
  const hoverEvents: PlotHoverEvent[] = []

  const theme: EmotionTheme = useTheme()
  const [spec, setSpec] = useState(
    JSON.parse(replaceTemporaryColors(figure.spec, theme, element.theme))
  )
  useEffect(() => {
    if (element.theme === "streamlit") {
      applyStreamlitTheme(spec, theme)
    } else {
      // Apply minor theming improvements to work better with Streamlit
      spec.layout = layoutWithThemeDefaults(spec.layout, theme)
    }
  }, [])

  const [initialHeight] = useState(spec.layout.height)
  const [initialWidth] = useState(spec.layout.width)

  useLayoutEffect(() => {
    if (isFullScreen(height)) {
      spec.layout.width = width
      spec.layout.height = height
    } else if (element.useContainerWidth) {
      spec.layout.width = width
      if (!isFullScreen(height) && height !== initialHeight) {
        spec.layout.height = initialHeight
      }
    } else {
      // console.log("Not full screen!")
      spec.layout.width = initialWidth
      spec.layout.height = initialHeight
    }
    setSpec(spec)
  }, [
    height,
    width,
    element.useContainerWidth,
    spec,
    initialWidth,
    initialHeight,
  ])

  const { data, layout, frames } = spec

  const handleClick = (event: PlotMouseEvent): void => {
    console.log(event)
    // Build array of points to return
    const selectedPoints: Array<InteractivePlotlyReturnValue> = []
    event.points.forEach(function (point: any) {
      selectedPoints.push({
        x: point.x,
        y: point.y,
        z: point.z ? point.z : undefined,
        hoverText: point.hovertext ? point.hovertext : undefined,
        markerSize: point["marker.size"] ? point["marker.size"] : undefined,
        pointNumber: point.pointNumber,
        pointIndex: point.pointIndex,
      })
    })

    console.log("Handling click")
    console.log(selectedPoints)
    widgetMgr.setJsonValue(element, selectedPoints, { fromUi: true })
    console.log("Done handling click")
  }

  const handleHover = (event: PlotHoverEvent): void => {
    console.log("handle hover")
    console.log(event)
    // Array to store the selected points
    let debounceTimeout: NodeJS.Timeout | null = null
    hoverEvents.push(event)

    // // If there's a pending timeout, clear it
    if (debounceTimeout) {
      clearTimeout(debounceTimeout)
    }

    // if (!dragmode || dragmode.current === "pan") {
    // Set a new timeout to handle the selectedPoints after 1000ms
    debounceTimeout = setTimeout(() => {
      const selectedPoints: Array<InteractivePlotlyReturnValue> = []
      // Loop through each point in the LAST event
      hoverEvents[hoverEvents.length - 1].points.forEach((point: any) => {
        selectedPoints.push({
          x: point.x,
          y: point.y,
          z: point.z ? point.z : undefined,
          hoverText: point.hovertext ? point.hovertext : undefined,
          markerSize: point["marker.size"] ? point["marker.size"] : undefined,
          pointNumber: point.pointNumber,
          pointIndex: point.pointIndex,
        })
      })
      widgetMgr.setJsonValue(element, selectedPoints, { fromUi: true })

      // Clear the selectedPoints array after setting the JSON value
      selectedPoints.length = 0
    }, 1000)
    // }
    console.log("Done handle hover")
  }

  const handleZoomAndPan = (event: PlotRelayoutEvent): void => {
    if (
      !event.dragmode &&
      // @ts-expect-error
      !event.selections &&
      // @ts-expect-error
      !event["selections[0].path"] &&
      // @ts-expect-error
      !event["selections[0].x0"] &&
      !event["xaxis.autorange"] &&
      !event["yaxis.autorange"]
    ) {
      widgetMgr.setJsonValue(element, event, { fromUi: true })
    }
    if (event.dragmode) {
      dragmode.current = event.dragmode
    }
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
        z: point.z ? point.z : undefined,
        hoverText: point.hovertext ? point.hovertext : undefined,
        markerSize: point["marker.size"] ? point["marker.size"] : undefined,
        pointNumber: point.pointNumber,
        pointIndex: point.pointIndex,
      })
    })

    console.log("Handling select")
    console.log(event)
    // console.log(selectedPoints)/
    widgetMgr.setJsonValue(element, selectedPoints, { fromUi: true })
    console.log("Done handling select")
  }

  return (
    <Plot
      key={isFullScreen(height) ? "fullscreen" : "original"}
      className="stPlotlyChart"
      data={data}
      // divId={element.figureId}
      layout={layout}
      config={config}
      frames={frames}
      onClick={element.onClick ? handleClick : () => {}}
      onHover={element.onHover ? handleHover : () => {}}
      onRelayout={element.onRelayout ? handleZoomAndPan : () => {}}
      onSelected={element.onSelect ? handleSelect : () => {}}
      onDoubleClick={
        element.onRelayout || element.onSelect || element.onClick
          ? () => {
              widgetMgr.setJsonValue(element, {}, { fromUi: true })
            }
          : () => {}
      }
      onInitialized={figure => {
        setSpec(figure)
      }}
      onUpdate={figure => {
        setSpec(figure)
      }}
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
