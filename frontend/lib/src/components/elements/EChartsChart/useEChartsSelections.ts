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

import { useCallback, useEffect, useMemo, useRef } from "react"

import { debounce, isEqual, isPlainObject } from "lodash-es"
import { getLogger } from "loglevel"

import { EChartsChart as EChartsChartProto } from "@streamlit/protobuf"

import { isNullOrUndefined } from "~lib/util/utils"
import { WidgetInfo, WidgetStateManager } from "~lib/WidgetStateManager"

import { EChartsOptionObject, withDefaultSeriesCursor } from "./CustomTheme"

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
   * Whether the chart is a selection widget (``on_select`` is not
   * ``"ignore"``) and the widget is not disabled. Keyed display-only charts
   * also have an element ID, so this is not ``Boolean(id)``.
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
  /**
   * Drop pixel-only brush overlays after a container resize. Regions without
   * ``coordRange`` no longer map to the resized chart, so they are removed from
   * private state and the on-screen overlay.
   */
  prunePixelOnlyBrushAfterResize: (chart: EChartsSelectionInstance) => void
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

function parseOptionSpec(spec: string): Record<string, unknown> | null {
  if (!spec) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(spec)
    return isPlainObject(parsed) ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** True when the option has a top-level ``series`` ECharts can address. */
function optionHasUsableSeries(
  option: Record<string, unknown> | null
): boolean {
  if (option === null) {
    return false
  }
  const series = option.series
  if (Array.isArray(series)) {
    return series.length > 0
  }
  return isPlainObject(series)
}

/**
 * True when media or timeline variants can replace top-level ``series``.
 *
 * Those overrides live on ``media[*].option``, ``options[]``, or nested
 * ``baseOption`` copies of the same. ECharts events index the resolved
 * series, so selection metadata must not use the stale base spec.
 */
function optionHasSeriesOverridingVariants(
  option: Record<string, unknown> | null
): boolean {
  if (option === null) {
    return false
  }
  if (Array.isArray(option.media)) {
    const mediaOverridesSeries = option.media.some(entry => {
      if (!isPlainObject(entry)) {
        return false
      }
      const mediaOption = (entry as Record<string, unknown>).option
      return (
        isPlainObject(mediaOption) &&
        optionHasUsableSeries(mediaOption as Record<string, unknown>)
      )
    })
    if (mediaOverridesSeries) {
      return true
    }
  }
  if (Array.isArray(option.options)) {
    const timelineOverridesSeries = option.options.some(
      entry =>
        isPlainObject(entry) &&
        optionHasUsableSeries(entry as Record<string, unknown>)
    )
    if (timelineOverridesSeries) {
      return true
    }
  }
  return isPlainObject(option.baseOption)
    ? optionHasSeriesOverridingVariants(
        option.baseOption as Record<string, unknown>
      )
    : false
}

/**
 * Prefer the parsed spec when it has series that variants cannot override;
 * otherwise use ``getOption()``.
 *
 * Timeline and media specs often keep series on nested variants, so the raw
 * spec has no top-level ``series``. When they *do* set top-level series, an
 * active media/timeline variant can still replace it. ECharts' resolved
 * option is the one events index.
 */
function resolveSelectionOption(
  parsedOption: Record<string, unknown> | null,
  chart: EChartsSelectionInstance
): Record<string, unknown> | null {
  if (
    optionHasUsableSeries(parsedOption) &&
    !optionHasSeriesOverridingVariants(parsedOption)
  ) {
    return parsedOption
  }
  return resolveChartOption(chart) ?? parsedOption
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

/**
 * User-configured series id/name only. ECharts ``getOption()`` backfills
 * auto-generated internal ids/names that contain a NUL separator; those must
 * not be reported as ``series_id`` / ``series_name``.
 */
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
  previous: SelectedEntry[],
  params: SelectChangedParams,
  getResolvedOption: () => Record<string, unknown> | null
): SelectedEntry[] {
  const payload = params.fromActionPayload
  const seriesIndex = payload?.seriesIndex
  const dataType = payload?.dataType
  // Cheap payload checks first so non-graph clicks never clone ``getOption()``.
  if (
    typeof seriesIndex !== "number" ||
    (dataType !== "node" && dataType !== "edge")
  ) {
    return params.selected ?? []
  }
  // Graph and Sankey (and any other linked node/edge series) share one
  // internal selected-index map, so the snapshot repeats matching raw
  // indices for both data types.
  const seriesOption = getSeriesOption(getResolvedOption(), seriesIndex)
  if (isNullOrUndefined(seriesOption)) {
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
    const isToggleOff =
      action === "unselect" ||
      (action?.startsWith("toggle") &&
        previous.some(entry => entry.seriesIndex === seriesIndex))
    return isToggleOff
      ? next
      : [...next, ...getGraphSeriesSelection(seriesIndex, seriesOption)]
  }

  // ECharts treats boolean ``true`` as ``"single"`` (see Series._innerSelect).
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
  resolvedOption: Record<string, unknown> | null,
  nativeSelection: SelectedEntry[],
  brushSelection: BrushSelection[]
): Array<Record<string, unknown>> {
  const groups = new Map<string, SelectionGroup>()
  appendSelectedEntries(groups, nativeSelection)
  for (const brush of brushSelection) {
    appendSelectedEntries(groups, brush.selected ?? [])
  }

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

/**
 * Build the public ``areas`` payload from the brushed regions.
 *
 * Regions ECharts only describes in pixel space are left out: without a
 * ``coordRange`` there is nothing an app can map back to its data. They stay in
 * the privately persisted brush selection, so the on-screen overlay is still
 * restored after a rerun.
 */
function buildAreas(
  brushSelection: BrushSelection[]
): Array<Record<string, unknown>> {
  return [...brushSelection]
    .sort((left, right) => left.brushIndex - right.brushIndex)
    .flatMap(brush =>
      (brush.areas ?? [])
        .filter(
          area =>
            typeof area.brushType === "string" &&
            Array.isArray(area.coordRange)
        )
        .map(area => ({
          brush_index: brush.brushIndex,
          brush_type: area.brushType,
          coord_range: area.coordRange,
        }))
    )
}

function buildSelectionState(
  resolvedOption: Record<string, unknown> | null,
  nativeSelection: SelectedEntry[],
  brushSelection: BrushSelection[]
): EChartsSelectionState {
  return {
    selected: buildSelectedGroups(
      resolvedOption,
      nativeSelection,
      brushSelection
    ),
    areas: buildAreas(brushSelection),
  }
}

function prunePixelOnlyBrushAreas(
  brushSelection: BrushSelection[]
): BrushSelection[] {
  return brushSelection.map(brush => {
    const areas = (brush.areas ?? []).filter(area =>
      Array.isArray(area.coordRange)
    )
    return {
      ...brush,
      areas,
      // Drop hit indices that belonged only to the removed overlay. Remaining
      // coord-range areas keep their previous ``selected`` snapshot.
      selected: areas.length === 0 ? [] : brush.selected,
    }
  })
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
 * Overlay a ``brushEnd`` onto the latest snapshot so a form submit can flush
 * before a throttled ``brushSelected`` arrives. Hit indices stay as they were
 * on the last snapshot (or empty); the delayed event replaces them.
 */
function applyBrushEndToSelection(
  brushSelection: BrushSelection[],
  params: BrushEndParams
): BrushSelection[] {
  const existing = findBrushSelectionForEnd(brushSelection, params)
  if (existing !== undefined) {
    return brushSelection.map(item =>
      item === existing ? { ...item, areas: params.areas ?? [] } : item
    )
  }
  return [
    ...brushSelection,
    {
      brushId: params.brushId,
      brushIndex: brushSelection.length,
      areas: params.areas ?? [],
      selected: [],
    },
  ]
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
  disabled = false,
  parsedOptionInput?: Record<string, unknown> | null
): UseEChartsSelectionsOutput {
  const chartId = element.id
  const formId = element.formId

  // Selection is active only when the backend registered this chart as a
  // widget (``on_select != "ignore"``). A key also assigns an ID for CSS /
  // remount identity, so a non-empty ID is not enough.
  const isSelectionActivated = element.selectionActivated && !disabled
  const parsedOption = useMemo(
    () =>
      parsedOptionInput !== undefined
        ? parsedOptionInput
        : parseOptionSpec(element.spec),
    [parsedOptionInput, element.spec]
  )
  // Keep the parsed spec in a ref so bind/prune callbacks stay stable across
  // data-only updates (keyed live data, fragment reruns). Rebinding would
  // cancel a pending debounce and drop the widget write.
  const parsedOptionRef = useRef(parsedOption)
  parsedOptionRef.current = parsedOption

  // Keep the latest bound chart so form-clear resets can clear the visible brush.
  const chartRef = useRef<EChartsSelectionInstance | null>(null)
  const clearBoundSelectionRef = useRef<((fromUser?: boolean) => void) | null>(
    null
  )
  // Suppress widget emits from programmatic restore dispatches so a data-only
  // rerun cannot loop: ``restoreSelection`` runs while handlers are already
  // bound, and ECharts fires ``selectchanged`` for ``dispatchAction("select")``.
  const isRestoringRef = useRef(false)
  // Programmatic ``brush`` dispatches still go through ECharts' throttle.
  // A delayed ``brushSelected`` after prune must update widget state.
  const awaitingPrunedBrushRef = useRef(false)
  const latestBrushSelectionRef = useRef<BrushSelection[]>([])
  const committedBrushSelectionRef = useRef<BrushSelection[]>([])
  const flushPendingBrushForSubmitRef = useRef<(() => void) | null>(null)

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
      // Gate the cursor default on the proto flag, not ``isSelectionActivated``.
      // Folding in ``disabled`` would rewrite the option on disconnect and
      // replay the entry animation.
      if (!element.selectionActivated) {
        // Display-only charts aren't clickable, so don't imply it via the
        // default "pointer" cursor on series items.
        return withDefaultSeriesCursor(option)
      }
      // Selection widgets are left untouched: the user configures selection in
      // their own spec (`selectedMode`, `brush`); we only listen and report.
      return option
    },
    [element.selectionActivated]
  )

  const restoreSelection = useCallback(
    (chart: EChartsSelectionInstance): void => {
      // Keyed display-only charts also have an element ID (CSS class + remount
      // identity). Restoring against that ID would re-apply leftover widget
      // state after ``on_select`` is turned off, with no handlers bound to
      // clear the highlight. Gate on the proto flag, not ``isSelectionActivated``:
      // a disabled selection widget (script running / websocket drop) still
      // needs its overlay put back after ``setOption`` clears native select/brush.
      if (!chartId || !element.selectionActivated) {
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
    [chartId, element.selectionActivated, widgetMgr]
  )

  const clearSelection = useCallback(
    (fromUser = true): void => {
      const chart = chartRef.current
      if (chart) {
        // Programmatic unselect/brush-clear fire the same events as a user
        // gesture. Suppress the emit so we write empty once via this path.
        isRestoringRef.current = true
        try {
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
        } finally {
          isRestoringRef.current = false
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
    // Match Plotly/Vega/basic widgets: ``fromUser: true`` writes into the
    // form's pending dict. Python keeps the last submitted selection until
    // the next submit.
    if (clearBoundSelectionRef.current) {
      clearBoundSelectionRef.current()
    } else {
      clearSelection()
    }
  }, [clearSelection])

  const prunePixelOnlyBrushAfterResize = useCallback(
    (chart: EChartsSelectionInstance): void => {
      if (!chartId || !isSelectionActivated) {
        return
      }
      const current = widgetMgr.getElementState<BrushSelection[]>(
        chartId,
        BRUSH_SELECTION_STATE_KEY
      )
      if (!Array.isArray(current)) {
        return
      }
      const pruned = prunePixelOnlyBrushAreas(current)
      if (isEqual(pruned, current)) {
        return
      }
      latestBrushSelectionRef.current = pruned
      committedBrushSelectionRef.current = pruned
      widgetMgr.setElementState(chartId, BRUSH_SELECTION_STATE_KEY, pruned)
      const nativeSelection = widgetMgr.getElementState<SelectedEntry[]>(
        chartId,
        SELECTED_POINTS_STATE_KEY
      )
      // Programmatic ``brush`` dispatches would otherwise re-enter the bound
      // handlers (empty snapshots look like toolbox-clear). Restore-style
      // suppression keeps resize from emitting a user rerun.
      awaitingPrunedBrushRef.current = true
      isRestoringRef.current = true
      try {
        for (const brush of current) {
          const nextAreas =
            pruned.find(item => item.brushIndex === brush.brushIndex)?.areas ??
            []
          try {
            chart.dispatchAction({
              type: "brush",
              brushIndex: brush.brushIndex,
              areas: nextAreas,
            })
          } catch (error) {
            LOG.warn(
              "Failed to prune pixel-only brush areas after resize",
              error
            )
          }
        }
      } finally {
        isRestoringRef.current = false
      }
      // ``brushSelected`` still updates the snapshot during restore. When the
      // same component mixed coord + pixel-only areas, that rebuilds
      // ``selected`` from the remaining areas. Fake ``dispatchAction`` in
      // tests does not fire events, so fall back to the locally pruned copy.
      const nextBrush = latestBrushSelectionRef.current
      if (nextBrush !== pruned) {
        committedBrushSelectionRef.current = nextBrush
        widgetMgr.setElementState(
          chartId,
          BRUSH_SELECTION_STATE_KEY,
          nextBrush
        )
        awaitingPrunedBrushRef.current = false
      }
      // Inside a form, route through the pending dict so resize does not
      // commit a new value without submit. Outside a form, ``fromUser:
      // false`` updates committed state without a user rerun.
      writeSelection(
        buildSelectionState(
          resolveSelectionOption(parsedOptionRef.current, chart),
          Array.isArray(nativeSelection) ? nativeSelection : [],
          nextBrush
        ),
        Boolean(formId)
      )
    },
    [chartId, formId, isSelectionActivated, widgetMgr, writeSelection]
  )

  const bindSelections = useCallback(
    (chart: EChartsSelectionInstance): (() => void) => {
      if (!isSelectionActivated) {
        // Display-only charts bind nothing. A disabled selection widget still
        // re-applies persisted overlay so in-chart edits cannot leak.
        if (element.selectionActivated) {
          restoreSelection(chart)
        }
        return () => {}
      }

      chartRef.current = chart

      // Native and brush selection are independent ECharts channels. Cache their
      // full snapshots separately, then expose a deterministic grouped union.
      let latestNativeSelection: SelectedEntry[] = []
      let pendingBrushEnd: BrushEndParams | undefined
      latestBrushSelectionRef.current = []
      committedBrushSelectionRef.current = []
      awaitingPrunedBrushRef.current = false

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
          latestBrushSelectionRef.current = persistedBrushSelection
          committedBrushSelectionRef.current = persistedBrushSelection
        }
      }

      // One ``getOption()`` per event: native graph reconstruction and the
      // widget write both need the resolved series, and media/timeline
      // variants can make that call non-trivial.
      let resolvedOptionForEvent: Record<string, unknown> | null | undefined
      const resolveLiveOption = (): Record<string, unknown> | null => {
        if (resolvedOptionForEvent === undefined) {
          resolvedOptionForEvent = resolveSelectionOption(
            parsedOptionRef.current,
            chart
          )
        }
        return resolvedOptionForEvent
      }
      const beginSelectionEvent = (): void => {
        resolvedOptionForEvent = undefined
      }

      const emitSelectionNow = (): void => {
        writeSelection(
          buildSelectionState(
            resolveLiveOption(),
            latestNativeSelection,
            committedBrushSelectionRef.current
          )
        )
      }
      // Forms submit the current widget values immediately. Debouncing would
      // race a fast submit and drop the selection.
      const emitSelectionDebounced = debounce(
        emitSelectionNow,
        DEBOUNCE_TIME_MS
      )
      const emitSelection = formId ? emitSelectionNow : emitSelectionDebounced

      const commitBrushSelection = (): void => {
        committedBrushSelectionRef.current = latestBrushSelectionRef.current
        pendingBrushEnd = undefined
        if (chartId) {
          widgetMgr.setElementState(
            chartId,
            BRUSH_SELECTION_STATE_KEY,
            latestBrushSelectionRef.current
          )
        }
        emitSelection()
      }

      const flushPendingBrushForSubmit = (): void => {
        if (!pendingBrushEnd) {
          return
        }
        // Form submit copies widget values immediately. Overlay the finished
        // areas now; keep ``pendingBrushEnd`` so a delayed ``brushSelected``
        // can still replace this with the full hit indices.
        latestBrushSelectionRef.current = applyBrushEndToSelection(
          latestBrushSelectionRef.current,
          pendingBrushEnd
        )
        committedBrushSelectionRef.current = latestBrushSelectionRef.current
        if (chartId) {
          widgetMgr.setElementState(
            chartId,
            BRUSH_SELECTION_STATE_KEY,
            latestBrushSelectionRef.current
          )
        }
        emitSelection()
      }
      flushPendingBrushForSubmitRef.current = flushPendingBrushForSubmit

      const handleSelectChanged = (raw: unknown): void => {
        beginSelectionEvent()
        if (isRestoringRef.current) {
          return
        }
        const params = raw as SelectChangedParams
        const selected = normalizeNativeSelection(
          latestNativeSelection,
          params,
          resolveLiveOption
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
        beginSelectionEvent()
        const params = raw as BrushSelectedParams
        latestBrushSelectionRef.current = params.batch ?? []
        if (isRestoringRef.current) {
          return
        }
        if (awaitingPrunedBrushRef.current) {
          awaitingPrunedBrushRef.current = false
          committedBrushSelectionRef.current = latestBrushSelectionRef.current
          if (chartId) {
            widgetMgr.setElementState(
              chartId,
              BRUSH_SELECTION_STATE_KEY,
              latestBrushSelectionRef.current
            )
          }
          writeSelection(
            buildSelectionState(
              resolveLiveOption(),
              latestNativeSelection,
              latestBrushSelectionRef.current
            ),
            Boolean(formId)
          )
          return
        }

        // Toolbox clear emits a full snapshot with one empty-area placeholder
        // per brush component, but no brushEnd.
        if (hasNoBrushAreas(latestBrushSelectionRef.current)) {
          commitBrushSelection()
          return
        }

        // With throttling, the final brush snapshot can arrive after brushEnd.
        if (
          pendingBrushEnd &&
          brushEndMatchesSelection(
            latestBrushSelectionRef.current,
            pendingBrushEnd
          )
        ) {
          commitBrushSelection()
        }
      }

      let polygonJustCompleted = false
      let deferredClearTimer: ReturnType<typeof setTimeout> | undefined

      const handleBrushEnd = (raw: unknown): void => {
        beginSelectionEvent()
        awaitingPrunedBrushRef.current = false
        const params = raw as BrushEndParams
        const areas = params.areas ?? []
        // Completing a lasso may be a double-click on zrender, but ECharts 6
        // also finishes a drag-drawn polygon on mouseup with no paired
        // ``dblclick``. Arm a consume-once flag for same-turn pairing, and
        // expire it at the end of this turn when no deferred clear is pending.
        // Only a *new* polygon arms this: with the polygon tool still active,
        // double-clicking on top of a finished lasso re-commits the same
        // areas, and re-arming on that would make the lasso impossible to
        // clear.
        const committedBrush = findBrushSelectionForEnd(
          committedBrushSelectionRef.current,
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
          polygonJustCompleted = true
          // Expire at the end of this turn unless a deferred dblclick is
          // already waiting to pair with this brushEnd. setTimeout(0) keeps
          // that pairing FIFO with handleDoubleClick's deferred clear.
          // eslint-disable-next-line no-restricted-globals -- Coalesce with zr dblclick; not a React render timer.
          setTimeout(() => {
            if (deferredClearTimer === undefined) {
              polygonJustCompleted = false
            }
          }, 0)
        }
        if (isRestoringRef.current) {
          return
        }

        if (
          brushEndMatchesSelection(latestBrushSelectionRef.current, params)
        ) {
          commitBrushSelection()
        } else {
          // brushEnd contains only one component's areas. Wait for the
          // correlated full snapshot, regardless of its configured throttle.
          pendingBrushEnd = params
        }
      }

      const clearBoundSelection = (fromUser = true): void => {
        emitSelectionDebounced.cancel()
        latestNativeSelection = []
        latestBrushSelectionRef.current = []
        committedBrushSelectionRef.current = []
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
          // Ignore only the double-click that completed a polygon.
          if (polygonJustCompleted) {
            polygonJustCompleted = false
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
        // Flush a pending write even if the instance is already disposed —
        // the widget value does not need the chart. Cancel would drop it.
        emitSelectionDebounced.flush()
        if (deferredClearTimer !== undefined) {
          clearTimeout(deferredClearTimer)
        }
        if (chartRef.current === chart) {
          chartRef.current = null
        }
        if (clearBoundSelectionRef.current === clearBoundSelection) {
          clearBoundSelectionRef.current = null
        }
        if (
          flushPendingBrushForSubmitRef.current === flushPendingBrushForSubmit
        ) {
          flushPendingBrushForSubmitRef.current = null
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
    [
      isSelectionActivated,
      element.selectionActivated,
      chartId,
      formId,
      widgetMgr,
      writeSelection,
      clearSelection,
      restoreSelection,
    ]
  )

  useEffect(() => {
    if (!formId || !chartId || !isSelectionActivated) {
      return
    }
    const validator = (): boolean => {
      flushPendingBrushForSubmitRef.current?.()
      return true
    }
    widgetMgr.addFormSubmitValidator(formId, chartId, validator)
    return () => {
      widgetMgr.removeFormSubmitValidator(formId, chartId)
    }
  }, [formId, chartId, isSelectionActivated, widgetMgr])

  return {
    isSelectionActivated,
    configureSelectionOption,
    bindSelections,
    restoreSelection,
    onFormCleared,
    prunePixelOnlyBrushAfterResize,
  }
}
