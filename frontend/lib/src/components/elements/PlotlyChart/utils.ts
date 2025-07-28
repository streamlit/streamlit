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

import { Figure as PlotlyFigureType } from "react-plotly.js"

import { PlotlyChart as PlotlyChartProto } from "@streamlit/protobuf"

import { EmotionTheme } from "~lib/theme"
import { keysToSnakeCase, notNullOrUndefined } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  applyStreamlitTheme,
  layoutWithThemeDefaults,
  replaceTemporaryColors,
} from "./CustomTheme"

// Copied and Pasted from Plotly type def
export interface SelectionRange {
  x: number[]
  y: number[]
}

export interface PlotlySelection extends SelectionRange {
  xref: string
  yref: string
}

// This is the state that is sent to the backend
// This needs to be the same structure that is also defined
// in the Python code. Uses snake case to be compatible with the
// Python naming conventions.
export interface PlotlyWidgetState {
  selection: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    points: Array<any>
    point_indices: number[]
    box: PlotlySelection[]
    lasso: PlotlySelection[]
  }
}

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

/**
 * Parses a box selection object into separate x and y coordinates.
 *
 * The function takes a box selection object as input. This object should contain the following
 * fields: x0, x1, y0, y1. These fields represent the x and y coordinates of the box selection
 * in the plotly chart.
 *
 * Example Input:
 * {
 *   x0: 0.1,
 *   x1: 0.2,
 *   y0: 0.3,
 *   y1: 0.4
 * }
 *
 * Example Output:
 * {
 *   x: [0.1, 0.2],
 *   y: [0.3, 0.4]
 * }
 *
 * @param {Object} selection - The box selection object to be parsed.
 * @returns {SelectionRange} An object containing two arrays: `x` for all x coordinates and `y` for all y coordinates.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
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

/**
 * Apply theming to the Plotly figure.
 *
 * @param plotlyFigure The Plotly figure to apply theming to
 * @param chartTheme The theme of the chart (streamlit or empty string)
 * @param theme The current theme of the app
 * @returns The Plotly figure with theming applied
 */
export function applyTheming(
  plotlyFigure: PlotlyFigureType,
  chartTheme: string,
  theme: EmotionTheme
): PlotlyFigureType {
  const spec = JSON.parse(
    replaceTemporaryColors(JSON.stringify(plotlyFigure), theme, chartTheme)
  )
  if (chartTheme === "streamlit") {
    applyStreamlitTheme(spec, theme)
  } else {
    // Apply minor theming improvements to work better with Streamlit
    spec.layout = layoutWithThemeDefaults(spec.layout, theme)
  }
  return spec
}

/**
 * Handles the selection event from Plotly and sends the selection state to the backend.
 * The selection state is sent as a stringified JSON object.
 *
 * @param event The Plotly selection event
 * @param widgetMgr The widget manager
 * @param element The PlotlyChartProto element
 * @param fragmentId The fragment id
 */
export function handleSelection(
  event: Readonly<Plotly.PlotSelectionEvent>,
  widgetMgr: WidgetStateManager,
  element: PlotlyChartProto,
  fragmentId: string | undefined
): void {
  if (!event) {
    return
  }

  const selectionState: PlotlyWidgetState = {
    selection: {
      points: [],
      point_indices: [],
      box: [],
      lasso: [],
    },
  }
  // Use a set for point indices since all numbers should be unique:
  const selectedPointIndices = new Set<number>()
  const selectedBoxes: PlotlySelection[] = []
  const selectedLassos: PlotlySelection[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  const selectedPoints: Array<any> = []

  // event.selections doesn't show up in the PlotSelectionEvent
  // @ts-expect-error
  const { selections, points } = event

  if (points) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    points.forEach(function (point: any) {
      selectedPoints.push({
        ...point,
        legendgroup: point.data.legendgroup || undefined,
        // Remove data and full data as they have been deemed to be unnecessary data overhead
        data: undefined,
        fullData: undefined,
      })
      if (notNullOrUndefined(point.pointIndex)) {
        selectedPointIndices.add(point.pointIndex)
      }

      // If pointIndices is present (e.g. selection on histogram chart),
      // add all of them to the set
      if (
        notNullOrUndefined(point.pointIndices) &&
        point.pointIndices.length > 0
      ) {
        point.pointIndices.forEach((item: number) =>
          selectedPointIndices.add(item)
        )
      }
    })
  }

  if (selections) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    selections.forEach((selection: any) => {
      // box selection
      if (selection.type === "rect") {
        const xAndy = parseBoxSelection(selection)
        const returnSelection: PlotlySelection = {
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
        const returnSelection: PlotlySelection = {
          xref: selection.xref,
          yref: selection.yref,
          x: xAndy.x,
          y: xAndy.y,
        }
        selectedLassos.push(returnSelection)
      }
    })
  }

  selectionState.selection.point_indices = Array.from(selectedPointIndices)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  selectionState.selection.points = selectedPoints.map((point: any) =>
    keysToSnakeCase(point)
  )

  selectionState.selection.box = selectedBoxes
  selectionState.selection.lasso = selectedLassos

  if (
    selectionState.selection.box.length > 0 &&
    !element.selectionMode.includes(PlotlyChartProto.SelectionMode.BOX)
  ) {
    // If box selection is not activated, we don't want
    // to send any box selection related updates to the frontend
    return
  }

  if (
    selectionState.selection.lasso.length > 0 &&
    !element.selectionMode.includes(PlotlyChartProto.SelectionMode.LASSO)
  ) {
    // If lasso selection is not activated, we don't want
    // to send any lasso selection related updates to the frontend
    return
  }

  const currentSelectionState = widgetMgr.getStringValue(element)
  const newSelectionState = JSON.stringify(selectionState)
  if (currentSelectionState !== newSelectionState) {
    // Only update the widget state if it has changed
    widgetMgr.setStringValue(
      element,
      newSelectionState,
      { fromUi: true },
      fragmentId
    )
  }
}

/**
 * Sends an empty selection state to the backend.
 *
 * @param widgetMgr The widget manager
 * @param element The PlotlyChartProto element
 * @param fragmentId The fragment id
 */
export function sendEmptySelection(
  widgetMgr: WidgetStateManager,
  element: PlotlyChartProto,
  fragmentId: string | undefined
): void {
  const emptySelectionState: PlotlyWidgetState = {
    selection: {
      points: [],
      point_indices: [],
      box: [],
      lasso: [],
    },
  }

  widgetMgr.setStringValue(
    element,
    JSON.stringify(emptySelectionState),
    { fromUi: true },
    fragmentId
  )
}
