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

import React, { ReactElement, useState, useCallback } from "react"

import { useTheme } from "@emotion/react"
import Plot, { Figure as PlotlyFigureType } from "react-plotly.js"

import { EmotionTheme } from "@streamlit/lib/src/theme"
import {
  Figure as FigureProto,
  PlotlyChart as PlotlyChartProto,
} from "@streamlit/lib/src/proto"
import { withFullScreenWrapper } from "@streamlit/lib/src/components/shared/FullScreenWrapper"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import { keysToSnakeCase } from "@streamlit/lib/src/util/utils"
import { FormClearHelper } from "@streamlit/lib/src/components/widgets/Form/FormClearHelper"

import {
  applyStreamlitTheme,
  layoutWithThemeDefaults,
  replaceTemporaryColors,
} from "./CustomTheme"

export interface PlotlyChartProps {
  width: number
  element: PlotlyChartProto
  height: number | undefined
  isFullScreen: boolean
  widgetMgr: WidgetStateManager
  disabled: boolean
  fragmentId?: string
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

// Default height for Plotly charts
export const DEFAULT_HEIGHT = 450
// Minimum width for Plotly charts
const MIN_WIDTH = 150

/**
 * Parses an SVG path string into separate x and y coordinates.
 *
 * The function takes a single SVG path string as input. This path string should start with 'M'
 * (move to command), followed by pairs of x and y coordinates separated by commas, and optionally
 * end with 'Z' to close the path. Each pair of coordinates is separated by 'L' (line to command).
 *
 * Example Input:
 * "M4.016412414518674,8.071685352641575L4.020620725933719,7.8197516509841165Z"
 *
 * Example Output:
 * {
 *   x: [4.016412414518674, 4.020620725933719],
 *   y: [8.071685352641575, 7.8197516509841165]
 * }
 *
 * @param {string} pathData - The SVG path string to be parsed.
 * @returns {SelectionRange} An object containing two arrays: `x` for all x coordinates and `y` for all y coordinates.
 */
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

function applyTheming(
  element: PlotlyChartProto,
  plotlyFigure: PlotlyFigureType,
  theme: EmotionTheme
): PlotlyFigureType {
  const spec = JSON.parse(
    replaceTemporaryColors(JSON.stringify(plotlyFigure), theme, element.theme)
  )
  if (element.theme === "streamlit") {
    applyStreamlitTheme(spec, theme)
  } else {
    // Apply minor theming improvements to work better with Streamlit
    spec.layout = layoutWithThemeDefaults(spec.layout, theme)
  }
  return spec
}

/** Render a Plotly chart from a FigureProto */
function PlotlyFigure({
  element,
  width,
  height,
  isFullScreen,
  widgetMgr,
  disabled,
  fragmentId,
}: PlotlyChartProps): ReactElement {
  const theme: EmotionTheme = useTheme()
  const [initialFigure] = useState(() => {
    return JSON.parse((element.figure as FigureProto).spec)
  })

  const [plotlyFigure, setPlotlyFigure] = useState(() => {
    const initialFigureState = widgetMgr.getElementState(element.id, "figure")
    if (initialFigureState) {
      return initialFigureState
    }
    // TODO(lukasmasuch) check if figure is empty?
    return applyTheming(element, initialFigure, theme)
  })

  const [plotlyConfig] = useState(() => {
    return JSON.parse((element.figure as FigureProto).config)
  })

  React.useEffect(() => {
    const spec = applyTheming(element, plotlyFigure, theme)
    // https://plotly.com/javascript/reference/layout/#layout-clickmode
    // This allows single selections and shift click to add / remove selections
    if (element.isSelectEnabled) {
      spec.layout.clickmode = "event+select"
      spec.layout.hovermode = "closest"
    } else {
      spec.layout.clickmode = initialFigure.layout.clickmode
      spec.layout.hovermode = initialFigure.layout.hovermode
    }
    setPlotlyFigure(spec)
    // Adding plotlyFigure to the dependencies
    // array would cause an infinite update loop
    /* eslint-disable react-hooks/exhaustive-deps */
  }, [theme, element.theme, element.id, element.isSelectEnabled])

  let calculatedWidth = element.useContainerWidth
    ? Math.max(width, MIN_WIDTH)
    : initialFigure.layout.width

  let calculatedHeight = initialFigure.layout.height
  if (isFullScreen) {
    calculatedWidth = width
    calculatedHeight = height
  }

  if (
    plotlyFigure.layout.height !== calculatedHeight ||
    plotlyFigure.layout.width !== calculatedWidth
  ) {
    // Update the figure with the new height and width
    setPlotlyFigure({
      ...plotlyFigure,
      layout: {
        ...plotlyFigure.layout,
        height: calculatedHeight,
        width: calculatedWidth,
      },
    })
  }

  const handleSelect = (event: Readonly<Plotly.PlotSelectionEvent>): void => {
    const returnValue: any = { select: {} }
    const pointIndices: number[] = []
    const selectedBoxes: Selection[] = []
    const selectedLassos: Selection[] = []
    const selectedPoints: Array<any> = []

    // event.selections doesn't show up in the PlotSelectionEvent
    // @ts-expect-error
    const { selections } = event
    if (event.points.length === 0 && selections && selections.length === 0) {
      return
    }

    event.points.forEach(function (point: any) {
      selectedPoints.push({
        ...point,
        legendgroup: point.data.legendgroup || undefined,
        // Remove data and full data as they have been deemed to be unnecessary data overhead
        data: undefined,
        fullData: undefined,
      })
      pointIndices.push(point.pointIndex)
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
    }

    returnValue.select.box = selectedBoxes
    returnValue.select.lasso = selectedLassos
    returnValue.select.points = returnValue.select.points.map((point: any) =>
      keysToSnakeCase(point)
    )
    widgetMgr.setStringValue(
      element,
      JSON.stringify(returnValue),
      { fromUi: true },
      fragmentId
    )
  }

  const reset = useCallback((): void => {
    widgetMgr.setStringValue(element, "{}", { fromUi: true }, fragmentId)

    // Reset the selection info within the plotly figure
    setPlotlyFigure({
      ...plotlyFigure,
      data: plotlyFigure.data.map((trace: any) => {
        return {
          ...trace,
          selectedpoints: [],
        }
      }),
      layout: {
        ...plotlyFigure.layout,
        selections: [],
      },
    })
  }, [plotlyFigure, widgetMgr, element, fragmentId])

  // This is required for the form clearing functionality:
  React.useEffect(() => {
    const formClearHelper = new FormClearHelper()
    formClearHelper.manageFormClearListener(widgetMgr, element.formId, reset)

    return () => {
      formClearHelper.disconnect()
    }
  }, [element.formId, reset, widgetMgr])

  return (
    <Plot
      key={isFullScreen ? "fullscreen" : "original"}
      className="stPlotlyChart"
      data={plotlyFigure.data}
      layout={plotlyFigure.layout}
      config={plotlyConfig}
      frames={plotlyFigure.frames}
      onSelected={
        element.isSelectEnabled || !disabled ? handleSelect : () => {}
      }
      onDoubleClick={element.isSelectEnabled || !disabled ? reset : () => {}}
      onDeselect={element.isSelectEnabled || !disabled ? reset : () => {}}
      onInitialized={figure => {
        widgetMgr.setElementState(element.id, "figure", figure)
      }}
      onUpdate={figure => {
        widgetMgr.setElementState(element.id, "figure", figure)
        setPlotlyFigure(figure)
      }}
    />
  )
}

export function PlotlyChart({
  width,
  element,
  height,
  isFullScreen,
  widgetMgr,
  disabled,
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
          isFullScreen={isFullScreen}
          widgetMgr={widgetMgr}
          disabled={disabled}
        />
      )
    default:
      throw new Error(`Unrecognized PlotlyChart type: ${element.chart}`)
  }
}

export default withFullScreenWrapper(PlotlyChart)
