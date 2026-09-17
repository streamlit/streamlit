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

import { isEqual } from "lodash-es"
import type * as Plotly from "plotly.js"

import { PlotlyChart as PlotlyChartProto } from "@streamlit/protobuf"

import type { EmotionTheme } from "~lib/theme/types"
import type { Figure as PlotlyFigureType } from "~lib/util/reactPlotlyCompat"
import { keysToSnakeCase, notNullOrUndefined } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

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

interface PlotlySelectionEventWithSelections
  extends Plotly.PlotSelectionEvent {
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
  )
  if (chartTheme === "streamlit") {
    applyStreamlitTheme(spec, theme)
  } else {
    // Apply minor theming improvements to work better with Streamlit
    spec.layout = layoutWithThemeDefaults(spec.layout, theme)
  }
  return spec
}

const CARTESIAN_AXIS_KEY_PATTERN = /^(x|y)axis\d*$/

/**
 * True for Plotly cartesian axis layout keys such as `xaxis`, `yaxis2`.
 *
 * @param key - A `layout` object key
 * @returns Whether the key names a cartesian x or y axis
 */
function isCartesianAxisKey(key: string): boolean {
  return CARTESIAN_AXIS_KEY_PATTERN.test(key)
}

function isAxisRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isConstrainedCartesianAxis(axis: Record<string, unknown>): boolean {
  // Plotly uses `scaleanchor: false` to unlink axes; that is not constrained.
  return (
    (axis.scaleanchor !== undefined && axis.scaleanchor !== false) ||
    axis.constrain === "domain"
  )
}

const MAP_VIEW_FIELDS = ["center", "zoom", "bearing", "pitch", "projection"]
// Relative to the range window so both sub-1e-6 scientific axes and
// large-offset (timestamp-like) windows persist real pans/zooms.
const RANGE_EPSILON = 1e-6

function numericRangeSpan(range: unknown[]): number {
  const numbers = range.filter(
    (value): value is number => typeof value === "number"
  )
  if (numbers.length === 0) {
    return 1e-12
  }
  if (numbers.length === 1) {
    return Math.max(Math.abs(numbers[0]), 1e-12)
  }
  return Math.max(Math.max(...numbers) - Math.min(...numbers), 1e-12)
}

function axisRangeValuesDiffer(a: unknown, b: unknown): boolean {
  if (a === b) {
    return false
  }
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return true
  }
  const span = Math.max(numericRangeSpan(a), numericRangeSpan(b))
  return a.some((value, i) => {
    const other = b[i]
    if (typeof value === "number" && typeof other === "number") {
      return Math.abs(value - other) > RANGE_EPSILON * span
    }
    return !isEqual(value, other)
  })
}

function shouldAdoptAxisRange(previous: unknown, next: unknown): boolean {
  if (next === undefined) {
    return false
  }
  if (previous === undefined) {
    return true
  }
  return axisRangeValuesDiffer(previous, next)
}

function isFullAutorangeReset(autorange: unknown): boolean {
  // Only these values autorange both ends. `"min"` / `"max"` /
  // `"min reversed"` / `"max reversed"` keep the fixed endpoint in `range`.
  return autorange === true || autorange === "reversed"
}

function sanitizeSelections(selections: unknown): unknown {
  if (!Array.isArray(selections)) {
    return selections
  }
  return selections.map(selection => {
    if (!isAxisRecord(selection)) {
      return selection
    }
    const nextSelection: Record<string, unknown> = {}
    for (const [field, value] of Object.entries(selection)) {
      // Strip Plotly-private keys (`_inputIndex`, …); keep public styling.
      if (!field.startsWith("_") && value !== undefined) {
        nextSelection[field] = value
      }
    }
    return nextSelection
  })
}

function overlayCartesianAxisInteraction(
  nextLayout: Record<string, unknown>,
  sourceLayout: Record<string, unknown>,
  stripConstrainedDomain: boolean
): void {
  for (const key of Object.keys(sourceLayout)) {
    if (!isCartesianAxisKey(key)) {
      continue
    }
    const sourceAxis = sourceLayout[key]
    if (!isAxisRecord(sourceAxis)) {
      continue
    }

    const hasInteraction =
      sourceAxis.range !== undefined ||
      sourceAxis.autorange !== undefined ||
      sourceAxis.scaleanchor !== undefined ||
      sourceAxis.constrain !== undefined
    if (!hasInteraction) {
      continue
    }

    const nextAxis = isAxisRecord(nextLayout[key])
      ? { ...nextLayout[key] }
      : {}
    // Plotly autorange is not boolean-only (`"reversed"` on px.imshow, …).
    // Full resets drop `range`. Partial modes keep the fixed endpoint.
    if (isFullAutorangeReset(sourceAxis.autorange)) {
      nextAxis.autorange = sourceAxis.autorange
      delete nextAxis.range
    } else {
      if (sourceAxis.autorange !== undefined) {
        nextAxis.autorange = sourceAxis.autorange
      } else if (sourceAxis.range !== undefined) {
        nextAxis.autorange = false
      }
      if (shouldAdoptAxisRange(nextAxis.range, sourceAxis.range)) {
        nextAxis.range = sourceAxis.range
      }
    }
    if (sourceAxis.scaleanchor !== undefined) {
      nextAxis.scaleanchor = sourceAxis.scaleanchor
    }
    if (sourceAxis.constrain !== undefined) {
      nextAxis.constrain = sourceAxis.constrain
    }
    // Never copy live `domain`. Only strip when there is no owned previous
    // layout, so authored facet / subplot domains are kept on remount.
    if (stripConstrainedDomain && isConstrainedCartesianAxis(nextAxis)) {
      delete nextAxis.domain
    }
    nextLayout[key] = nextAxis
  }
}

