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

import { debounce, isEqual, isPlainObject } from "lodash-es"
import { getLogger } from "loglevel"

import { EChartsChart as EChartsChartProto } from "@streamlit/protobuf"

import { WidgetInfo, WidgetStateManager } from "~lib/WidgetStateManager"

import { EChartsOptionObject } from "./CustomTheme"

const LOG = getLogger("useEChartsSelections")

/**
 * Debounce time (ms) for widget-state updates. Coalesces a single gesture's
 * native and brush events into one update.
 */
const DEBOUNCE_TIME_MS = 150

/** Frontend-only element-state key for exact brush snapshots. */
const BRUSH_SELECTION_STATE_KEY = "brushSelection"
/**
 * Frontend-only element-state key under which the natively selected points are
 * persisted (as ECharts ``selectchanged`` ``selected`` entries) so they can be
 * re-applied visually after an option-replacing ``setOption`` or a remount.
 */
const SELECTED_POINTS_STATE_KEY = "selectedPoints"

/**
 * How long after a polygon lands its completing ``dblclick`` may still arrive.
 * The two fire in the same interaction, so this only has to outlast one event
 * turn — short enough that a deliberate double-click later still clears.
 */
const POLYGON_COMPLETION_WINDOW_MS = 100

/**
 * The shared selection-state contract serialized to the widget state. Keys are
 * snake_case to match the Python serde.
 */
interface EChartsSelectionState {
  selected: Array<Record<string, unknown>>
  areas: Array<Record<string, unknown>>
}

/** A minimal view of the ECharts instance used for selection wiring. */
export interface EChartsSelectionInstance {
  on(eventName: string, handler: (params: unknown) => void): void
  off(eventName: string, handler?: (params: unknown) => void): void
  dispatchAction(payload: Record<string, unknown>): void
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
  fromAction?: string
  fromActionPayload?: {
    type?: unknown
    seriesIndex?: unknown
    dataType?: unknown
    dataIndex?: unknown
    dataIndexInside?: unknown
  }
}

interface BrushSelectedItem {
  seriesIndex: number
  dataType?: string
  dataIndex: number[]
}

interface BrushArea {
  brushType?: string
  coordRange?: unknown
  [key: string]: unknown
}

interface BrushSelection {
  brushId?: string
  brushIndex: number
  areas?: BrushArea[]
  selected?: BrushSelectedItem[]
}

interface BrushSelectedParams {
  batch?: BrushSelection[]
}

interface BrushEndParams {
  brushId?: string
  areas?: BrushArea[]
}

