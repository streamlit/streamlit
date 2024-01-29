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
import { withFullScreenWrapper } from "@streamlit/lib/src/components/shared/FullScreenWrapper"
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
  return (
    <iframe
      title="Plotly"
      src={url}
      style={{ width, height, colorScheme: "light dark" }}
    />
  )
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
  // const figure = element.figure as FigureProto

  // const theme: EmotionTheme = useTheme()
  const selectedPoints = useRef<Array<any> | undefined>()

  // const generateSpec = useCallback((): any => {
  //   const spec = JSON.parse(
  //     replaceTemporaryColors(figure.spec, theme, element.theme)
  //   )
  //   const initialHeight = spec.layout.height
  //   const initialWidth = spec.layout.width

  //   if (isFullScreen(height)) {
  //     spec.layout.width = width
  //     spec.layout.height = height
  //   } else if (element.useContainerWidth) {
  //     spec.layout.width = width
  //   } else {
  //     spec.layout.width = initialWidth
  //     spec.layout.height = initialHeight
  //   }
  //   if (element.theme === "streamlit") {
  //     applyStreamlitTheme(spec, theme)
  //   } else {
  //     // Apply minor theming improvements to work better with Streamlit
  //     spec.layout = layoutWithThemeDefaults(spec.layout, theme)
  //   }

  //   return spec
  // }, [
  //   element.theme,
  //   element.useContainerWidth,
  //   figure.spec,
  //   height,
  //   theme,
  //   width,
  // ])

  // const [config, setConfig] = useState(JSON.parse(figure.config))
  // const [spec, setSpec] = useState(generateSpec())

  // // Update config and spec references iff the theme or props change
  // // Use useLayoutEffect to synchronize rerender by updating state
  // // More information: https://kentcdodds.com/blog/useeffect-vs-uselayouteffect
  // useLayoutEffect(() => {
  //   setConfig(JSON.parse(figure.config))
  //   setSpec(generateSpec())
  // }, [element, theme, height, width, figure.config, generateSpec])

  // const { data, layout, frames } = spec

  // console.log(element.onSelect)
  const figure = element.figure as FigureProto

  const [config] = useState(JSON.parse(figure.config))

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
    if (element.onSelect) {
      spec.layout.clickmode = "event+select"
      spec.layout.hovermode = "closest"
    }
  }, [
    height,
    width,
    element.useContainerWidth,
    spec,
    initialWidth,
    initialHeight,
    element.theme,
    theme,
    element.onSelect,
    selectedPoints,
  ])

  const handleSelect = (event: PlotSelectionEvent): void => {
    const returnValue: any = {}
    const pointIndices: number[] = []
    const xs: any[] = []
    const ys: any[] = []
    // Build array of points to return
    const selectedPoints: Array<any> = []
    event.points.forEach(function (point: any) {
      selectedPoints.push({
        ...extractNonObjects(point),
        legendgroup: point.data.legendgroup
          ? point.data.legendgroup
          : undefined,
        // name: point.data.name,
      })
      xs.push(point.x)
      ys.push(point.y)
      pointIndices.push(point.pointIndex)
    })
    // console.log(event)

    returnValue.points = selectedPoints
    // point_indices to replicate pythonic return value
    returnValue.point_indices = pointIndices
    // returnValue.data = event.points.length > 0 ? event.points[0].data : {}
    if (event.range || event.lassoPoints) {
      returnValue.range = event.range
      // lasso_points to replicate pythonic return value
      returnValue.lasso_points = event.lassoPoints
    }
    // console.log(returnValue)

    widgetMgr.setJsonValue(element, returnValue, { fromUi: true })
    console.log("Done handling select")
  }

  const { data, layout, frames } = spec

  return (
    <Plot
      key={isFullScreen(height) ? "fullscreen" : "original"}
      className="stPlotlyChart"
      divId={element.id}
      data={data}
      layout={layout}
      config={config}
      frames={frames}
      onSelected={element.onSelect ? handleSelect : () => {}}
      onDeselect={
        element.onSelect
          ? () => {
              console.log("deselecting")
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
