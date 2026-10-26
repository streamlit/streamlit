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

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react"

import { debounce, isEqual } from "lodash-es"
import { getLogger } from "loglevel"

import type { EChartsChart as EChartsChartProto } from "@streamlit/protobuf"

import type { WidgetInfo, WidgetStateManager } from "~lib/WidgetStateManager"

import {
  type EChartsOptionObject,
  withDefaultSeriesCursor,
} from "./CustomTheme"
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
  parseOptionSpec,
  prunePixelOnlyBrushAreas,
  resolveSelectionOption,
  type SelectChangedParams,
  type SelectedEntry,
} from "./selectionModel"

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
 * Run one brush hit-test outside the user's throttle.
 *
 * ``debounce`` always defers ``brushSelected``, even at delay 0, and
 * ``fixRate`` defers while a drag is still inside ``throttleDelay``. Either
 * one can still be pending when a form submits, and either one would deliver
 * a resize prune's snapshot after its restore guard. ``fixRate`` at delay 0
 * publishes the snapshot on this turn; the user's settings are restored
 * before we return.
 */
function runWithSynchronousBrushHitTest(
  chart: EChartsSelectionInstance,
  run: () => void
): void {
  const restores: Array<() => void> = []
  // Call as a method so ECharts keeps its ``this``. ``setOption`` would
  // re-render the chart to change the same throttle fields.
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

  // Bind/emit gate: proto says this is a selection widget *and* the host
  // is not disabled. Distinct from ``element.selectionActivated``, which
  // restore, cursor defaults, and the disabled overlay still use so a
  // disconnected widget keeps its highlight.
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
  // A layout effect runs before the chart's passive effects, so prune and the
  // bound handlers never read a stale spec.
  useLayoutEffect(() => {
    parsedOptionRef.current = parsedOption
  }, [parsedOption])

  const clearBoundSelectionRef = useRef<(() => void) | null>(null)
  // Suppress widget emits from programmatic restore dispatches so a data-only
  // rerun cannot loop: ``restoreSelection`` runs while handlers are already
  // bound, and ECharts fires ``selectchanged`` for ``dispatchAction("select")``.
  const isRestoringRef = useRef(false)
  const latestBrushSelectionRef = useRef<BrushSelection[]>([])
  const committedBrushSelectionRef = useRef<BrushSelection[]>([])
  const flushPendingBrushForSubmitRef = useRef<(() => boolean) | null>(null)

  const widgetInfo: WidgetInfo = useMemo(
    () => ({ id: chartId, formId }),
    [chartId, formId]
  )

  // True after a write that did not request a rerun (`fromUser: false`).
  // A later user commit of that same JSON still has to call `setStringValue`
  // so the gesture reruns. Identical user writes stay skipped.
  const pendingUserRerunRef = useRef(false)

  const writeSelection = useCallback(
    (selection: EChartsSelectionState, fromUser = true): void => {
      const json = JSON.stringify({ selection })
      // Skip no-op updates to avoid needless reruns. A user commit still
      // goes out when the matching JSON was stored without a rerun.
      const currentValue = widgetMgr.getStringValue(widgetInfo)
      const sameValue =
        currentValue === json ||
        (currentValue === undefined && json === EMPTY_SELECTION_JSON)
      if (sameValue && !(fromUser && pendingUserRerunRef.current)) {
        return
      }
      pendingUserRerunRef.current = !fromUser
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
      // a disabled selection widget (host-disabled inputs or a dropped
      // connection) still needs its overlay put back after ``setOption``
      // clears native select/brush.
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
    (chart: EChartsSelectionInstance | null): void => {
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
      writeSelection(EMPTY_SELECTION)
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
      // No chart is bound yet, so only the stored selection needs clearing.
      clearSelection(null)
    }
  }, [clearSelection])

  const prunePixelOnlyBrushAfterResize = useCallback(
    (chart: EChartsSelectionInstance): void => {
      // Gate on the proto flag, not ``isSelectionActivated``. A host-disabled
      // or disconnected widget still records ``lastPositiveSizeRef``, so
      // skipping prune here would consume the size change and leave
      // pixel-only overlays (and mixed-brush hit indices) stale.
      if (!chartId || !element.selectionActivated) {
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
      // Captured before the hit-test replaces the dispatcher. A callback the
      // user's throttle scheduled earlier still holds a pre-prune snapshot.
      const scheduledHitTest = brushSelectDispatcher(chart)
      // Programmatic ``brush`` dispatches would otherwise re-enter the bound
      // handlers (empty snapshots look like toolbox-clear). Restore-style
      // suppression keeps resize from emitting a user rerun. The synchronous
      // hit-test delivers ``brushSelected`` inside this guard, whatever
      // throttle the spec configures.
      isRestoringRef.current = true
      try {
        runWithSynchronousBrushHitTest(chart, () => {
          for (const brush of current) {
            const nextAreas =
              pruned.find(item => item.brushIndex === brush.brushIndex)
                ?.areas ?? []
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
        isRestoringRef.current = false
      }
      // ``brushSelected`` still updates the snapshot during restore. When the
      // same component mixed coord + pixel-only areas, that rebuilds
      // ``selected`` from the remaining areas. Without bound handlers (a
      // disabled widget, or a test fake that fires no events), keep the
      // locally pruned copy.
      const nextBrush = latestBrushSelectionRef.current
      if (nextBrush !== pruned) {
        scheduledHitTest?.clear?.()
        committedBrushSelectionRef.current = nextBrush
        widgetMgr.setElementState(
          chartId,
          BRUSH_SELECTION_STATE_KEY,
          nextBrush
        )
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
    [chartId, formId, element.selectionActivated, widgetMgr, writeSelection]
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

      // Native and brush selection are independent ECharts channels. Cache their
      // full snapshots separately, then expose a deterministic grouped union.
      let latestNativeSelection: SelectedEntry[] = []
      let pendingBrushEnd: BrushEndParams | undefined
      latestBrushSelectionRef.current = []
      committedBrushSelectionRef.current = []

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

      const flushPendingBrushForSubmit = (): boolean => {
        if (!pendingBrushEnd) {
          return true
        }
        const pending = pendingBrushEnd
        const existing = findBrushSelectionForEnd(
          latestBrushSelectionRef.current,
          pending
        )
        // Captured before the hit-test replaces the dispatcher. The in-flight
        // callback still closes over the pre-submit snapshot.
        const scheduledHitTest = brushSelectDispatcher(chart)
        // Hit-test the finished areas on this turn. A throttled
        // ``brushSelected`` can still hold the previous point indices (or
        // none). Submitting those with the new areas would persist after
        // the delayed event, which only updates the next pending form value.
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
          LOG.warn("Failed to flush pending form brush snapshot", error)
        }
        // ``commitBrushSelection`` clears ``pendingBrushEnd`` when the
        // hit-test published matching indices.
        if (pendingBrushEnd !== pending) {
          scheduledHitTest?.clear?.()
          return true
        }
        // The hit-test did not publish indices. Refuse the submit so the
        // in-flight snapshot can fill the pending value; the next submit
        // sends that instead of the previous indices.
        LOG.warn("Form submit is waiting for the final brush hit indices")
        return false
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

      const clearBoundSelection = (): void => {
        emitSelectionDebounced.cancel()
        latestNativeSelection = []
        latestBrushSelectionRef.current = []
        committedBrushSelectionRef.current = []
        pendingBrushEnd = undefined
        clearSelection(chart)
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
    const validator = (): boolean =>
      flushPendingBrushForSubmitRef.current?.() ?? true
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
