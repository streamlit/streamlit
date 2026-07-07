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

import { notNullOrUndefined } from "~lib/util/utils"
import { WidgetInfo, WidgetStateManager } from "~lib/WidgetStateManager"

import { EChartsOptionObject } from "./CustomTheme"

const LOG = getLogger("useEChartsSelections")

/**
 * Debounce time (ms) for widget-state updates. Coalesces the ``brushSelected``
 * and ``brushEnd`` events of a single gesture into exactly one update.
 */
const DEBOUNCE_TIME_MS = 150

/** Frontend-only element-state key under which raw brush areas are persisted. */
const BRUSH_AREAS_STATE_KEY = "brushAreas"

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
}

interface EChartsClickParams {
  componentType?: string
  seriesType?: string
  seriesIndex?: number
  seriesName?: string
  dataIndex?: number
  name?: string
  value?: unknown
  data?: unknown
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
  xAxisIndex?: number
}

interface BrushEndParams {
  areas?: BrushArea[]
}

export interface UseEChartsSelectionsOutput {
  /** Whether selections are active (a widget with at least one selection mode). */
  isSelectionActivated: boolean
  /**
   * Merge default ``brush`` + ``toolbox.feature.brush`` into the option (only
   * when box/lasso are active and the user hasn't set them). Returns the option
   * unchanged for display-only or points-only charts.
   */
  configureSelectionOption: (
    option: EChartsOptionObject
  ) => EChartsOptionObject
  /**
   * Bind selection handlers (click / brush / double-click) to a chart instance.
   * Returns a cleanup function that removes the handlers. A no-op for
   * display-only charts.
   */
  bindSelections: (chart: EChartsSelectionInstance) => () => void
  /**
   * Re-dispatch persisted brush areas after an option-replacing ``setOption`` or
   * a remount, keeping the visible selection in sync with the widget state.
   */
  restoreBrush: (chart: EChartsSelectionInstance) => void
  /** Clear the selection (widget state + persisted brush areas). */
  onFormCleared: () => void
}

const EMPTY_SELECTION: EChartsSelectionState = {
  points: [],
  point_indices: [],
  box: [],
  lasso: [],
}

/** Build a rich point entry from an ECharts ``click`` event's params. */
function buildClickPoint(params: EChartsClickParams): Record<string, unknown> {
  return {
    component_type: params.componentType,
    series_type: params.seriesType,
    series_index: params.seriesIndex,
    series_name: params.seriesName,
    data_index: params.dataIndex,
    name: params.name,
    value: params.value,
    data: params.data,
  }
}

/**
 * Try to convert a pixel-space brush range into data-space coordinates. Returns
 * ``null`` when the coordinate system can't be resolved so the caller can fall
 * back to raw pixels.
 */
