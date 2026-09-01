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

import { useCallback, useMemo, useRef } from "react"

import { debounce, isPlainObject } from "lodash-es"
import { getLogger } from "loglevel"

import { EChartsChart as EChartsChartProto } from "@streamlit/protobuf"

import { WidgetInfo, WidgetStateManager } from "~lib/WidgetStateManager"

import { EChartsOptionObject } from "./CustomTheme"

const LOG = getLogger("useEChartsSelections")

/**
 * Debounce time (ms) for widget-state updates. Coalesces a single gesture's
 * point (``selectchanged``) and box/lasso (``brushEnd``) events into exactly
 * one update. ``brushSelected`` only refreshes the hit-test cache so a pause
 * mid-drag cannot emit new points with the previous region's geometry.
 */
const DEBOUNCE_TIME_MS = 150

/** Frontend-only element-state key under which raw brush areas are persisted. */
const BRUSH_AREAS_STATE_KEY = "brushAreas"
/**
 * Element-state key for the last brush hit-test points (``seriesIndex`` /
 * ``dataIndex`` pairs) so a remount can seed ``latestBrushPoints``. Without
 * this, a post-remount ``selectchanged`` would emit restored ``box``/``lasso``
 * geometry with an empty ``points`` channel.
 */
const BRUSH_POINTS_STATE_KEY = "brushPoints"
/**
 * Frontend-only element-state key under which the natively selected points are
 * persisted (as ECharts ``selectchanged`` ``selected`` entries) so they can be
 * re-applied visually after an option-replacing ``setOption`` or a remount.
 */
const SELECTED_POINTS_STATE_KEY = "selectedPoints"

/**
 * The shared selection-state contract serialized to the widget state. Keys are
 * snake_case to match the Python serde.
 */
interface EChartsSelectionState {
  points: Array<Record<string, unknown>>
  point_indices: number[]
  box: Array<Record<string, unknown>>
  lasso: Array<Record<string, unknown>>
}

/** A minimal view of the ECharts instance used for selection wiring. */
export interface EChartsSelectionInstance {
  on(eventName: string, handler: (params: unknown) => void): void
  off(eventName: string, handler?: (params: unknown) => void): void
  dispatchAction(payload: Record<string, unknown>): void
  convertFromPixel(
    finder: Record<string, unknown> | string,
    value: number[]
  ): number | number[]
  getOption(): unknown
  isDisposed(): boolean
  /** The underlying zrender layer, which receives every canvas-level event. */
  getZr(): {
    on(eventName: string, handler: (params: unknown) => void): void
    off(eventName: string, handler?: (params: unknown) => void): void
  }
}

/** A single entry of the ``selectchanged`` event's ``selected`` array. */
interface SelectedEntry {
  seriesIndex: number
  dataType?: string
  dataIndex: number[]
}

interface SelectChangedParams {
  selected?: SelectedEntry[]
}

interface BrushSelectedItem {
  seriesIndex?: number
  dataIndex?: number[]
}

interface BrushSelectedParams {
  batch?: Array<{ selected?: BrushSelectedItem[] }>
}

interface BrushArea {
  brushType?: string
  coordRange?: unknown
  range?: unknown
  panelId?: string
  xAxisIndex?: number
  yAxisIndex?: number
}

interface BrushEndParams {
  areas?: BrushArea[]
}

