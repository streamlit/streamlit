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

import type * as Plotly from "plotly.js"

import { PlotlyChart as PlotlyChartProto } from "@streamlit/protobuf"

import type { EmotionTheme } from "~lib/theme/types"
import type { Figure as PlotlyFigureType } from "~lib/util/reactPlotlyCompat"
import { keysToSnakeCase, notNullOrUndefined } from "~lib/util/utils"
import type { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  applyStreamlitTheme,
  layoutWithThemeDefaults,
  replaceTemporaryColors,
} from "./CustomTheme"

// Copied and Pasted from Plotly type def
interface SelectionRange {
  x: number[]
  y: number[]
}

interface PlotlySelection extends SelectionRange {
  xref: string
  yref: string
}

/**
 * A selection shape from Plotly's selection event.
 * Can be either a box (rect) or lasso (path) selection.
 * Uses Record to allow passing to parseBoxSelection.
 */
interface PlotlySelectionShape extends Record<string, unknown> {
  type: string
  xref: string
  yref: string
  path?: string
}

/**
 * Plotly selection event as emitted at runtime. The upstream type omits
 * `selections` and marks `points` as always present.
 */
interface PlotlySelectionEventWithSelections extends Omit<
  Plotly.PlotSelectionEvent,
  "points"
> {
  points?: Plotly.PlotSelectionEvent["points"]
  selections?: PlotlySelectionShape[]
}

/**
 * Extended point data from Plotly selection events.
 * Plotly's type definitions are incomplete, so we extend PlotDatum
 * with additional properties that exist at runtime.
 */
interface PlotlySelectionPoint extends Plotly.PlotDatum {
  fullData?: unknown
  pointIndices?: number[]
  legendgroup?: string
}

function getLegendGroup(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined
  }
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- blank legend group is omitted
  return (data as { legendgroup?: string }).legendgroup || undefined
}

/**
 * Extended point data for hierarchical chart click events (treemap/sunburst).
 * These charts include additional properties not in the standard PlotDatum.
 */
interface PlotlyHierarchicalPoint extends Plotly.PlotDatum {
  id?: string
  parent?: string
  label?: string
  value?: number
  currentPath?: string
  percentRoot?: number
  percentEntry?: number
  percentParent?: number
}

interface PlotlyHeatmapPoint extends Plotly.PlotDatum {
  z?: unknown
  color?: unknown
  colormodel?: string
}

interface PlotlySankeyEndpoint {
  label?: string
  pointNumber?: number
}

interface PlotlySankeyPoint extends Plotly.PlotDatum {
  label?: string
  value?: number
  source?: PlotlySankeyEndpoint
  target?: PlotlySankeyEndpoint
}

function getTraceType(point: Plotly.PlotDatum): string | undefined {
  const data = point.data as { type?: string } | undefined
  return data?.type
}

function scalarPointIndices(pointNumber: unknown): number[] {
  return typeof pointNumber === "number" ? [pointNumber] : []
}

function sankeyEndpoint(
  endpoint: PlotlySankeyEndpoint | undefined
): Record<string, unknown> | undefined {
  if (!endpoint) {
    return undefined
  }
  return {
    label: endpoint.label,
    pointNumber: endpoint.pointNumber,
  }
}

