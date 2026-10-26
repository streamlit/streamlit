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

import { debounce, isEqual } from "lodash-es"
import { getLogger } from "loglevel"

import type { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  brushAreasEqual,
  brushEndMatchesSelection,
  type BrushEndParams,
  type BrushSelectedParams,
  type BrushSelection,
  buildSelectionState,
  type EChartsSelectionState,
  findBrushSelectionForEnd,
  hasNoBrushAreas,
  normalizeNativeSelection,
  prunePixelOnlyBrushAreas,
  resolveSelectionOption,
  type SelectChangedParams,
  type SelectedEntry,
} from "./selectionModel"

const LOG = getLogger("EChartsSelectionBinding")

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

export const EMPTY_SELECTION: EChartsSelectionState = {
  selected: [],
  areas: [],
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

/**
 * ``getModel`` is private on ECharts' public type. Declaring it here would
 * make ``EChartsType`` unassignable to ``EChartsSelectionInstance``.
 */
interface BrushModelReader {
  getModel?: () => {
    eachComponent(
      query: { mainType: string },
      callback: (model: BrushComponentModel) => void
    ): void
  }
}

/** Brush component option fields that control ``brushSelected`` delivery. */
interface BrushComponentModel {
  option?: {
    throttleType?: string
    throttleDelay?: number
  }
}

/**
 * ECharts installs the throttled ``brushSelected`` dispatcher on zrender
 * under this key (``visualEncoding`` ``DISPATCH_METHOD``). ``clear`` cancels
 * a pending callback without flushing its stale snapshot.
 */
const BRUSH_SELECT_DISPATCH_KEY = "__ecBrushSelect"

interface BrushSelectDispatcher {
  clear?: () => void
}

function brushSelectDispatcher(
  chart: EChartsSelectionInstance
): BrushSelectDispatcher | undefined {
  const zr = chart.getZr() as {
    [BRUSH_SELECT_DISPATCH_KEY]?: BrushSelectDispatcher
  }
  return zr[BRUSH_SELECT_DISPATCH_KEY]
}

/**
 * Run ``run`` with every brush component's throttle disabled, so the
 * ``brushSelected`` it triggers fires on this turn.
 *
 * Form submit, resize pruning, and unbinding need the hit-test result
 * immediately; a user-configured ``debounce`` or ``fixRate`` throttle would
 * deliver it later. This mutates ECharts' private brush model (``setOption``
 * would re-render) and restores the user's throttle settings before
 * returning.
 */
function runWithSynchronousBrushHitTest(
  chart: EChartsSelectionInstance,
  run: () => void
): void {
  const restores: Array<() => void> = []
  // Call as a method so ECharts keeps its ``this``.
  ;(chart as BrushModelReader)
    .getModel?.()
    .eachComponent({ mainType: "brush" }, model => {
      const option = model.option
      if (!option) {
        return
      }
      const { throttleType, throttleDelay } = option
      option.throttleType = "fixRate"
      option.throttleDelay = 0
      restores.push(() => {
        option.throttleType = throttleType
        option.throttleDelay = throttleDelay
      })
    })
  try {
    run()
  } finally {
    for (const restore of restores) {
      restore()
    }
  }
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

/** Writes the public selection value (``fromUser`` defaults to ``true``). */
export type WriteSelection = (
  selection: EChartsSelectionState,
  fromUser?: boolean
) => void

/**
 * Clear both frontend-only snapshots and write an empty selection. Used
 * directly when a form clears before the chart instance exists.
 */
export function clearStoredSelection(
  widgetMgr: WidgetStateManager,
  chartId: string,
  writeSelection: WriteSelection
): void {
  widgetMgr.setElementState(chartId, BRUSH_SELECTION_STATE_KEY, [])
  widgetMgr.setElementState(chartId, SELECTED_POINTS_STATE_KEY, [])
  writeSelection(EMPTY_SELECTION)
}

export interface EChartsSelectionBindingOptions {
  chart: EChartsSelectionInstance
  /** The widget's element ID. */
  chartId: string
  /** Non-empty when the chart is inside a form. */
  formId: string
  widgetMgr: WidgetStateManager
  writeSelection: WriteSelection
  /** Reads the latest parsed spec, which can change without a rebind. */
  getParsedOption: () => Record<string, unknown> | null
  /**
   * Whether to attach selection handlers. A disabled widget still restores,
   * prunes, and clears its persisted selection, but cannot emit one.
   */
  isInteractive: boolean
}

/**
 * The selection state machine for one ECharts instance of one selection
 * widget. Holds the native and brush snapshots, the brush that is waiting on
 * its throttled hit-test, and the polygon / double-click pairing.
 */
export interface EChartsSelectionBinding {
  /**
   * Re-apply the persisted selection (natively selected points and brush
   * areas). An option-replacing ``setOption`` and ``setTheme`` both drop the
   * native select/brush visuals.
   */
  restore: () => void
  /**
   * Drop pixel-only brush overlays after a container resize. Regions without
   * ``coordRange`` no longer map to the resized chart, so they are removed from
   * private state and the on-screen overlay.
   */
  pruneAfterResize: () => void
  /** Clear the visible and the stored selection. */
  clear: () => void
  /**
   * Form-submit validator: hit-test a finished brush whose throttled
   * snapshot has not arrived. Returns ``false`` to hold the submit when the
   * hit-test published no matching indices.
   */
  flushPendingBrushForSubmit: () => boolean
  /**
   * Commit a finished brush still waiting on its throttled snapshot, flush
   * the pending write, and remove the handlers.
   */
  dispose: () => void
}

/**
 * Bind selection handling to a chart instance. Streamlit does not inject any
 * selection config: the handlers listen for whatever the user enabled in
 * their spec (``selectedMode`` on a series, a ``brush`` component).
 */
export function createEChartsSelectionBinding({
  chart,
  chartId,
  formId,
  widgetMgr,
  writeSelection,
  getParsedOption,
  isInteractive,
}: EChartsSelectionBindingOptions): EChartsSelectionBinding {
  const readPersisted = <T>(key: string): T[] => {
    const value = widgetMgr.getElementState<T[]>(chartId, key)
    return Array.isArray(value) ? value : []
  }

  // Suppress widget emits from programmatic restore, clear, and prune
  // dispatches: ECharts fires the same events for them as for a user gesture,
  // and an emit from restore would loop on every data-only rerun.
  let isRestoring = false

  // Native and brush selection are independent ECharts channels. Cache their
  // full snapshots separately, then expose a deterministic grouped union.
  // Seed both channels so an interaction after a remount cannot drop the
  // other channel's restored state.
  let latestNativeSelection = readPersisted<SelectedEntry>(
    SELECTED_POINTS_STATE_KEY
  )
  let latestBrushSelection = readPersisted<BrushSelection>(
    BRUSH_SELECTION_STATE_KEY
  )
  let committedBrushSelection = latestBrushSelection
  // A brushEnd whose matching full snapshot has not arrived yet.
  let pendingBrushEnd: BrushEndParams | undefined

  // One ``getOption()`` per event: native graph reconstruction and the
  // widget write both need the resolved series, and media/timeline
  // variants can make that call non-trivial.
  let resolvedOptionForEvent: Record<string, unknown> | null | undefined
  const resolveLiveOption = (): Record<string, unknown> | null => {
    if (resolvedOptionForEvent === undefined) {
      resolvedOptionForEvent = resolveSelectionOption(getParsedOption(), chart)
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
        committedBrushSelection
      )
    )
  }
  // Forms submit the current widget values immediately. Debouncing would
  // race a fast submit and drop the selection.
  const emitSelectionDebounced = debounce(emitSelectionNow, DEBOUNCE_TIME_MS)
  const emitSelection = formId ? emitSelectionNow : emitSelectionDebounced

  const commitBrushSelection = (): void => {
    committedBrushSelection = latestBrushSelection
    pendingBrushEnd = undefined
    widgetMgr.setElementState(
      chartId,
      BRUSH_SELECTION_STATE_KEY,
      latestBrushSelection
    )
    emitSelection()
  }

  /**
   * Commit a finished brush whose throttled ``brushSelected`` has not
   * arrived yet. Returns ``false`` when the hit-test published no
   * matching indices.
   */
  const flushPendingBrush = (): boolean => {
    if (!pendingBrushEnd) {
      return true
    }
    const pending = pendingBrushEnd
    const existing = findBrushSelectionForEnd(latestBrushSelection, pending)
    // Captured before the hit-test replaces the dispatcher. The in-flight
    // callback still closes over the previous snapshot.
    const scheduledHitTest = brushSelectDispatcher(chart)
    // Hit-test the finished areas synchronously. Otherwise the throttled
    // ``brushSelected`` may not have arrived yet: submit would pair the
    // new areas with the previous indices (the late event would only
    // update the next pending form value, not the submitted one), and
    // unbinding would drop the gesture.
    const brushTarget: Record<string, unknown> = {}
    if (typeof existing?.brushIndex === "number") {
      brushTarget.brushIndex = existing.brushIndex
    } else if (pending.brushId !== undefined) {
      brushTarget.brushId = pending.brushId
    }
    try {
      runWithSynchronousBrushHitTest(chart, () => {
        chart.dispatchAction({
          type: "brush",
          ...brushTarget,
          areas: pending.areas ?? [],
        })
      })
    } catch (error) {
      LOG.warn("Failed to hit-test the pending brush snapshot", error)
    }
    // ``commitBrushSelection`` clears ``pendingBrushEnd`` when the
    // hit-test published matching indices.
    if (pendingBrushEnd !== pending) {
      scheduledHitTest?.clear?.()
      return true
    }
    return false
  }

  const flushPendingBrushForSubmit = (): boolean => {
    if (flushPendingBrush()) {
      return true
    }
    // The hit-test did not publish indices. Refuse the submit so the
    // in-flight snapshot can fill the pending value; the next submit
    // sends that instead of the previous indices.
    LOG.warn("Form submit is waiting for the final brush hit indices")
    return false
  }

  const restore = (): void => {
    isRestoring = true
    try {
      // Re-apply natively selected points (an option-replacing setOption
      // clears the select state), then re-draw persisted brush areas.
      dispatchPointSelection(
        chart,
        readPersisted<SelectedEntry>(SELECTED_POINTS_STATE_KEY),
        "select"
      )
      for (const brush of readPersisted<BrushSelection>(
        BRUSH_SELECTION_STATE_KEY
      )) {
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
    } finally {
      isRestoring = false
    }
  }

  const clear = (): void => {
    emitSelectionDebounced.cancel()
    latestNativeSelection = []
    latestBrushSelection = []
    committedBrushSelection = []
    pendingBrushEnd = undefined
    isRestoring = true
    try {
      try {
        chart.dispatchAction({ type: "brush", areas: [] })
      } catch (error) {
        LOG.warn("Failed to clear brush selection", error)
      }
      // Deselect any natively selected points as well.
      dispatchPointSelection(
        chart,
        readPersisted<SelectedEntry>(SELECTED_POINTS_STATE_KEY),
        "unselect"
      )
    } finally {
      isRestoring = false
    }
    clearStoredSelection(widgetMgr, chartId, writeSelection)
  }

  const pruneAfterResize = (): void => {
    const current = readPersisted<BrushSelection>(BRUSH_SELECTION_STATE_KEY)
    const pruned = prunePixelOnlyBrushAreas(current)
    if (isEqual(pruned, current)) {
      return
    }
    latestBrushSelection = pruned
    committedBrushSelection = pruned
    widgetMgr.setElementState(chartId, BRUSH_SELECTION_STATE_KEY, pruned)
    // Captured before the hit-test replaces the dispatcher. A callback the
    // user's throttle scheduled earlier still holds a pre-prune snapshot.
    const scheduledHitTest = brushSelectDispatcher(chart)
    // A disabled widget has no bound handlers, so listen for the hit-test
    // here. When a component mixed coord + pixel-only areas, it rebuilds
    // ``selected`` from the remaining areas.
    const captureHitTest = (raw: unknown): void => {
      latestBrushSelection = (raw as BrushSelectedParams).batch ?? []
    }
    chart.on("brushSelected", captureHitTest)
    // Programmatic ``brush`` dispatches would otherwise re-enter the bound
    // handlers (empty snapshots look like toolbox-clear). Restore-style
    // suppression keeps resize from emitting a user rerun. The synchronous
    // hit-test delivers ``brushSelected`` inside this guard, whatever
    // throttle the spec configures.
    isRestoring = true
    try {
      runWithSynchronousBrushHitTest(chart, () => {
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
      })
    } finally {
      isRestoring = false
      chart.off("brushSelected", captureHitTest)
    }
    // A test fake that fires no events keeps the locally pruned copy.
    const nextBrush = latestBrushSelection
    if (nextBrush !== pruned) {
      scheduledHitTest?.clear?.()
      committedBrushSelection = nextBrush
      widgetMgr.setElementState(chartId, BRUSH_SELECTION_STATE_KEY, nextBrush)
    }
    // Inside a form, route through the pending dict so resize does not
    // commit a new value without submit. Outside a form, ``fromUser:
    // false`` updates committed state without a user rerun.
    writeSelection(
      buildSelectionState(
        resolveSelectionOption(getParsedOption(), chart),
        readPersisted<SelectedEntry>(SELECTED_POINTS_STATE_KEY),
        nextBrush
      ),
      Boolean(formId)
    )
  }

  const handleSelectChanged = (raw: unknown): void => {
    beginSelectionEvent()
    if (isRestoring) {
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
    widgetMgr.setElementState(chartId, SELECTED_POINTS_STATE_KEY, selected)
    emitSelection()
  }

  const handleBrushSelected = (raw: unknown): void => {
    beginSelectionEvent()
    const params = raw as BrushSelectedParams
    latestBrushSelection = params.batch ?? []
    if (isRestoring) {
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

  let polygonJustCompleted = false
  let deferredClearTimer: ReturnType<typeof setTimeout> | undefined

  const handleBrushEnd = (raw: unknown): void => {
    beginSelectionEvent()
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
      committedBrushSelection,
      params
    )
    const areasChanged = !brushAreasEqual(committedBrush?.areas ?? [], areas)
    if (
      !isRestoring &&
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
    if (isRestoring) {
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
      clear()
    }, 0)
  }

  const zr = chart.getZr()
  if (isInteractive) {
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
    zr.on("dblclick", handleDoubleClick)
  }

  const dispose = (): void => {
    if (!isInteractive) {
      return
    }
    // A rebind (disconnect, fragment change) inside the user's brush
    // throttle would drop a finished gesture whose ``brushSelected`` has
    // not arrived yet. Hit-test it while the handlers are still bound. A
    // torn-down chart is already disposed and cannot hit-test.
    if (!chart.isDisposed()) {
      flushPendingBrush()
    }
    // Flush a pending write even if the instance is already disposed —
    // the widget value does not need the chart. Cancel would drop it.
    emitSelectionDebounced.flush()
    if (deferredClearTimer !== undefined) {
      clearTimeout(deferredClearTimer)
    }
    // Unbinding from a disposed instance logs a console warning.
    if (chart.isDisposed()) {
      return
    }
    chart.off("selectchanged", handleSelectChanged)
    chart.off("brushSelected", handleBrushSelected)
    chart.off("brushEnd", handleBrushEnd)
    zr.off("dblclick", handleDoubleClick)
  }

  return {
    restore,
    pruneAfterResize,
    clear,
    flushPendingBrushForSubmit,
    dispose,
  }
}