export interface UseEChartsSelectionsOutput {
  /**
   * Whether the chart is a selection widget (``on_select`` is not ``"ignore"``,
   * i.e. the element has an ID).
   */
  isSelectionActivated: boolean
  /**
   * Prepare the option for rendering. Streamlit does not inject any selection
   * config — selections are whatever the user configured in their spec
   * (``selectedMode`` on a series, a ``brush`` component). For display-only
   * charts this only resets the misleading ``"pointer"`` cursor; for selection
   * widgets it returns the option unchanged.
   */
  configureSelectionOption: (
    option: EChartsOptionObject
  ) => EChartsOptionObject
  /**
   * Bind selection handlers (``selectchanged`` / brush / double-click) to a
   * chart instance. Returns a cleanup function that removes the handlers. A
   * no-op for display-only charts.
   */
  bindSelections: (chart: EChartsSelectionInstance) => () => void
  /**
   * Re-apply the persisted selection (natively selected points and brush areas)
   * after an option-replacing ``setOption`` or a remount, keeping the visible
   * selection in sync with the widget state.
   */
  restoreSelection: (chart: EChartsSelectionInstance) => void
  /** Clear the selection (widget state + persisted selection element state). */
  onFormCleared: () => void
}

const EMPTY_SELECTION: EChartsSelectionState = {
  points: [],
  point_indices: [],
  box: [],
  lasso: [],
}

/**
 * Build a rich point entry for a natively selected data item.
 *
 * ``selectchanged`` only reports ``seriesIndex``/``dataIndex``, so the series
 * type/name and the item's name/value/data are looked up (best effort) from the
 * chart's resolved option. For dataset-driven series (no inline ``data``) the
 * indices are always present while name/value stay ``undefined``.
 */
function buildPointFromIndex(
  resolvedOption: Record<string, unknown> | null,
  seriesIndex: number,
  dataIndex: number
): Record<string, unknown> {
  const seriesList = resolvedOption?.series
  const series = Array.isArray(seriesList)
    ? seriesList[seriesIndex]
    : undefined
  const seriesObject = isPlainObject(series)
    ? (series as Record<string, unknown>)
    : undefined

  const dataArray = seriesObject?.data
  const dataItem = Array.isArray(dataArray) ? dataArray[dataIndex] : undefined

  let name: unknown
  let value: unknown
  if (isPlainObject(dataItem)) {
    const item = dataItem as Record<string, unknown>
    name = item.name
    value = item.value
  } else if (dataItem !== undefined) {
    value = dataItem
  }

  return {
    component_type: "series",
    series_type: seriesObject?.type,
    series_index: seriesIndex,
    series_name: seriesObject?.name,
    data_index: dataIndex,
    name,
    value,
    data: dataItem,
  }
}

/** Resolve the chart's current option as a plain object (or ``null``). */
function resolveChartOption(
  chart: EChartsSelectionInstance
): Record<string, unknown> | null {
  const chartOption = chart.getOption()
  return isPlainObject(chartOption)
    ? (chartOption as Record<string, unknown>)
    : null
}

/**
 * Expand ``selectchanged`` ``selected`` entries into enriched point objects and
 * their flat data indices.
 */
function buildPointsFromEntries(
  resolvedOption: Record<string, unknown> | null,
  entries: SelectedEntry[]
): { points: Array<Record<string, unknown>>; indices: number[] } {
  const points: Array<Record<string, unknown>> = []
  const indices: number[] = []
  for (const entry of entries) {
    for (const dataIndex of entry.dataIndex ?? []) {
      points.push(
        buildPointFromIndex(resolvedOption, entry.seriesIndex, dataIndex)
      )
      indices.push(dataIndex)
    }
  }
  return { points, indices }
}

/**
 * Merge the native-selection and brush point channels into a single
 * de-duplicated union keyed by ``series_index`` + ``data_index``. Native
 * (richer) entries win when the same item is both natively selected and inside a
 * brushed region, so ``points`` never contains the same data item twice.
 */
function mergePointChannels(
  nativePoints: Array<Record<string, unknown>>,
  nativeIndices: number[],
  brushPoints: Array<Record<string, unknown>>,
  brushIndices: number[]
): { points: Array<Record<string, unknown>>; pointIndices: number[] } {
  const points: Array<Record<string, unknown>> = []
  const pointIndices: number[] = []
  const seen = new Set<string>()
  const append = (
    channelPoints: Array<Record<string, unknown>>,
    channelIndices: number[]
  ): void => {
    channelPoints.forEach((point, index) => {
      const key = JSON.stringify([point.series_index, point.data_index])
      if (seen.has(key)) {
        return
      }
      seen.add(key)
      points.push(point)
      pointIndices.push(channelIndices[index])
    })
  }
  append(nativePoints, nativeIndices)
  append(brushPoints, brushIndices)
  return { points, pointIndices }
}