// This is the state that is sent to the backend
// This needs to be the same structure that is also defined
// in the Python code. Uses snake case to be compatible with the
// Python naming conventions.
interface PlotlyWidgetState {
  selection: {
    points: Array<Record<string, unknown>>
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
export function parseBoxSelection(
  selection: Record<string, unknown>
): SelectionRange {
  const hasRequiredFields =
    "x0" in selection &&
    "x1" in selection &&
    "y0" in selection &&
    "y1" in selection

  if (!hasRequiredFields) {
    return { x: [], y: [] }
  }

  const x: number[] = [selection.x0 as number, selection.x1 as number]
  const y: number[] = [selection.y0 as number, selection.y1 as number]
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
  ) as Record<string, unknown>
  if (chartTheme === "streamlit") {
    applyStreamlitTheme(spec, theme)
  } else {
    // Apply minor theming improvements to work better with Streamlit
    spec.layout = layoutWithThemeDefaults(
      (spec.layout ?? {}) as Record<string, unknown>,
      theme
    )
  }
  return spec as unknown as PlotlyFigureType
}

/**
 * Handles the selection event from Plotly and sends the selection state to the backend.
 * The selection state is sent as a stringified JSON object.
 *
 * @param event The Plotly selection event. Plotly can emit `plotly_selected`
 *   without event data.
 * @param widgetMgr The widget manager
 * @param element The PlotlyChartProto element
 * @param fragmentId The fragment id
 */
export function handleSelection(
  event: Readonly<PlotlySelectionEventWithSelections> | undefined,
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
  const selectedPoints: Array<Record<string, unknown>> = []

  const { selections, points } = event

  if (points) {
    points.forEach(function (point: PlotlySelectionPoint) {
      selectedPoints.push({
        ...point,
        legendgroup: getLegendGroup(point.data),
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
    selections.forEach((selection: PlotlySelectionShape) => {
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
      if (selection.type === "path" && selection.path) {
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
  selectionState.selection.points = selectedPoints.map(
    (point: Record<string, unknown>) => keysToSnakeCase(point)
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
    widgetMgr.setStringValue(element.id, newSelectionState, {
      formId: element.formId,
      fragmentId,
      fromUser: true,
    })
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

  widgetMgr.setStringValue(element.id, JSON.stringify(emptySelectionState), {
    formId: element.formId,
    fragmentId,
    fromUser: true,
  })
}

function writeClickSelection(
  widgetMgr: WidgetStateManager,
  element: PlotlyChartProto,
  fragmentId: string | undefined,
  point: Record<string, unknown>,
  pointIndices: number[]
): void {
  const selectionState: PlotlyWidgetState = {
    selection: {
      points: [keysToSnakeCase(point)],
      point_indices: pointIndices,
      box: [],
      lasso: [],
    },
  }

  const currentSelectionState = widgetMgr.getStringValue(element)
  const newSelectionState = JSON.stringify(selectionState)
  if (currentSelectionState !== newSelectionState) {
    widgetMgr.setStringValue(element.id, newSelectionState, {
      formId: element.formId,
      fragmentId,
      fromUser: true,
    })
  }
}

function mapHierarchicalClick(
  point: PlotlyHierarchicalPoint
): Record<string, unknown> | undefined {
  if (point.id === undefined || point.parent === undefined) {
    return undefined
  }
  return {
    label: point.label,
    id: point.id,
    parent: point.parent,
    value: point.value,
    currentPath: point.currentPath,
    percentRoot: point.percentRoot,
    percentEntry: point.percentEntry,
    percentParent: point.percentParent,
    pointNumber: point.pointNumber,
    curveNumber: point.curveNumber,
  }
}

function mapHeatmapOrImageClick(
  point: PlotlyHeatmapPoint
): Record<string, unknown> | undefined {
  const type = getTraceType(point)
  const pointNumber = point.pointNumber
  const has2dIndex = Array.isArray(pointNumber) && pointNumber.length === 2
  const isHeatmapFamily =
    type === "heatmap" ||
    type === "image" ||
    type === "histogram2d" ||
    (type === undefined &&
      has2dIndex &&
      (point.z !== undefined || point.color !== undefined))
  if (!isHeatmapFamily) {
    return undefined
  }
  return {
    x: point.x,
    y: point.y,
    z: point.z,
    color: point.color,
    colormodel: point.colormodel,
    pointNumber: point.pointNumber,
    curveNumber: point.curveNumber,
  }
}

function mapSankeyClick(
  point: PlotlySankeyPoint
): Record<string, unknown> | undefined {
  const type = getTraceType(point)
  const isSankey =
    type === "sankey" ||
    (type === undefined &&
      (point.source !== undefined ||
        (point.label !== undefined &&
          point.value !== undefined &&
          (point as PlotlyHierarchicalPoint).id === undefined)))
  if (!isSankey) {
    return undefined
  }
  return {
    label: point.label,
    value: point.value,
    pointNumber: point.pointNumber,
    curveNumber: point.curveNumber,
    source: sankeyEndpoint(point.source),
    target: sankeyEndpoint(point.target),
  }
}

/**
 * Handles click events from traces that don't emit plotly_selected events but
 * do emit plotly_click (treemap, sunburst, heatmap, image, Sankey). Scatter and
 * other selectable traces still go through handleSelection. The click data is
 * sent as selection state to maintain API consistency.
 *
 * @param event The Plotly click event, or undefined when Plotly invokes the
 *   callback without event data. A present event includes points.
 * @param widgetMgr The widget manager
 * @param element The PlotlyChartProto element
 * @param fragmentId The fragment id
 */
export function handleClickEvent(
  event: Readonly<Plotly.PlotMouseEvent> | undefined,
  widgetMgr: WidgetStateManager,
  element: PlotlyChartProto,
  fragmentId: string | undefined
): void {
  if (!event?.points.length) {
    return
  }

  const point = event.points[0] as PlotlyHierarchicalPoint &
    PlotlyHeatmapPoint &
    PlotlySankeyPoint

  const hierarchical = mapHierarchicalClick(point)
  if (hierarchical) {
    writeClickSelection(
      widgetMgr,
      element,
      fragmentId,
      hierarchical,
      scalarPointIndices(point.pointNumber)
    )
    return
  }

  const heatmapOrImage = mapHeatmapOrImageClick(point)
  if (heatmapOrImage) {
    // Heatmap/image pointNumber is [row, col]; keep point_indices as list[int].
    writeClickSelection(widgetMgr, element, fragmentId, heatmapOrImage, [])
    return
  }

  const sankey = mapSankeyClick(point)
  if (sankey) {
    writeClickSelection(
      widgetMgr,
      element,
      fragmentId,
      sankey,
      scalarPointIndices(point.pointNumber)
    )
  }
}