function overlayViewState(
  nextLayout: Record<string, unknown>,
  sourceLayout: Record<string, unknown>
): void {
  const sourceScene = sourceLayout.scene
  if (isAxisRecord(sourceScene) && sourceScene.camera !== undefined) {
    const nextScene = isAxisRecord(nextLayout.scene)
      ? { ...nextLayout.scene }
      : {}
    nextScene.camera = sourceScene.camera
    nextLayout.scene = nextScene
  }

  for (const key of ["mapbox", "map", "geo"]) {
    const sourceView = sourceLayout[key]
    if (!isAxisRecord(sourceView)) {
      continue
    }
    const nextView = isAxisRecord(nextLayout[key])
      ? { ...nextLayout[key] }
      : {}
    for (const field of MAP_VIEW_FIELDS) {
      if (sourceView[field] !== undefined) {
        nextView[field] = sourceView[field]
      }
    }
    nextLayout[key] = nextView
  }

  if (sourceLayout.hiddenlabels !== undefined) {
    if (!isEqual(sourceLayout.hiddenlabels, nextLayout.hiddenlabels)) {
      nextLayout.hiddenlabels = sourceLayout.hiddenlabels
    }
  } else if (nextLayout.hiddenlabels !== undefined) {
    nextLayout.hiddenlabels = []
  }

  if (sourceLayout.selections !== undefined) {
    nextLayout.selections = sanitizeSelections(sourceLayout.selections)
  } else if (nextLayout.selections !== undefined) {
    // `onDeselect` does not rewrite the figure. If Plotly omits the key
    // instead of sending `[]`, drop persisted box/lasso shapes.
    nextLayout.selections = []
  }

  // Adopt modebar / Plotly dragmode (pan, select, lasso, zoom, orbit, …).
  // clickmode / hovermode stay React-owned: Streamlit’s selection effects set
  // those, and re-feeding Plotly’s live values fights those effects.
  if (sourceLayout.dragmode !== undefined) {
    nextLayout.dragmode = sourceLayout.dragmode
  }
}

type PlotlyFigureLike = {
  data: Plotly.Data[]
  layout?: Record<string, unknown>
  frames?: Plotly.Frame[] | null
}

/**
 * Copy a Plotly-reported figure into React-owned state without re-feeding
 * computed size, constrained-axis domain, or automargin output into
 * `Plotly.react`.
 *
 * When `previousLayout` is provided, start from that React-owned layout and
 * overlay only interaction fields: cartesian axis `range` / `autorange`
 * (including zoom reset), `scaleanchor` / `constrain`, `scene.camera`,
 * map/geo view, `hiddenlabels`, `selections`, and `dragmode`. Any other
 * Plotly-reported layout is intentionally discarded — including polar/ternary
 * view, slider/updatemenu index, and `config.editable` annotation/shape
 * edits. Spreading Plotly's live layout would copy constraint-computed
 * `domain` (and other internals) and, because react-plotly.js compares
 * `layout` by reference, retrigger `Plotly.react` in a loop. When omitted,
 * start from the saved figure and strip computed constrained-axis `domain`.
 * Remount recovery should pass the recovered layout as `previousLayout` so
 * authored subplot domains are kept.
 *
 * Plotly's live `figure.layout` is mutated in place; this always returns a
 * new layout (and copied axis objects) and leaves `data` shared.
 *
 * `previousLayout` must not be Plotly's live `gd.layout`. After
 * `assignLayoutInPlace`, those can be the same object; pass the last
 * sanitized copy instead so computed `domain` / automargin `margin` are
 * not treated as Streamlit-owned.
 *
 * @param figure - Figure from `onUpdate` / `onInitialized` / remount state
 * @param ownedSize - Container width/height owned by Streamlit
 * @param previousLayout - Last sanitized React-owned layout. When provided,
 *   restore its `margin` — including no layout-level margin, so
 *   template/theme margin is used instead of Plotly automargin output. When
 *   omitted, keep the figure's margin and strip constrained-axis `domain`.
 * @returns A shallow-copied figure safe to pass back to `Plot`
 */