/**
 * Dispatch a native ``select``/``unselect`` action for each persisted point
 * entry. Used to re-apply (``select``) or clear (``unselect``) the visible point
 * selection after an option-replacing ``setOption`` or a remount.
 */
function dispatchPointSelection(
  chart: EChartsSelectionInstance,
  entries: SelectedEntry[],
  action: "select" | "unselect"
): void {
  for (const entry of entries) {
    try {
      chart.dispatchAction({
        type: action,
        seriesIndex: entry.seriesIndex,
        dataIndex: entry.dataIndex,
        ...(entry.dataType ? { dataType: entry.dataType } : {}),
      })
    } catch (error) {
      LOG.warn(`Failed to ${action} persisted point selection`, error)
    }
  }
}

/**
 * Try to convert a pixel-space brush range into data-space coordinates. Returns
 * ``null`` when the coordinate system can't be resolved so the caller can fall
 * back to raw pixels.
 *
 * ``gridIndex`` selects the coordinate system to convert against (derived from
 * the brush area's ``panelId`` or axis index), so multi-grid charts convert
 * against the grid the brush was drawn on rather than always the first one.
 */
function convertPixelRange(
  chart: EChartsSelectionInstance,
  area: BrushArea,
  gridIndex: number
): { x: number[]; y: number[] } | null {
  const range = area.range
  if (!Array.isArray(range)) {
    return null
  }
  const finder = { gridIndex }
  try {
    if (area.brushType === "polygon") {
      const xs: number[] = []
      const ys: number[] = []
      for (const point of range as number[][]) {
        const dataPoint = chart.convertFromPixel(finder, point)
        if (!Array.isArray(dataPoint)) {
          return null
        }
        xs.push(dataPoint[0])
        ys.push(dataPoint[1])
      }
      return { x: xs, y: ys }
    }

    if (area.brushType === "lineX" || area.brushType === "lineY") {
      const range1d = range as number[]
      if (range1d.length < 2 || typeof range1d[0] !== "number") {
        return null
      }
      if (area.brushType === "lineX") {
        const start = chart.convertFromPixel(finder, [range1d[0], 0])
        const end = chart.convertFromPixel(finder, [range1d[1], 0])
        if (!Array.isArray(start) || !Array.isArray(end)) {
          return null
        }
        return { x: [start[0], end[0]], y: [] }
      }
      const start = chart.convertFromPixel(finder, [0, range1d[0]])
      const end = chart.convertFromPixel(finder, [0, range1d[1]])
      if (!Array.isArray(start) || !Array.isArray(end)) {
        return null
      }
      return { x: [], y: [start[1], end[1]] }
    }

    const [xRange, yRange] = range as number[][]
    const corner0 = chart.convertFromPixel(finder, [xRange[0], yRange[0]])
    const corner1 = chart.convertFromPixel(finder, [xRange[1], yRange[1]])
    if (!Array.isArray(corner0) || !Array.isArray(corner1)) {
      return null
    }
    return { x: [corner0[0], corner1[0]], y: [corner0[1], corner1[1]] }
  } catch (error) {
    LOG.warn("Failed to convert brush pixel range to data coordinates", error)
    return null
  }
}

/**
 * Look up ``gridIndex`` on the axis at ``axisIndex``. ECharts defaults a
 * missing ``gridIndex`` to 0, so axis index is never used as a grid index.
 * Returns ``undefined`` when the axis list does not contain that index.
 */
