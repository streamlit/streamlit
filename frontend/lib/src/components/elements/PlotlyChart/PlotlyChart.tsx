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

function extractNonObjects(obj: any): any {
  const result: any = {}

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value !== "object" || value === null) {
      result[key] = value
    }
  }

  return result
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

// TODO: Could convert array to set to make plotly faster

const pointsAreEqual = (point1: any, point2: any): boolean => {
  return (
    point1.curveNumber === point2.curveNumber &&
    point1.pointNumber === point2.pointNumber &&
    point1.binNumber === point2.binNumber
  )
}

const arrayIncludesPoint = (array: Array<any>, wantedPoint: any): boolean => {
  return array.some((point): any => pointsAreEqual(point, wantedPoint))
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
  const hoverEvents: PlotHoverEvent[] = []
  const selectedPoints = useRef<Array<any> | undefined>()

  const theme: EmotionTheme = useTheme()
  const [spec, setSpec] = useState(JSON.parse(figure.spec))

  useEffect(() => {
    setSpec(
      JSON.parse(replaceTemporaryColors(figure.spec, theme, element.theme))
    )
  }, [figure.spec, theme, element.theme])

  const [initialHeight] = useState(spec.layout.height)
  const [initialWidth] = useState(spec.layout.width)

  useLayoutEffect(() => {
    if (element.theme === "streamlit") {
      applyStreamlitTheme(spec, theme)
    } else {
      // Apply minor theming improvements to work better with Streamlit
      spec.layout = layoutWithThemeDefaults(spec.layout, theme)
    }
    if (isFullScreen(height)) {
      spec.layout.width = width
      spec.layout.height = height
    } else if (element.useContainerWidth) {
      spec.layout.width = width
      if (!isFullScreen(height) && height !== initialHeight) {
        spec.layout.height = initialHeight
      }
    } else {
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
    element.theme,
    theme,
  ])

  const { data, layout, frames } = spec

  //TODO: Change color for selected

  const handleClick = (event: PlotMouseEvent): void => {
    let returnPoints: Array<any> = []

    // Include points
    if (event.event.shiftKey) {
      let currentPoints: Array<any> =
        selectedPoints.current === undefined
          ? []
          : // deep copy of selected points
            JSON.parse(JSON.stringify(selectedPoints.current))
      event.points.forEach(function (point: any) {
        // if we are not adding the same point
        if (!arrayIncludesPoint(currentPoints, point)) {
          currentPoints.push({
            ...extractNonObjects(point),
            legendgroup: point.data.legendgroup
              ? point.data.legendgroup
              : undefined,
          })
          // deselect
        } else {
          console.log("Deselecting!")
          currentPoints = currentPoints.filter((currentPoint): any => {
            return !pointsAreEqual(currentPoint, point)
          })
        }
      })
      returnPoints = currentPoints
    }

    // Return a single point
    else {
      const newPoints: Array<any> = []
      event.points.forEach(function (point: any) {
        newPoints.push({
          ...extractNonObjects(point),
          legendgroup: point.data.legendgroup
            ? point.data.legendgroup
            : undefined,
        })
        returnPoints = newPoints
      })
    }

    selectedPoints.current = returnPoints
    widgetMgr.setJsonValue(element, selectedPoints.current, { fromUi: true })

    console.log("Handling click")
    console.log(data)
    console.log(event)
    console.log("Done handling click")
  }

  // should disable hover event because it's too slow
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
      // Build array of points to return
      const selectedPoints: Array<any> = []
      event.points.forEach(function (point: any) {
        selectedPoints.push({
          ...extractNonObjects(point),
          legendgroup: point.data.legendgroup
            ? point.data.legendgroup
            : undefined,
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
      // ignore dragmode change events
      !event.dragmode &&
      // @ts-expect-error
      !event.selections &&
      // ignore lasso selection
      // @ts-expect-error
      !event["selections[0].path"] &&
      // ignore box selection
      // @ts-expect-error
      !event["selections[0].x0"] &&
      // ignore autorange
      !event["xaxis.autorange"] &&
      !event["yaxis.autorange"]
    ) {
      widgetMgr.setJsonValue(element, event, { fromUi: true })
    }
    if (event["xaxis.autorange"] && event["yaxis.autorange"]) {
      widgetMgr.setJsonValue(element, {}, { fromUi: true })
    }
    console.log("Handle ZoomAndPan")
    console.log(event)
    console.log("Done Handle ZoomAndPan")
  }

  const handleSelect = (event: PlotSelectionEvent): void => {
    // Build array of points to return
    const selectedPoints: Array<any> = []
    event.points.forEach(function (point: any) {
      selectedPoints.push({
        ...extractNonObjects(point),
        legendgroup: point.data.legendgroup
          ? point.data.legendgroup
          : undefined,
      })
    })
    widgetMgr.setJsonValue(element, selectedPoints, { fromUi: true })
    console.log("Done handling select")
  }

  return (
    <Plot
      key={isFullScreen(height) ? "fullscreen" : "original"}
      className="stPlotlyChart"
      divId={element.id}
      data={data}
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
              selectedPoints.current = []
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
