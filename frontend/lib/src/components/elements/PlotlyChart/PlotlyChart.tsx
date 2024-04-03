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
  useLayoutEffect,
  useState,
  useCallback,
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
import { keysToSnakeCase } from "@streamlit/lib/src/util/utils"

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

export interface Selection extends SelectionRange {
  xref: string
  yref: string
}

export const DEFAULT_HEIGHT = 450
const SELECTIONS_KEY = "selections"

function isFullScreen(height: number | undefined): boolean {
  return !!height
}

export function parseLassoPath(pathData: string): SelectionRange {
  if (pathData === "") {
    return {
      x: [],
      y: [],
    }
  }
  const points = pathData.replace("M", "").replace("Z", "").split("L")

  const x: number[] = []
  const y: number[] = []

  points.forEach(point => {
    const [xVal, yVal] = point.split(",").map(Number)
    x.push(xVal)
    y.push(yVal)
  })

  return { x, y }
}

export function parseBoxSelection(selection: any): SelectionRange {
  const hasRequiredFields =
    "x0" in selection &&
    "x1" in selection &&
    "y0" in selection &&
    "y1" in selection

  if (!hasRequiredFields) {
    return { x: [], y: [] }
  }

  const x: number[] = [selection.x0, selection.x1]
  const y: number[] = [selection.y0, selection.y1]
  return { x, y }
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
      style={{ width, height, colorScheme: "normal" }}
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
  const figure = element.figure as FigureProto

  const [config] = useState(JSON.parse(figure.config))

  const theme: EmotionTheme = useTheme()
  const getInitialValue = useCallback((): any => {
    let spec = JSON.parse(
      replaceTemporaryColors(figure.spec, theme, element.theme)
    )
    const storedValue = widgetMgr.getJsonValue(element)

    if (storedValue === "{}") {
      spec.data.forEach((trace: any) => {
        trace.selectedpoints = undefined
      })
      spec.layout.selections = undefined
    }

    // we store serialized json in widgetStateManager when resetting so need to check an empty dictionary string
    if (storedValue !== undefined && storedValue !== "{}") {
      const parsedStoreValue = JSON.parse(storedValue.toString())
      // check if there is a selection
      if (parsedStoreValue.select) {
        const { data, selections } = widgetMgr.getExtraWidgetInfo(
          element,
          SELECTIONS_KEY
        )
        spec.data = data
        spec.layout.selections = selections

        const hasSelectedPoints: boolean = spec.data.some(
          (trace: any) =>
            "selectedpoints" in trace && trace.selectedpoints.length > 0
        )
        if (hasSelectedPoints) {
          // make all other points opaque
          spec.data.forEach((trace: any) => {
            if (!trace.selectedpoints) {
              trace.selectedpoints = []
            }
          })
        }
      }
    }

    return spec
  }, [])

  const spec = getInitialValue()

  const [initialHeight] = useState(spec.layout.height)
  const [initialWidth] = useState(spec.layout.width)

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
  if (element.isSelectEnabled) {
    spec.layout.clickmode = "event+select"
    spec.layout.hovermode = "closest"
  }
  if (element.theme === "streamlit") {
    applyStreamlitTheme(spec, theme)
  } else {
    // Apply minor theming improvements to work better with Streamlit
    spec.layout = layoutWithThemeDefaults(spec.layout, theme)
  }

  const handleSelect = (event: PlotSelectionEvent): void => {
    const returnValue: any = { select: {} }
    const { data } = spec
    const pointIndices: number[] = []
    const selectedBoxes: Selection[] = []
    const selectedLassos: Selection[] = []
    const selectedPoints: Array<any> = []

    event.points.forEach(function (point: any) {
      selectedPoints.push({
        ...point,
        legendgroup: point.data.legendgroup
          ? point.data.legendgroup
          : undefined,
        data: undefined,
        fullData: undefined,
      })
      pointIndices.push(point.pointIndex)

      // build graph representation to retain state
      if (
        data[point.curveNumber] &&
        !data[point.curveNumber].selectedpoints.includes(point.pointIndex)
      ) {
        data[point.curveNumber].selectedpoints.push(point.pointIndex)
      } else {
        data[point.curveNumber].selectedpoints = [point.pointIndex]
      }
    })

    returnValue.select.points = selectedPoints

    // point_indices to replicate pythonic return value
    returnValue.select.point_indices = pointIndices

    // event.selections doesn't show up in the PlotSelectionEvent
    // @ts-expect-error
    if (event.selections) {
      // @ts-expect-error
      event.selections.forEach((selection: any) => {
        // box selection
        if (selection.type === "rect") {
          const xAndy = parseBoxSelection(selection)
          const returnSelection: Selection = {
            xref: selection.xref,
            yref: selection.yref,
            x: xAndy.x,
            y: xAndy.y,
          }
          selectedBoxes.push(returnSelection)
        }
        // lasso selection
        if (selection.type === "path") {
          const xAndy = parseLassoPath(selection.path)
          const returnSelection: Selection = {
            xref: selection.xref,
            yref: selection.yref,
            x: xAndy.x,
            y: xAndy.y,
          }
          selectedLassos.push(returnSelection)
        }
      })

      widgetMgr.setExtraWidgetInfo(element, SELECTIONS_KEY, {
        data: data,
        // @ts-expect-error
        selections: event.selections,
      })
    }

    returnValue.select.box = selectedBoxes
    returnValue.select.lasso = selectedLassos
    returnValue.select.points = returnValue.select.points.map((point: any) =>
      keysToSnakeCase(point)
    )
    widgetMgr.setJsonValue(element, returnValue, { fromUi: true })
  }

  const { data, layout, frames } = spec

  const reset = (): void => {
    const spec = JSON.parse(
      replaceTemporaryColors(figure.spec, theme, element.theme)
    )
    if (element.theme === "streamlit") {
      applyStreamlitTheme(spec, theme)
    } else {
      // Apply minor theming improvements to work better with Streamlit
      spec.layout = layoutWithThemeDefaults(spec.layout, theme)
    }
    if (element.isSelectEnabled) {
      spec.layout.clickmode = "event+select"
      spec.layout.hovermode = "closest"
    }
    widgetMgr.setExtraWidgetInfo(element, SELECTIONS_KEY, {})
    widgetMgr.setJsonValue(element, {}, { fromUi: true })
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
      onSelected={element.isSelectEnabled ? handleSelect : () => {}}
      onDoubleClick={element.isSelectEnabled ? reset : () => {}}
      onDeselect={element.isSelectEnabled ? reset : () => {}}
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