function gridIndexFromAxis(
  axes: unknown,
  axisIndex: number
): number | undefined {
  const list = Array.isArray(axes) ? axes : axes ? [axes] : []
  if (axisIndex < 0 || axisIndex >= list.length) {
    return undefined
  }
  const axis = list[axisIndex]
  if (!isPlainObject(axis)) {
    return 0
  }
  const gridIndex = (axis as Record<string, unknown>).gridIndex
  return typeof gridIndex === "number" ? gridIndex : 0
}

/**
 * Resolve the grid a brush area belongs to.
 *
 * Prefer ECharts' ``panelId`` (``"grid--N"``). ``xAxisIndex`` / ``yAxisIndex``
 * are axis indexes, not grid indexes — look up ``gridIndex`` on that axis in
 * the option. Fall back to grid 0 when neither is available.
 */
function resolveGridIndex(
  area: BrushArea,
  chart: EChartsSelectionInstance
): number {
  if (typeof area.panelId === "string") {
    const match = /grid--(\d+)/.exec(area.panelId)
    if (match) {
      return Number(match[1])
    }
  }

  const option = resolveChartOption(chart)
  if (option) {
    if (typeof area.xAxisIndex === "number") {
      const fromAxis = gridIndexFromAxis(option.xAxis, area.xAxisIndex)
      if (fromAxis !== undefined) {
        return fromAxis
      }
    }
    if (typeof area.yAxisIndex === "number") {
      const fromAxis = gridIndexFromAxis(option.yAxis, area.yAxisIndex)
      if (fromAxis !== undefined) {
        return fromAxis
      }
    }
  }

  return 0
}

/** Convert a single brush area into a serializable selection item. */
function areaToSelectionItem(
  chart: EChartsSelectionInstance,
  area: BrushArea
): Record<string, unknown> {
  const gridIndex = resolveGridIndex(area, chart)
  const coordRange = area.coordRange

  if (Array.isArray(coordRange)) {
    if (area.brushType === "polygon") {
      const points = coordRange as number[][]
      return {
        x: points.map(point => point[0]),
        y: points.map(point => point[1]),
        grid_index: gridIndex,
      }
    }
    if (area.brushType === "rect") {
      const [xRange, yRange] = coordRange as number[][]
      return { x: xRange, y: yRange, grid_index: gridIndex }
    }
    // lineX / lineY selections carry a single 1D range on that axis.
    if (area.brushType === "lineY") {
      return { x: [], y: coordRange as number[], grid_index: gridIndex }
    }
    return { x: coordRange as number[], y: [], grid_index: gridIndex }
  }

  const converted = convertPixelRange(chart, area, gridIndex)
  if (converted) {
    return { ...converted, grid_index: gridIndex }
  }

  // Last resort: keep the raw pixel range so the state stays inspectable.
  return {
    range: Array.isArray(area.range) ? area.range : [],
    grid_index: gridIndex,
    coordinate_system: "pixel",
  }
}

/**
 * Split brush areas into serializable ``box`` (rect / lineX / lineY) and
 * ``lasso`` (polygon) selection items.
 */
function buildBrushGeometry(
  chart: EChartsSelectionInstance,
  areas: BrushArea[]
): {
  box: Array<Record<string, unknown>>
  lasso: Array<Record<string, unknown>>
} {
  const box: Array<Record<string, unknown>> = []
  const lasso: Array<Record<string, unknown>> = []
  for (const area of areas) {
    const item = areaToSelectionItem(chart, area)
    if (area.brushType === "polygon") {
      lasso.push(item)
    } else {
      box.push(item)
    }
  }
  return { box, lasso }
}

/**
 * Reset each series' cursor to the normal arrow for display-only charts.
 *
 * ECharts defaults series data items to a ``"pointer"`` cursor (and a hover
 * emphasis), which implies the chart is clickable. That's misleading when no
 * click/selection handler is wired, and inconsistent with other non-interactive
 * Streamlit charts. We only reset the cursor (the hover emphasis is left intact,
 * as it's useful alongside tooltips) and leave any series where the user set an
 * explicit ``cursor`` untouched. Legend/dataZoom/toolbox cursors are unaffected.
 */
