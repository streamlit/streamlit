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
import { PlotSelectionEvent } from "plotly.js"
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

// Copied and Pasted from Plotly type def
export interface SelectionRange {
  x: number[]
  y: number[]
}

// TODO(willhuang1997): This should likely be removed. I was just using this to remove .data and .fullData
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

function parseLassoPath(pathData: string): SelectionRange {
  // Remove the 'M' and 'Z' from the string and then split by 'L'
  const points = pathData.replace("M", "").replace("Z", "").split("L")

  const x: number[] = []
  const y: number[] = []

  // Iterate through the points and split them into x and y
  points.forEach(point => {
    const [xVal, yVal] = point.split(",").map(Number)
    x.push(xVal)
    y.push(yVal)
  })

  // Return the object with x and y arrays
  return { x, y }
}

function parseBoxSelection(selection: any): SelectionRange {
  const x: number[] = [selection.x0, selection.x1]
  const y: number[] = [selection.y0, selection.y1]
  return { x, y }
}

function toSnakeCase(str: string): string {
  return str.replace(/[\dA-Z\.]/g, letter =>
    letter === "." ? "_" : `_${letter.toLowerCase()}`
  )
}

function keysToSnakeCase(obj: Record<string, any>): Record<string, any> {
  return Object.keys(obj).reduce((acc, key) => {
    const newKey = toSnakeCase(key)
    let value = obj[key]

    if (value && typeof value === "object" && !Array.isArray(value)) {
      value = keysToSnakeCase(value)
    }

    if (Array.isArray(value)) {
      value = value.map(item =>
        typeof item === "object" ? keysToSnakeCase(item) : item
      )
    }

    acc[newKey] = value
    return acc
  }, {} as Record<string, any>)
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

/** Render a Plotly chart from a FigureProto */
function PlotlyFigure({
  element,
  width,
  height,
  widgetMgr,
}: PlotlyChartProps): ReactElement {
  console.log("Rerendering")
  const figure = element.figure as FigureProto

  const [config] = useState(JSON.parse(figure.config))

  const theme: EmotionTheme = useTheme()
  const [spec, setSpec] = useState(
    JSON.parse(replaceTemporaryColors(figure.spec, theme, element.theme))
  )
  console.log(spec)

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
  ])

  const handleSelect = (event: PlotSelectionEvent): void => {
    const returnValue: any = { select: {} }
    const pointIndices: number[] = []
    const xs: number[] = []
    const ys: number[] = []
    const selectedBoxes: SelectionRange[] = []
    const selectedLassos: SelectionRange[] = []
    const selectedPoints: Array<any> = []

    event.points.forEach(function (point: any) {
      selectedPoints.push({
        ...extractNonObjects(point),
        legendgroup: point.data.legendgroup
          ? point.data.legendgroup
          : undefined,
      })
      xs.push(point.x)
      ys.push(point.y)
      pointIndices.push(point.pointIndex)
    })

    returnValue.select.points = selectedPoints

    // point_indices to replicate pythonic return value
    returnValue.select.point_indices = pointIndices

    // select_box to replicate pythonic return value
    returnValue.select.select_box =
      selectedBoxes.length > 0 ? selectedBoxes : undefined
    // lasso_points to replicate pythonic return value
    returnValue.select.select_lasso =
      selectedLassos.length > 0 ? selectedLassos : undefined

    returnValue.select.points = returnValue.select.points.map((point: any) =>
      keysToSnakeCase(point)
    )
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