export interface UseEChartsSelectionsOutput {
  /**
   * Whether the chart is a selection widget (``on_select`` is not ``"ignore"``,
   * i.e. the element has an ID) and the widget is not disabled.
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
  selected: [],
  areas: [],
}
const EMPTY_SELECTION_JSON = JSON.stringify({ selection: EMPTY_SELECTION })

/** Resolve the chart's current option as a plain object (or ``null``). */
function resolveChartOption(
  chart: EChartsSelectionInstance
): Record<string, unknown> | null {
  const chartOption = chart.getOption()
  return isPlainObject(chartOption)
    ? (chartOption as Record<string, unknown>)
    : null
}

const DATA_TYPE_RANK: Readonly<Record<string, number>> = {
  main: 0,
  node: 1,
  edge: 2,
}

interface SelectionGroup {
  seriesIndex: number
  dataType: string
  dataIndices: Set<number>
}

function normalizeDataType(dataType: string | undefined): string {
  return dataType ?? "main"
}

function normalizeSeriesMetadata(value: unknown): string | number | null {
  if (typeof value === "number") {
    return value
  }
  if (typeof value === "string" && value.length > 0 && !value.includes("\0")) {
    return value
  }
  return null
}

function getSeriesOption(
  resolvedOption: Record<string, unknown> | null,
  seriesIndex: number
): Record<string, unknown> | null {
  const seriesOption = resolvedOption?.series
  const series = Array.isArray(seriesOption)
    ? seriesOption[seriesIndex]
    : seriesIndex === 0
      ? seriesOption
      : undefined
  return isPlainObject(series) ? (series as Record<string, unknown>) : null
}

function getSeriesMetadata(
  resolvedOption: Record<string, unknown> | null,
  seriesIndex: number
): { seriesId: string | number | null; seriesName: string | number | null } {
  const seriesObject = getSeriesOption(resolvedOption, seriesIndex)

  return {
    seriesId: normalizeSeriesMetadata(seriesObject?.id),
    seriesName: normalizeSeriesMetadata(seriesObject?.name),
  }
}

function getNumberArray(value: unknown): number[] {
  const values = Array.isArray(value) ? value : [value]
  return values.filter(item => typeof item === "number")
}

function getGraphSeriesSelection(
  seriesIndex: number,
  seriesOption: Record<string, unknown>
): SelectedEntry[] {
  const nodes = Array.isArray(seriesOption.data)
    ? seriesOption.data
    : Array.isArray(seriesOption.nodes)
      ? seriesOption.nodes
      : []
  const edges = Array.isArray(seriesOption.links)
    ? seriesOption.links
    : Array.isArray(seriesOption.edges)
      ? seriesOption.edges
      : []
  return [
    {
      seriesIndex,
      dataType: "node",
      dataIndex: nodes.map((_, index) => index),
    },
    {
      seriesIndex,
      dataType: "edge",
      dataIndex: edges.map((_, index) => index),
    },
  ].filter(entry => entry.dataIndex.length > 0)
}

/**
 * ECharts 6 stores graph node and edge selection in one internal map, so its
 * full snapshot repeats matching raw indices for both data types. Apply the
 * typed action to our previous snapshot instead, preserving independent groups.
 */
function normalizeNativeSelection(
  chart: EChartsSelectionInstance,
  previous: SelectedEntry[],
  params: SelectChangedParams
): SelectedEntry[] {
  const payload = params.fromActionPayload
  const seriesIndex = payload?.seriesIndex
  const dataType = payload?.dataType
  const resolvedOption = resolveChartOption(chart)
  const seriesOption =
    typeof seriesIndex === "number"
      ? getSeriesOption(resolvedOption, seriesIndex)
      : null
  if (
    typeof seriesIndex !== "number" ||
    (dataType !== "node" && dataType !== "edge") ||
    seriesOption?.type !== "graph"
  ) {
    return params.selected ?? []
  }

  const action =
    params.fromAction ??
    (typeof payload?.type === "string" ? payload.type : undefined)
  const keyMatches = (entry: SelectedEntry): boolean =>
    entry.seriesIndex === seriesIndex &&
    normalizeDataType(entry.dataType) === dataType
  const previousIndices = new Set(previous.find(keyMatches)?.dataIndex ?? [])
  const actionIndices = getNumberArray(
    payload?.dataIndex ?? payload?.dataIndexInside
  )
  const selectedMode = seriesOption.selectedMode

  if (selectedMode === "series") {
    const next = previous.filter(entry => entry.seriesIndex !== seriesIndex)
    return action === "unselect"
      ? next
      : [...next, ...getGraphSeriesSelection(seriesIndex, seriesOption)]
  }

  if (selectedMode === "single" || selectedMode === true) {
    const wasSelected = actionIndices.every(index =>
      previousIndices.has(index)
    )
    previousIndices.clear()
    if (
      action !== "unselect" &&
      !(action?.startsWith("toggle") && wasSelected)
    ) {
      actionIndices.forEach(index => previousIndices.add(index))
    }
  } else {
    for (const index of actionIndices) {
      if (action === "unselect") {
        previousIndices.delete(index)
      } else if (action?.startsWith("toggle")) {
        if (previousIndices.has(index)) {
          previousIndices.delete(index)
        } else {
          previousIndices.add(index)
        }
      } else {
        previousIndices.add(index)
      }
    }
  }

  const replaceWholeSeries = selectedMode === "single" || selectedMode === true
  const next = previous
    .filter(
      entry =>
        !keyMatches(entry) &&
        !(replaceWholeSeries && entry.seriesIndex === seriesIndex)
    )
    .map(entry => ({ ...entry, dataIndex: [...entry.dataIndex] }))
  if (previousIndices.size > 0) {
    next.push({
      seriesIndex,
      dataType,
      dataIndex: Array.from(previousIndices),
    })
  }
  return next
}

function appendSelectedEntries(
  groups: Map<string, SelectionGroup>,
  entries: Array<SelectedEntry | BrushSelectedItem>
): void {
  for (const entry of entries) {
    if (typeof entry.seriesIndex !== "number") {
      continue
    }
    const dataType = normalizeDataType(entry.dataType)
    const key = JSON.stringify([entry.seriesIndex, dataType])
    let group = groups.get(key)
    if (!group) {
      group = {
        seriesIndex: entry.seriesIndex,
        dataType,
        dataIndices: new Set<number>(),
      }
      groups.set(key, group)
    }
    for (const dataIndex of entry.dataIndex ?? []) {
      if (typeof dataIndex === "number") {
        group.dataIndices.add(dataIndex)
      }
    }
  }
}

function compareDataTypes(left: string, right: string): number {
  const leftRank = DATA_TYPE_RANK[left] ?? 3
  const rightRank = DATA_TYPE_RANK[right] ?? 3
  return leftRank === rightRank
    ? left.localeCompare(right)
    : leftRank - rightRank
}

function buildSelectedGroups(
  chart: EChartsSelectionInstance,
  nativeSelection: SelectedEntry[],
  brushSelection: BrushSelection[]
): Array<Record<string, unknown>> {
  const groups = new Map<string, SelectionGroup>()
  appendSelectedEntries(groups, nativeSelection)
  for (const brush of brushSelection) {
    appendSelectedEntries(groups, brush.selected ?? [])
  }

  const resolvedOption = resolveChartOption(chart)
  return Array.from(groups.values())
    .filter(group => group.dataIndices.size > 0)
    .sort(
      (left, right) =>
        left.seriesIndex - right.seriesIndex ||
        compareDataTypes(left.dataType, right.dataType)
    )
    .map(group => {
      const { seriesId, seriesName } = getSeriesMetadata(
        resolvedOption,
        group.seriesIndex
      )
      return {
        series_index: group.seriesIndex,
        series_id: seriesId,
        series_name: seriesName,
        data_type: group.dataType,
        data_indices: Array.from(group.dataIndices).sort(
          (left, right) => left - right
        ),
      }
    })
}

function buildAreas(
  brushSelection: BrushSelection[]
): Array<Record<string, unknown>> {
  return [...brushSelection]
    .sort((left, right) => left.brushIndex - right.brushIndex)
    .flatMap(brush =>
      (brush.areas ?? [])
        .filter(area => typeof area.brushType === "string")
        .map(area => ({
          brush_index: brush.brushIndex,
          brush_type: area.brushType,
          coord_range: Array.isArray(area.coordRange) ? area.coordRange : null,
        }))
    )
}

function buildSelectionState(
  chart: EChartsSelectionInstance,
  nativeSelection: SelectedEntry[],
  brushSelection: BrushSelection[]
): EChartsSelectionState {
  return {
    selected: buildSelectedGroups(chart, nativeSelection, brushSelection),
    areas: buildAreas(brushSelection),
  }
}

function hasNoBrushAreas(brushSelection: BrushSelection[]): boolean {
  return brushSelection.every(brush => (brush.areas ?? []).length === 0)
}

function findBrushSelectionForEnd(
  brushSelection: BrushSelection[],
  params: BrushEndParams
): BrushSelection | undefined {
  return params.brushId === undefined
    ? brushSelection.length === 1
      ? brushSelection[0]
      : undefined
    : brushSelection.find(item => item.brushId === params.brushId)
}

function removeDuplicatePolygonEndpoint(value: unknown): unknown {
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    !isEqual(value.at(-1), value.at(-2))
  ) {
    return value
  }
  return value.slice(0, -1)
}