function withDefaultSeriesCursor(
  option: EChartsOptionObject
): EChartsOptionObject {
  const { series } = option
  const withCursor = (entry: unknown): unknown => {
    if (!isPlainObject(entry)) {
      return entry
    }
    const seriesObject = entry as Record<string, unknown>
    if ("cursor" in seriesObject) {
      return entry
    }
    return { ...seriesObject, cursor: "default" }
  }
  if (Array.isArray(series)) {
    return { ...option, series: series.map(withCursor) }
  }
  if (isPlainObject(series)) {
    return { ...option, series: withCursor(series) }
  }
  return option
}

/**
 * Hook that wires ECharts selection events (native point selection and box/lasso
 * brush gestures) into Streamlit's widget-state mechanism. Modeled on
 * ``useVegaLiteSelections``.
 *
 * Streamlit does not inject any selection config into the option: when
 * ``on_select`` is active, we listen for whatever selections the user has
 * enabled in their spec (``selectedMode`` on a series, a ``brush`` component)
 * and return them. This keeps the option untouched and works uniformly across
 * chart types.
 */
export function useEChartsSelections(
  element: EChartsChartProto,
  widgetMgr: WidgetStateManager,
  fragmentId?: string
): UseEChartsSelectionsOutput {
  const chartId = element.id
  const formId = element.formId

  // Selection is active whenever the chart is a widget (on_select != "ignore"),
  // which is the only case the backend assigns an element ID.
  const isSelectionActivated = Boolean(chartId)

  // Keep the latest bound chart so form-clear resets can clear the visible brush.
  const chartRef = useRef<EChartsSelectionInstance | null>(null)

  const widgetInfo: WidgetInfo = useMemo(
    () => ({ id: chartId, formId }),
    [chartId, formId]
  )

  const writeSelection = useCallback(
    (selection: EChartsSelectionState): void => {
      const json = JSON.stringify({ selection })
      // Skip no-op updates to avoid needless reruns.
      if (widgetMgr.getStringValue(widgetInfo) === json) {
        return
      }
      widgetMgr.setStringValue(widgetInfo.id, json, {
        formId: widgetInfo.formId,
        fragmentId,
        fromUser: true,
      })
    },
    [widgetMgr, widgetInfo, fragmentId]
  )

  const configureSelectionOption = useCallback(
    (option: EChartsOptionObject): EChartsOptionObject => {
      if (!isSelectionActivated) {
        // Display-only charts aren't clickable, so don't imply it via the
        // default "pointer" cursor on series items.
        return withDefaultSeriesCursor(option)
      }
      // Selection widgets are left untouched: the user configures selection in
      // their own spec (`selectedMode`, `brush`); we only listen and report.
      return option
    },
    [isSelectionActivated]
  )

  const restoreSelection = useCallback(
    (chart: EChartsSelectionInstance): void => {
      if (!chartId) {
        return
      }
      // Re-apply natively selected points (an option-replacing setOption clears
      // the select state), then re-draw persisted brush areas.
      const selectedPoints = widgetMgr.getElementState<SelectedEntry[]>(
        chartId,
        SELECTED_POINTS_STATE_KEY
      )
      if (Array.isArray(selectedPoints)) {
        dispatchPointSelection(chart, selectedPoints, "select")
      }

      const areas = widgetMgr.getElementState<BrushArea[]>(
        chartId,
        BRUSH_AREAS_STATE_KEY
      )
      if (Array.isArray(areas) && areas.length > 0) {
        try {
          chart.dispatchAction({ type: "brush", areas })
        } catch (error) {
          LOG.warn("Failed to restore persisted brush areas", error)
        }
      }
    },
    [chartId, widgetMgr]
  )

  const clearSelection = useCallback((): void => {
    const chart = chartRef.current
    if (chart) {
      try {
        chart.dispatchAction({ type: "brush", areas: [] })
      } catch (error) {
        LOG.warn("Failed to clear brush selection", error)
      }
      // Deselect any natively selected points as well.
      const selectedPoints = chartId
        ? widgetMgr.getElementState<SelectedEntry[]>(
            chartId,
            SELECTED_POINTS_STATE_KEY
          )
        : undefined
      if (Array.isArray(selectedPoints)) {
        dispatchPointSelection(chart, selectedPoints, "unselect")
      }
    }
    if (chartId) {
      widgetMgr.setElementState(chartId, BRUSH_AREAS_STATE_KEY, [])
      widgetMgr.setElementState(chartId, BRUSH_POINTS_STATE_KEY, {
        points: [],
        indices: [],
      })
      widgetMgr.setElementState(chartId, SELECTED_POINTS_STATE_KEY, [])
    }
    writeSelection(EMPTY_SELECTION)
  }, [chartId, widgetMgr, writeSelection])

  const onFormCleared = useCallback((): void => {
    clearSelection()
  }, [clearSelection])

  const bindSelections = useCallback(
    (chart: EChartsSelectionInstance): (() => void) => {
      if (!isSelectionActivated) {
        // Display-only charts bind nothing and emit nothing.
        return () => {}
      }

      chartRef.current = chart

      // Latest resolved values for each selection channel. Point selection
      // (native ``selectchanged``) and box/lasso brush selection are
      // independent and coexist: the emitted ``points``/``point_indices`` are
      // the de-duplicated union of natively selected points and brushed points,
      // while ``box``/``lasso`` carry the brush geometry. Caching lets
      // brushSelected and brushEnd (which fire in either order) produce a single
      // update.
      let latestSelectedPoints: Array<Record<string, unknown>> = []
      let latestSelectedIndices: number[] = []
      let latestBrushPoints: Array<Record<string, unknown>> = []
      let latestBrushIndices: number[] = []
      let latestBox: Array<Record<string, unknown>> = []
      let latestLasso: Array<Record<string, unknown>> = []

      // Seed the caches from the persisted selection so that, after a remount
      // (theme/renderer change recreates the instance), interacting with a
      // single channel doesn't drop the other channel's state. ``restoreSelection``
      // re-applies the visuals but intentionally runs *before* these handlers are
      // bound, so its events don't hydrate the caches — we do it explicitly here.
      if (chartId) {
        const persistedPoints = widgetMgr.getElementState<SelectedEntry[]>(
          chartId,
          SELECTED_POINTS_STATE_KEY
        )
        if (Array.isArray(persistedPoints) && persistedPoints.length > 0) {
          const { points, indices } = buildPointsFromEntries(
            resolveChartOption(chart),
            persistedPoints
          )
          latestSelectedPoints = points
          latestSelectedIndices = indices
        }

        const persistedAreas = widgetMgr.getElementState<BrushArea[]>(
          chartId,
          BRUSH_AREAS_STATE_KEY
        )
        if (Array.isArray(persistedAreas) && persistedAreas.length > 0) {
          const { box, lasso } = buildBrushGeometry(chart, persistedAreas)
          latestBox = box
          latestLasso = lasso
        }

        const persistedBrushPoints = widgetMgr.getElementState<{
          points: Array<Record<string, unknown>>
          indices: number[]
        }>(chartId, BRUSH_POINTS_STATE_KEY)
        if (
          persistedBrushPoints &&
          Array.isArray(persistedBrushPoints.points) &&
          persistedBrushPoints.points.length > 0
        ) {
          latestBrushPoints = persistedBrushPoints.points
          latestBrushIndices = Array.isArray(persistedBrushPoints.indices)
            ? persistedBrushPoints.indices
            : []
        }
      }

      const emitSelection = debounce((): void => {
        const { points, pointIndices } = mergePointChannels(
          latestSelectedPoints,
          latestSelectedIndices,
          latestBrushPoints,
          latestBrushIndices
        )
        writeSelection({
          points,
          point_indices: pointIndices,
          box: latestBox,
          lasso: latestLasso,
        })
      }, DEBOUNCE_TIME_MS)

      const handleSelectChanged = (raw: unknown): void => {
        const params = raw as SelectChangedParams
        const selected = params.selected ?? []
        // Resolve the (possibly enriched) point entries from the chart's option.
        const { points, indices } = buildPointsFromEntries(
          resolveChartOption(chart),
          selected
        )
        latestSelectedPoints = points
        latestSelectedIndices = indices
        // Persist the raw selection so it can be re-applied visually after an
        // option-replacing setOption or a remount.
        if (chartId) {
          widgetMgr.setElementState(
            chartId,
            SELECTED_POINTS_STATE_KEY,
            selected
          )
        }
        emitSelection()
      }

      const handleBrushSelected = (raw: unknown): void => {
        const params = raw as BrushSelectedParams
        const points: Array<Record<string, unknown>> = []
        const indices: number[] = []
        for (const batchItem of params.batch ?? []) {
          for (const selected of batchItem.selected ?? []) {
            for (const dataIndex of selected.dataIndex ?? []) {
              points.push({
                component_type: "series",
                series_index: selected.seriesIndex,
                data_index: dataIndex,
              })
              indices.push(dataIndex)
            }
          }
        }
        latestBrushPoints = points
        latestBrushIndices = indices
        if (chartId) {
          widgetMgr.setElementState(chartId, BRUSH_POINTS_STATE_KEY, {
            points,
            indices,
          })
        }
        // Do not emit here. ``brushSelected`` fires throughout a drag, so a
        // pause longer than the debounce would rerun the app with new points
        // and the previous ``box``/``lasso``. ``brushEnd`` is the commit; if
        // it already scheduled an emit (event-order inversion), the pending
        // debounce still reads these updated caches.
      }

      const handleBrushEnd = (raw: unknown): void => {
        const params = raw as BrushEndParams
        const areas = params.areas ?? []
        const { box, lasso } = buildBrushGeometry(chart, areas)
        latestBox = box
        latestLasso = lasso
        if (chartId) {
          widgetMgr.setElementState(chartId, BRUSH_AREAS_STATE_KEY, areas)
        }
        emitSelection()
      }

      const handleDoubleClick = (): void => {
        emitSelection.cancel()
        latestSelectedPoints = []
        latestSelectedIndices = []
        latestBrushPoints = []
        latestBrushIndices = []
        latestBox = []
        latestLasso = []
        clearSelection()
      }

      // Bind all selection listeners: point selection (`selectchanged`) fires
      // only if the user's spec sets `selectedMode`, and brush events fire only
      // if the spec has a `brush` component, so unused listeners are harmless.
      chart.on("selectchanged", handleSelectChanged)
      chart.on("brushSelected", handleBrushSelected)
      chart.on("brushEnd", handleBrushEnd)
      // Double-click clears the selection. It binds on the underlying zrender
      // layer rather than the chart, because `chart.on("dblclick")` only fires
      // for clicks that land on a data item — never on empty canvas or on the
      // cover that a brushed region draws over the chart, which are exactly the
      // spots users double-click to clear a box or lasso.
      const zr = chart.getZr()
      zr.on("dblclick", handleDoubleClick)

      return () => {
        emitSelection.cancel()
        if (chartRef.current === chart) {
          chartRef.current = null
        }
        // The instance is disposed before this cleanup when the whole chart is
        // torn down; unbinding from a disposed instance logs a console warning.
        if (chart.isDisposed()) {
          return
        }
        chart.off("selectchanged", handleSelectChanged)
        chart.off("brushSelected", handleBrushSelected)
        chart.off("brushEnd", handleBrushEnd)
        zr.off("dblclick", handleDoubleClick)
      }
    },
    [isSelectionActivated, chartId, widgetMgr, writeSelection, clearSelection]
  )

  return {
    isSelectionActivated,
    configureSelectionOption,
    bindSelections,
    restoreSelection,
    onFormCleared,
  }
}