function convertPixelRange(
  chart: EChartsSelectionInstance,
  area: BrushArea
): { x: number[]; y: number[] } | null {
  const range = area.range
  if (!Array.isArray(range)) {
    return null
  }
  const finder = { gridIndex: 0 }
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

/** Convert a single brush area into a serializable selection item. */
function areaToSelectionItem(
  chart: EChartsSelectionInstance,
  area: BrushArea
): Record<string, unknown> {
  const gridIndex = area.xAxisIndex ?? 0
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
    // lineX / lineY selections carry a single 1D range.
    return { x: coordRange as number[], y: [], grid_index: gridIndex }
  }

  const converted = convertPixelRange(chart, area)
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
 * Hook that wires ECharts selection events (point clicks and box/lasso brush
 * gestures) into Streamlit's widget-state mechanism. Modeled on
 * ``useVegaLiteSelections``.
 */
export function useEChartsSelections(
  element: EChartsChartProto,
  widgetMgr: WidgetStateManager,
  fragmentId?: string
): UseEChartsSelectionsOutput {
  const chartId = element.id
  const formId = element.formId
  const selectionMode = element.selectionMode

  const hasPoints = selectionMode.includes(
    EChartsChartProto.SelectionMode.POINTS
  )
  const hasBox = selectionMode.includes(EChartsChartProto.SelectionMode.BOX)
  const hasLasso = selectionMode.includes(
    EChartsChartProto.SelectionMode.LASSO
  )

  const isSelectionActivated = Boolean(chartId) && selectionMode.length > 0

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
      widgetMgr.setStringValue(widgetInfo, json, { fromUi: true }, fragmentId)
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
      if (!hasBox && !hasLasso) {
        // Point-only selection is click-driven; keep ECharts' pointer cursor.
        return option
      }

      const brushTypes: string[] = []
      if (hasBox) {
        brushTypes.push("rect")
      }
      if (hasLasso) {
        brushTypes.push("polygon")
      }

      const result: EChartsOptionObject = { ...option }

      // Add the brush component only when the user hasn't defined their own.
      if (result.brush === undefined) {
        result.brush = {
          toolbox: [...brushTypes, "clear"],
          xAxisIndex: "all",
          yAxisIndex: "all",
          throttleType: "debounce",
          throttleDelay: DEBOUNCE_TIME_MS,
        }
      }

      // Add the toolbox brush buttons only when the user hasn't defined them.
      const brushFeature = { type: [...brushTypes, "clear"] }
      if (result.toolbox === undefined) {
        result.toolbox = { feature: { brush: brushFeature } }
      } else if (isPlainObject(result.toolbox)) {
        const toolbox = { ...(result.toolbox as Record<string, unknown>) }
        const feature: Record<string, unknown> = isPlainObject(toolbox.feature)
          ? { ...(toolbox.feature as Record<string, unknown>) }
          : {}
        if (feature.brush === undefined) {
          feature.brush = brushFeature
          toolbox.feature = feature
          result.toolbox = toolbox
        }
      }

      return result
    },
    [isSelectionActivated, hasBox, hasLasso]
  )

  const restoreBrush = useCallback(
    (chart: EChartsSelectionInstance): void => {
      if (!chartId) {
        return
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
    }
    if (chartId) {
      widgetMgr.setElementState(chartId, BRUSH_AREAS_STATE_KEY, [])
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

      // Latest resolved values for the current gesture. Cached so brushSelected
      // and brushEnd (which fire in either order) produce exactly one update.
      let latestBrushPoints: Array<Record<string, unknown>> = []
      let latestBrushIndices: number[] = []
      let latestBox: Array<Record<string, unknown>> = []
      let latestLasso: Array<Record<string, unknown>> = []

      const emitBrushSelection = debounce((): void => {
        writeSelection({
          points: latestBrushPoints,
          point_indices: latestBrushIndices,
          box: latestBox,
          lasso: latestLasso,
        })
      }, DEBOUNCE_TIME_MS)

      const emitClickSelection = debounce(
        (selection: EChartsSelectionState): void => {
          writeSelection(selection)
        },
        DEBOUNCE_TIME_MS
      )

      const handleClick = (raw: unknown): void => {
        if (!hasPoints) {
          return
        }
        const params = raw as EChartsClickParams
        if (params.componentType !== "series") {
          return
        }
        // A point click reports a points-only selection and supersedes any
        // in-flight or persisted brush selection. Cancel the pending brush emit
        // and drop persisted brush areas so a later restore doesn't resurrect a
        // stale box/lasso that disagrees with the emitted widget state.
        emitBrushSelection.cancel()
        latestBrushPoints = []
        latestBrushIndices = []
        latestBox = []
        latestLasso = []
        if (chartId) {
          widgetMgr.setElementState(chartId, BRUSH_AREAS_STATE_KEY, [])
        }
        emitClickSelection({
          points: [buildClickPoint(params)],
          point_indices: notNullOrUndefined(params.dataIndex)
            ? [params.dataIndex]
            : [],
          box: [],
          lasso: [],
        })
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
        emitBrushSelection()
      }

      const handleBrushEnd = (raw: unknown): void => {
        const params = raw as BrushEndParams
        const areas = params.areas ?? []
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
        latestBox = box
        latestLasso = lasso
        if (chartId) {
          widgetMgr.setElementState(chartId, BRUSH_AREAS_STATE_KEY, areas)
        }
        emitBrushSelection()
      }

      const handleDoubleClick = (): void => {
        emitBrushSelection.cancel()
        emitClickSelection.cancel()
        clearSelection()
      }

      chart.on("click", handleClick)
      if (hasBox || hasLasso) {
        chart.on("brushSelected", handleBrushSelected)
        chart.on("brushEnd", handleBrushEnd)
      }
      chart.on("dblclick", handleDoubleClick)

      return () => {
        emitBrushSelection.cancel()
        emitClickSelection.cancel()
        chart.off("click", handleClick)
        if (hasBox || hasLasso) {
          chart.off("brushSelected", handleBrushSelected)
          chart.off("brushEnd", handleBrushEnd)
        }
        chart.off("dblclick", handleDoubleClick)
        if (chartRef.current === chart) {
          chartRef.current = null
        }
      }
    },
    [
      isSelectionActivated,
      hasPoints,
      hasBox,
      hasLasso,
      chartId,
      widgetMgr,
      writeSelection,
      clearSelection,
    ]
  )

  return {
    isSelectionActivated,
    configureSelectionOption,
    bindSelections,
    restoreBrush,
    onFormCleared,
  }
}