function getComparableBrushArea(area: BrushArea): Record<string, unknown> {
  const isPolygon = area.brushType === "polygon"
  return {
    brushType: area.brushType,
    panelId: area.panelId,
    range: isPolygon ? removeDuplicatePolygonEndpoint(area.range) : area.range,
    coordRange: isPolygon
      ? removeDuplicatePolygonEndpoint(area.coordRange)
      : area.coordRange,
    coordRanges:
      isPolygon && Array.isArray(area.coordRanges)
        ? area.coordRanges.map(removeDuplicatePolygonEndpoint)
        : area.coordRanges,
  }
}

function brushAreasEqual(left: BrushArea[], right: BrushArea[]): boolean {
  return isEqual(
    left.map(getComparableBrushArea),
    right.map(getComparableBrushArea)
  )
}

function brushEndMatchesSelection(
  brushSelection: BrushSelection[],
  params: BrushEndParams
): boolean {
  const brush = findBrushSelectionForEnd(brushSelection, params)
  return (
    brush !== undefined &&
    brushAreasEqual(brush.areas ?? [], params.areas ?? [])
  )
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
 * Reset each series' cursor to the normal arrow for display-only charts.
 *
 * ECharts defaults series data items to a ``"pointer"`` cursor (and a hover
 * emphasis), which implies the chart is clickable. That's misleading when no
 * click/selection handler is wired, and inconsistent with other non-interactive
 * Streamlit charts. We only reset the cursor (the hover emphasis is left intact,
 * as it's useful alongside tooltips) and leave any series where the user set an
 * explicit ``cursor`` untouched. Legend/dataZoom/toolbox cursors are unaffected.
 *
 * This reaches data items only. ECharts applies ``series.cursor`` when it draws
 * symbols, bars, and candlesticks, but never to a line's polyline or an area's
 * polygon, which therefore keep zrender's ``"pointer"`` default — so hovering
 * the line itself (or anywhere in an area fill) still shows a click cursor.
 * There is no option-level fix: ``silent`` would remove it but also disables
 * hover emphasis and item tooltips.
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
 * Hook that wires ECharts native and brush selection events into Streamlit's
 * widget-state mechanism. Modeled on
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
  fragmentId?: string,
  disabled = false
): UseEChartsSelectionsOutput {
  const chartId = element.id
  const formId = element.formId

  // Selection is active whenever the chart is a widget (on_select != "ignore")
  // and the widget is not disabled (e.g. a disconnected app).
  const isSelectionActivated = Boolean(chartId) && !disabled

  // Keep the latest bound chart so form-clear resets can clear the visible brush.
  const chartRef = useRef<EChartsSelectionInstance | null>(null)
  const clearBoundSelectionRef = useRef<((fromUser?: boolean) => void) | null>(
    null
  )
  // Suppress widget emits from programmatic restore dispatches so a data-only
  // rerun cannot loop: ``restoreSelection`` runs while handlers are already
  // bound, and ECharts fires ``selectchanged`` for ``dispatchAction("select")``.
  const isRestoringRef = useRef(false)

  const widgetInfo: WidgetInfo = useMemo(
    () => ({ id: chartId, formId }),
    [chartId, formId]
  )

  const writeSelection = useCallback(
    (selection: EChartsSelectionState, fromUser = true): void => {
      const json = JSON.stringify({ selection })
      // Skip no-op updates to avoid needless reruns.
      const currentValue = widgetMgr.getStringValue(widgetInfo)
      if (
        currentValue === json ||
        (currentValue === undefined && json === EMPTY_SELECTION_JSON)
      ) {
        return
      }
      widgetMgr.setStringValue(widgetInfo.id, json, {
        formId: widgetInfo.formId,
        fragmentId,
        fromUser,
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
      isRestoringRef.current = true
      try {
        // Re-apply natively selected points (an option-replacing setOption clears
        // the select state), then re-draw persisted brush areas.
        const selectedPoints = widgetMgr.getElementState<SelectedEntry[]>(
          chartId,
          SELECTED_POINTS_STATE_KEY
        )
        if (Array.isArray(selectedPoints)) {
          dispatchPointSelection(chart, selectedPoints, "select")
        }

        const brushSelection = widgetMgr.getElementState<BrushSelection[]>(
          chartId,
          BRUSH_SELECTION_STATE_KEY
        )
        if (Array.isArray(brushSelection)) {
          for (const brush of brushSelection) {
            const areas = brush.areas ?? []
            if (areas.length === 0) {
              continue
            }
            try {
              chart.dispatchAction({
                type: "brush",
                brushIndex: brush.brushIndex,
                areas,
              })
            } catch (error) {
              LOG.warn("Failed to restore persisted brush areas", error)
            }
          }
        }
      } finally {
        isRestoringRef.current = false
      }
    },
    [chartId, widgetMgr]
  )

  const clearSelection = useCallback(
    (fromUser = true): void => {
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
        widgetMgr.setElementState(chartId, BRUSH_SELECTION_STATE_KEY, [])
        widgetMgr.setElementState(chartId, SELECTED_POINTS_STATE_KEY, [])
      }
      writeSelection(EMPTY_SELECTION, fromUser)
    },
    [chartId, widgetMgr, writeSelection]
  )

  const onFormCleared = useCallback((): void => {
    // The submitted value has already moved from the form into committed widget
    // state. Clear that committed value so subsequent unrelated reruns don't
    // send the stale selection back to Python.
    if (clearBoundSelectionRef.current) {
      clearBoundSelectionRef.current(false)
    } else {
      clearSelection(false)
    }
  }, [clearSelection])

  const bindSelections = useCallback(
    (chart: EChartsSelectionInstance): (() => void) => {
      if (!isSelectionActivated) {
        // Display-only charts bind nothing and emit nothing.
        return () => {}
      }

      chartRef.current = chart

      // Native and brush selection are independent ECharts channels. Cache their
      // full snapshots separately, then expose a deterministic grouped union.
      let latestNativeSelection: SelectedEntry[] = []
      let latestBrushSelection: BrushSelection[] = []
      let committedBrushSelection: BrushSelection[] = []
      let pendingBrushEnd: BrushEndParams | undefined

      // Seed both channels so an interaction after a remount cannot drop the
      // other channel's restored state.
      if (chartId) {
        const persistedPoints = widgetMgr.getElementState<SelectedEntry[]>(
          chartId,
          SELECTED_POINTS_STATE_KEY
        )
        if (Array.isArray(persistedPoints)) {
          latestNativeSelection = persistedPoints
        }

        const persistedBrushSelection = widgetMgr.getElementState<
          BrushSelection[]
        >(chartId, BRUSH_SELECTION_STATE_KEY)
        if (Array.isArray(persistedBrushSelection)) {
          latestBrushSelection = persistedBrushSelection
          committedBrushSelection = persistedBrushSelection
        }
      }

      const emitSelection = debounce((): void => {
        writeSelection(
          buildSelectionState(
            chart,
            latestNativeSelection,
            latestBrushSelection
          )
        )
      }, DEBOUNCE_TIME_MS)

      const commitBrushSelection = (): void => {
        committedBrushSelection = latestBrushSelection
        pendingBrushEnd = undefined
        if (chartId) {
          widgetMgr.setElementState(
            chartId,
            BRUSH_SELECTION_STATE_KEY,
            latestBrushSelection
          )
        }
        emitSelection()
      }

      const handleSelectChanged = (raw: unknown): void => {
        if (isRestoringRef.current) {
          return
        }
        const params = raw as SelectChangedParams
        const selected = normalizeNativeSelection(
          chart,
          latestNativeSelection,
          params
        )
        latestNativeSelection = selected
        // Persist the dispatchable native selection so it can be re-applied
        // visually after an option-replacing setOption or a remount.
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
        latestBrushSelection = params.batch ?? []
        if (isRestoringRef.current) {
          return
        }

        // Toolbox clear emits a full snapshot with one empty-area placeholder
        // per brush component, but no brushEnd.
        if (hasNoBrushAreas(latestBrushSelection)) {
          commitBrushSelection()
          return
        }

        // With throttling, the final brush snapshot can arrive after brushEnd.
        if (
          pendingBrushEnd &&
          brushEndMatchesSelection(latestBrushSelection, pendingBrushEnd)
        ) {
          commitBrushSelection()
        }
      }

      let polygonCompletedAt = 0
      let deferredClearTimer: ReturnType<typeof setTimeout> | undefined

      const handleBrushEnd = (raw: unknown): void => {
        const params = raw as BrushEndParams
        const areas = params.areas ?? []
        // Completing a lasso is itself a double-click on zrender, so record
        // when one landed and let the paired `dblclick` through without
        // clearing. Only a *new* polygon arms this: with the polygon tool still
        // active, double-clicking on top of a finished lasso re-commits the
        // same areas, and re-arming on that would make the lasso impossible to
        // clear.
        const committedBrush = findBrushSelectionForEnd(
          committedBrushSelection,
          params
        )
        const areasChanged = !brushAreasEqual(
          committedBrush?.areas ?? [],
          areas
        )
        if (
          !isRestoringRef.current &&
          areasChanged &&
          areas.some(area => area.brushType === "polygon")
        ) {
          polygonCompletedAt = Date.now()
        }
        if (isRestoringRef.current) {
          return
        }

        if (brushEndMatchesSelection(latestBrushSelection, params)) {
          commitBrushSelection()
        } else {
          // brushEnd contains only one component's areas. Wait for the
          // correlated full snapshot, regardless of its configured throttle.
          pendingBrushEnd = params
        }
      }

      const clearBoundSelection = (fromUser = true): void => {
        emitSelection.cancel()
        latestNativeSelection = []
        latestBrushSelection = []
        committedBrushSelection = []
        pendingBrushEnd = undefined
        clearSelection(fromUser)
      }
      clearBoundSelectionRef.current = clearBoundSelection

      const handleDoubleClick = (): void => {
        if (deferredClearTimer !== undefined) {
          clearTimeout(deferredClearTimer)
        }
        // Defer so a polygon-complete ``brushEnd`` on the same double-click is
        // recorded first, regardless of which zr listener runs first.
        // eslint-disable-next-line no-restricted-globals -- Coalesce zr dblclick with ECharts polygon brushEnd; not a React render timer.
        deferredClearTimer = setTimeout(() => {
          deferredClearTimer = undefined
          // Ignore only the double-click that completed a polygon. The window
          // expires so a later, deliberate double-click still clears a lasso
          // that was finished by dragging rather than double-clicking.
          if (Date.now() - polygonCompletedAt < POLYGON_COMPLETION_WINDOW_MS) {
            polygonCompletedAt = 0
            return
          }
          clearBoundSelection()
        }, 0)
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
        if (deferredClearTimer !== undefined) {
          clearTimeout(deferredClearTimer)
        }
        if (chartRef.current === chart) {
          chartRef.current = null
        }
        if (clearBoundSelectionRef.current === clearBoundSelection) {
          clearBoundSelectionRef.current = null
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