export function sanitizePlotlyFigureForReact(
  figure: PlotlyFigureLike,
  ownedSize: { width?: number; height?: number },
  previousLayout?: Partial<Plotly.Layout> | Record<string, unknown>
): PlotlyFigureType {
  const sourceLayout = figure.layout ?? {}
  const baseLayout = (previousLayout ?? sourceLayout) as Record<
    string,
    unknown
  >
  const nextLayout: Record<string, unknown> = {
    ...baseLayout,
    width: ownedSize.width,
    height: ownedSize.height,
    autosize: false,
  }

  overlayCartesianAxisInteraction(
    nextLayout,
    sourceLayout,
    previousLayout === undefined
  )
  overlayViewState(nextLayout, sourceLayout)

  if (previousLayout !== undefined) {
    if (previousLayout.margin !== undefined) {
      nextLayout.margin = previousLayout.margin
    } else {
      delete nextLayout.margin
    }
  }

  return {
    data: figure.data,
    frames: figure.frames ?? null,
    layout: nextLayout as Partial<Plotly.Layout>,
  }
}

/**
 * Copy `source` onto `target` while keeping `target`'s object identity.
 *
 * react-plotly.js skips `Plotly.react` when the `layout` prop is unchanged by
 * reference. Scroll-zoom (`plotly_relayouting`) already applied the new range
 * on the graph div; replacing the layout object would retrigger `Plotly.react`
 * and revert or interrupt the zoom.
 *
 * After the first update, `target` may simultaneously be React state, the
 * `layout` prop of `Plot`, and Plotly's live `gd.layout`. Keys omitted from
 * `source` are deleted so sanitizer-dropped fields (`polar`, computed
 * `margin`, stale `selections`, …) cannot leak into a later `Plotly.react`.
 *
 * @param target - Layout currently passed to `Plot` (may be live `gd.layout`)
 * @param source - Sanitized layout to copy
 * @returns `target`
 */
export function assignLayoutInPlace(
  target: Partial<Plotly.Layout>,
  source: Partial<Plotly.Layout>
): Partial<Plotly.Layout> {
  const targetRecord = target as Record<string, unknown>
  const sourceRecord = source as Record<string, unknown>
  // Selection effects write clickmode/hovermode onto the Plot layout; the
  // sanitizer overlay does not copy those fields, so they must not be deleted.
  const preserveWhenAbsent = new Set(["clickmode", "hovermode"])
  for (const key of Object.keys(targetRecord)) {
    if (!Object.hasOwn(sourceRecord, key) && !preserveWhenAbsent.has(key)) {
      // oxlint-disable-next-line typescript/no-dynamic-delete -- omitted sanitizer keys must not remain on Plotly's live layout
      delete targetRecord[key]
    }
  }
  Object.assign(target, source)
  return target
}

/**
 * True when the sanitized figure differs from React-owned state enough to
 * persist. Callers may still reuse the current `layout` object identity so
 * react-plotly.js does not call `Plotly.react`.
 *
 * `prev.layout` must be a non-aliased snapshot (the last sanitizer output).
 * After `assignLayoutInPlace`, Plotly mutates the React `layout` in place, so
 * comparing against that live object would miss dragmode / zoom-reset updates
 * and skip the `setPlotlyFigure` that selection `clickmode` effects need.
 *
 * @param prev - Current React-owned figure (`layout` = last sanitized copy)
 * @param next - Candidate sanitized figure
 * @returns Whether interaction state should be written back
 */
export function plotlyFigureNeedsReactStateUpdate(
  prev: PlotlyFigureLike,
  next: PlotlyFigureLike
): boolean {
  if ((prev.frames ?? null) !== (next.frames ?? null)) {
    return true
  }
  if (!isEqual(prev.layout, next.layout)) {
    return true
  }
  if (prev.data === next.data) {
    return false
  }
  return !isEqual(
    prev.data.map(
      trace => (trace as { selectedpoints?: unknown }).selectedpoints
    ),
    next.data.map(
      trace => (trace as { selectedpoints?: unknown }).selectedpoints
    )
  )
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
  const selectedPoints: Array<Record<string, unknown>> = []

  const { selections, points } =
    event as Readonly<PlotlySelectionEventWithSelections>

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

/**
 * Handles click events from hierarchical charts (treemap, sunburst) that don't
 * emit plotly_selected events but do emit plotly_click events.
 * The click data is sent as selection state to maintain API consistency.
 *
 * @param event The Plotly click event
 * @param widgetMgr The widget manager
 * @param element The PlotlyChartProto element
 * @param fragmentId The fragment id
 */
export function handleClickEvent(
  event: Readonly<Plotly.PlotMouseEvent>,
  widgetMgr: WidgetStateManager,
  element: PlotlyChartProto,
  fragmentId: string | undefined
): void {
  if (!event?.points?.length) {
    return
  }

  const point = event.points[0] as PlotlyHierarchicalPoint

  // Check if this is a hierarchical chart click (treemap/sunburst)
  // These charts have 'id' and 'parent' properties in their click events
  if (point.id === undefined || point.parent === undefined) {
    // Not a treemap/sunburst click, ignore
    return
  }

  const selectionState: PlotlyWidgetState = {
    selection: {
      points: [
        keysToSnakeCase({
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
        }),
      ],
      point_indices: notNullOrUndefined(point.pointNumber)
        ? [point.pointNumber]
        : [],
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
