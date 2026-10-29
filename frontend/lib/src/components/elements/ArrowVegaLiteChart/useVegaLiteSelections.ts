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

import { useCallback, useRef } from "react"

import { isEqual } from "lodash-es"
import { getLogger } from "loglevel"
import type { SignalValue, View as VegaView } from "vega"

import {
  isNullOrUndefined,
  isValidFormId,
  notNullOrUndefined,
} from "~lib/util/utils"
import type { WidgetInfo, WidgetStateManager } from "~lib/WidgetStateManager"

import type { VegaLiteChartElement } from "./arrowUtils"

/** Delay for continuous selection changes such as hover and wheel zoom. */
const DEBOUNCE_TIME_MS = 150

/** Events whose selection changes send immediately in the same task. */
const DISCRETE_INPUT_EVENTS = ["click", "dblclick", "keydown", "keyup"]
/** Events that end the discrete-input window or resume a held drag. */
const CONTINUOUS_INPUT_EVENTS = ["pointermove", "wheel"]

/** This is the state that is sent to the backend
 * This needs to be the same structure that is also defined
 * in the Python code.
 */
interface VegaLiteState {
  selection: Record<string, unknown>
}

interface UseVegaLiteSelectionsOutput {
  maybeConfigureSelections: (view: VegaView) => VegaView
  /** Flushes queued changes and removes listeners from the active view. */
  teardownSelections: () => void
  onFormCleared: () => void
  /**
   * Ends restore suppression so later user gestures can update the widget.
   */
  endSelectionRestore: () => void
}

interface VegaViewState {
  signals?: Record<string, unknown> | null
  data?: unknown
}

/**
 * Suffixes of interval-param signals that are not extents. Restoring them
 * would resume a drag, pulse scale-trigger, or notify Streamlit's named-param
 * listener.
 */
const INTERVAL_TRANSIENT_SIGNAL_SUFFIXES = new Set([
  "tuple",
  "tuple_fields",
  "scale_trigger",
  "modify",
  "translate_anchor",
  "translate_delta",
  "zoom_anchor",
  "zoom_delta",
  "toggle",
  "init",
])

/** Scale types whose interval scale-trigger zeros the pixel extent on resize. */
const NON_CONTINUOUS_SCALE_TYPES = new Set([
  "band",
  "point",
  "ordinal",
  "bin-ordinal",
])

/** True when Vega knows this signal. View.signal throws otherwise. */
const hasSignal = (view: VegaView, name: string): boolean => {
  try {
    view.signal(name)
    return true
  } catch {
    return false
  }
}

const isNonContinuousChannelScale = (
  view: VegaView,
  channel: "x" | "y"
): boolean => {
  try {
    const scale = view.scale(channel) as { type?: string }
    return (
      typeof scale.type === "string" &&
      NON_CONTINUOUS_SCALE_TYPES.has(scale.type)
    )
  } catch {
    // Unknown scale names (layered/independent scales) are not restorable.
    return true
  }
}

/**
 * Interval params whose overlay can be restored from extents. Band, point,
 * and ordinal interval channels stay on the store-only path: Vega-Lite's
 * scale-trigger sets their pixel extent to `[0, 0]` on resize, which nulls
 * the data extent and would clear the restored store.
 */
const getRestorableIntervalParams = (
  view: VegaView,
  selectionMode: readonly string[]
): Set<string> =>
  new Set(
    selectionMode.filter(param => {
      const xIsVisual = hasSignal(view, `${param}_x`)
      const yIsVisual = hasSignal(view, `${param}_y`)
      if (!xIsVisual && !yIsVisual) {
        return false
      }
      return !(
        (xIsVisual && isNonContinuousChannelScale(view, "x")) ||
        (yIsVisual && isNonContinuousChannelScale(view, "y"))
      )
    })
  )

const longestFirst = (params: readonly string[]): string[] =>
  [...params].toSorted((left, right) => right.length - left.length)

/** Longest param prefix wins, so `brush` does not match `brush_point_*`. */
const matchingSelectionParam = (
  selectionParams: readonly string[],
  name: string
): string | undefined =>
  selectionParams.find(param => name.startsWith(`${param}_`))

/**
 * Whether `name` is a stable interval extent for one of `intervalParams`:
 * visual `{param}_x` / `{param}_y` ranges and matching `{param}_{field}`
 * data-space ranges. Matches the longest selection-mode prefix first so a
 * nested point/legend param such as `brush_point` is not claimed by `brush`.
 */
const isPersistedIntervalExtentSignal = (
  view: VegaView,
  intervalParams: ReadonlySet<string>,
  selectionParams: readonly string[],
  name: string
): boolean => {
  if (!hasSignal(view, name)) {
    return false
  }
  const param = matchingSelectionParam(selectionParams, name)
  if (param === undefined || !intervalParams.has(param)) {
    return false
  }
  const suffix = name.slice(param.length + 1)
  return suffix.length > 0 && !INTERVAL_TRANSIENT_SIGNAL_SUFFIXES.has(suffix)
}

/**
 * Keeps only the `{param}_store` datasets for the chart's selection params.
 * Other snapshot data is never restored.
 */
const pickSelectionStores = (
  data: unknown,
  selectionMode: readonly string[]
): unknown => {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return data
  }
  return Object.fromEntries(
    Object.entries(data as Record<string, unknown>).filter(([name]) =>
      selectionMode.some(mode => `${mode}_store` === name)
    )
  )
}

/**
 * Drops snapshot signals the new view does not define, and drops transient
 * or non-restorable interval machinery, so a structural change cannot apply
 * stale pixels. Legacy snapshots without `signals` restore selection-store
 * data only.
 */
const sanitizeViewStateForRestore = (
  view: VegaView,
  viewState: VegaViewState,
  selectionMode: readonly string[]
): VegaViewState => {
  const data = pickSelectionStores(viewState.data, selectionMode)
  if (isNullOrUndefined(viewState.signals)) {
    return { data }
  }

  const intervalParams = getRestorableIntervalParams(view, selectionMode)
  const selectionParams = longestFirst(selectionMode)
  const signals = Object.fromEntries(
    Object.entries(viewState.signals).filter(([name]) =>
      isPersistedIntervalExtentSignal(
        view,
        intervalParams,
        selectionParams,
        name
      )
    )
  )
  if (Object.keys(signals).length === 0) {
    return { data }
  }
  return { data, signals }
}

interface DebouncedSelection {
  value: SignalValue
  timerId: ReturnType<typeof setTimeout>
}

const LOG = getLogger("useVegaLiteSelections")

/**
 * Hook that configures selection events for a Vega-Lite chart.
 *
 * @param element The vega-lite chart element
 * @param widgetMgr The widget manager
 * @param fragmentId The fragment id of the element
 */
export const useVegaLiteSelections = (
  element: VegaLiteChartElement,
  widgetMgr: WidgetStateManager,
  fragmentId?: string
): UseVegaLiteSelectionsOutput => {
  const { id: chartId, formId, selectionMode } = element
  const teardownRef = useRef<(() => void) | null>(null)
  const endSelectionRestoreRef = useRef<(() => void) | null>(null)

  const teardownSelections = useCallback(() => {
    teardownRef.current?.()
    teardownRef.current = null
    // Drop the restore-end callback so a superseded createView cannot
    // unsuppress the next view's restore window.
    endSelectionRestoreRef.current = null
  }, [])

  const endSelectionRestore = useCallback(() => {
    endSelectionRestoreRef.current?.()
  }, [])

  const maybeConfigureSelections = useCallback(
    (vegaView: VegaView): VegaView => {
      teardownSelections()

      if (selectionMode.length === 0) {
        return vegaView
      }

      let isActive = true
      let isRestoreSuppressed = false
      let isPointerDown = false
      let activePointerId: number | null = null
      let pointerGestureId = 0
      let pendingPointerReleaseGestureId: number | null = null
      let isDiscreteInputTask = false
      let discreteInputResetTimerId: ReturnType<typeof setTimeout> | null =
        null
      const heldSelections = new Map<string, SignalValue>()
      const debouncedSelections = new Map<string, DebouncedSelection>()
      const signalListeners = new Map<
        string,
        (name: string, value: SignalValue) => void
      >()

      const clearDiscreteInput = (): void => {
        isDiscreteInputTask = false
        if (discreteInputResetTimerId !== null) {
          clearTimeout(discreteInputResetTimerId)
          discreteInputResetTimerId = null
        }
      }

      const handleDiscreteInput = (event?: Event): void => {
        if (
          (event?.type === "keydown" || event?.type === "keyup") &&
          (event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLTextAreaElement)
        ) {
          return
        }
        clearDiscreteInput()
        isDiscreteInputTask = true
        // Keep the marker through microtasks queued by this input event, but
        // never let it classify a later task as part of the same action.
        // eslint-disable-next-line no-restricted-globals -- This task marker is local to the imperative Vega event lifecycle.
        discreteInputResetTimerId = setTimeout(clearDiscreteInput, 0)
      }

      const clearDebouncedSelection = (name: string): void => {
        const debouncedSelection = debouncedSelections.get(name)
        if (debouncedSelection) {
          clearTimeout(debouncedSelection.timerId)
          debouncedSelections.delete(name)
        }
      }

      const holdDebouncedSelections = (): void => {
        debouncedSelections.forEach((debouncedSelection, name) => {
          clearTimeout(debouncedSelection.timerId)
          heldSelections.set(name, debouncedSelection.value)
        })
        debouncedSelections.clear()
      }

      const startPointerGesture = (event: PointerEvent): void => {
        // Ignore additional pointers while the initiating pointer is held. A
        // new gesture may start while the previous release is still settling.
        if (isPointerDown && pendingPointerReleaseGestureId === null) {
          return
        }
        holdDebouncedSelections()
        clearDiscreteInput()
        pointerGestureId += 1
        activePointerId = event.pointerId
        isPointerDown = true
        pendingPointerReleaseGestureId = null
      }

      const isChartPointerEvent = (event: PointerEvent): boolean => {
        const target = event.target
        return (
          event.isPrimary !== false &&
          target instanceof Element &&
          target.closest(".vega-bindings, select, input, textarea, button") ===
            null &&
          target.closest("canvas, svg") !== null
        )
      }

      const handlePointerDown = (event: PointerEvent): void => {
        if (event.button !== 0 || !isChartPointerEvent(event)) {
          return
        }
        startPointerGesture(event)
      }

      /**
       * Resumes a drag that re-enters the chart with the primary button held;
       * otherwise ends the click/key window so hover and wheel changes debounce.
       */
      const handleContinuousInput = (event: Event): void => {
        if (event.type === "pointermove") {
          const pointerEvent = event as PointerEvent
          const canStartGesture =
            !isPointerDown ||
            (pendingPointerReleaseGestureId !== null &&
              pointerEvent.pointerId === activePointerId)
          if (
            canStartGesture &&
            (pointerEvent.buttons & 1) !== 0 &&
            isChartPointerEvent(pointerEvent)
          ) {
            startPointerGesture(pointerEvent)
            return
          }
        }
        if (!isPointerDown) {
          clearDiscreteInput()
        }
      }

      const sendSelections = (
        selections: ReadonlyMap<string, SignalValue>
      ): void => {
        if (selections.size === 0) {
          return
        }

        // Persist selection-store data plus stable interval extents so remounts
        // and fullscreen can restore selected marks and the brush overlay
        // without syncing view state to Python.
        const intervalParams = getRestorableIntervalParams(
          vegaView,
          selectionMode
        )
        const selectionParams = longestFirst(selectionMode)

        const viewState = vegaView.getState({
          data: (nameArg?: string, _operator?: unknown) => {
            // Vega-Lite stores each selection in `<param name>_store`.
            // https://vega.github.io/vega/docs/api/view/#view_getState
            return selectionMode.some(mode => `${mode}_store` === nameArg)
          },
          signals: (name?: string) =>
            typeof name === "string" &&
            isPersistedIntervalExtentSignal(
              vegaView,
              intervalParams,
              selectionParams,
              name
            ),
          // Restoring subcontext data can cause Vega to throw.
          recurse: false,
        })

        if (notNullOrUndefined(viewState)) {
          widgetMgr.setElementState(chartId, "viewState", viewState)
        }

        const widgetInfo: WidgetInfo = { id: chartId, formId }
        const currentWidgetState = JSON.parse(
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- blank widget state parses as an empty object
          widgetMgr.getStringValue(widgetInfo) || "{}"
        )
        const selection = {
          ...currentWidgetState?.selection,
        }

        selections.forEach((value, name) => {
          // Return selected points directly instead of Vega-Lite's vlPoint wrapper:
          // https://github.com/vega/altair/blob/f1b4e2c84da2fba220022c8a285cc8280f824ed8/altair/utils/selection.py#L50
          let processedSelection = value
          if (
            typeof value === "object" &&
            value !== null &&
            "vlPoint" in value &&
            typeof value.vlPoint === "object" &&
            value.vlPoint !== null &&
            "or" in value.vlPoint
          ) {
            processedSelection = value.vlPoint.or
          }
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- a falsy signal still falls back to an empty selection
          selection[name] = processedSelection || {}
        })

        const updatedState: VegaLiteState = {
          selection,
        }

        if (!isEqual(currentWidgetState, updatedState)) {
          widgetMgr.setStringValue(
            widgetInfo.id,
            JSON.stringify(updatedState),
            {
              formId: widgetInfo.formId,
              fragmentId,
              fromUser: true,
            }
          )
        }
      }

      const sendSelection = (name: string, value: SignalValue): void => {
        sendSelections(new Map([[name, value]]))
      }

      const debounceSelection = (name: string, value: SignalValue): void => {
        clearDebouncedSelection(name)
        const debouncedSelection: DebouncedSelection = {
          value,
          // eslint-disable-next-line no-restricted-globals -- Selection signals are scheduled outside React's lifecycle.
          timerId: setTimeout(() => {
            if (debouncedSelections.get(name) !== debouncedSelection) {
              return
            }
            debouncedSelections.delete(name)
            sendSelection(name, debouncedSelection.value)
          }, DEBOUNCE_TIME_MS),
        }
        debouncedSelections.set(name, debouncedSelection)
      }

      const flushHeldSelections = (): void => {
        if (heldSelections.size === 0) {
          return
        }
        const selections = new Map(heldSelections)
        heldSelections.clear()
        sendSelections(selections)
      }

      const flushHeldSelectionsSafely = (): void => {
        try {
          flushHeldSelections()
        } catch (error) {
          LOG.warn("Failed to flush Vega selections", error)
        }
      }

      const finishActivePointerGesture = (): void => {
        isPointerDown = false
        activePointerId = null
        pendingPointerReleaseGestureId = null
        handleDiscreteInput()
        flushHeldSelectionsSafely()
      }

      const finishPointerRelease = async (
        releasedGestureId: number
      ): Promise<void> => {
        try {
          // Wait for Vega to process the release so its final signal values are
          // held and sent in one update.
          await vegaView.runAsync()
        } catch (error) {
          LOG.warn("Failed to finish Vega pointer gesture processing", error)
        } finally {
          if (
            isActive &&
            pointerGestureId === releasedGestureId &&
            pendingPointerReleaseGestureId === releasedGestureId
          ) {
            // Signals queued by the release belong to the same discrete input.
            finishActivePointerGesture()
          }
        }
      }

      const schedulePointerGestureFinish = (): void => {
        if (!isPointerDown || pendingPointerReleaseGestureId !== null) {
          return
        }
        const releasedGestureId = pointerGestureId
        pendingPointerReleaseGestureId = releasedGestureId
        void finishPointerRelease(releasedGestureId)
      }

      const handlePointerRelease = (event: PointerEvent): void => {
        if (!isPointerDown || event.pointerId !== activePointerId) {
          return
        }
        schedulePointerGestureFinish()
      }

      const handlePointerOut = (event: PointerEvent): void => {
        // A null relatedTarget means the pointer left the document, where the
        // window may not receive the eventual pointerup.
        if (
          event.relatedTarget !== null ||
          event.pointerId !== activePointerId
        ) {
          return
        }
        schedulePointerGestureFinish()
      }

      const handleWindowBlur = (): void => {
        schedulePointerGestureFinish()
      }

      const handleContextMenu = (): void => {
        if (isPointerDown) {
          schedulePointerGestureFinish()
        } else {
          handleDiscreteInput()
        }
      }

      const container = vegaView.container()
      container?.addEventListener("pointerdown", handlePointerDown, {
        capture: true,
        passive: true,
      })
      container?.addEventListener("pointerout", handlePointerOut, {
        passive: true,
      })
      container?.addEventListener("contextmenu", handleContextMenu, {
        capture: true,
        passive: true,
      })
      DISCRETE_INPUT_EVENTS.forEach(type =>
        container?.addEventListener(type, handleDiscreteInput, {
          capture: true,
          passive: true,
        })
      )
      CONTINUOUS_INPUT_EVENTS.forEach(type =>
        container?.addEventListener(type, handleContinuousInput, {
          capture: true,
          passive: true,
        })
      )
      // Window-level listeners catch releases after a drag leaves the chart.
      window.addEventListener("pointerup", handlePointerRelease)
      window.addEventListener("pointercancel", handlePointerRelease)
      window.addEventListener("pointerout", handlePointerOut)
      window.addEventListener("blur", handleWindowBlur)

      // Add listeners for all selection events. Find out more here:
      // https://vega.github.io/vega/docs/api/view/#view_addSignalListener
      selectionMode.forEach(param => {
        const handleSignal = (name: string, value: SignalValue): void => {
          if (!isActive || isRestoreSuppressed) {
            return
          }
          clearDebouncedSelection(name)
          // Forms stage every change immediately. Otherwise, pointer gestures
          // send their latest values on release, clicks and keys send in the
          // same task, and hover, wheel, and bindings use a trailing debounce.
          if (isValidFormId(formId)) {
            sendSelection(name, value)
          } else if (isPointerDown) {
            heldSelections.set(name, value)
          } else if (isDiscreteInputTask) {
            sendSelection(name, value)
          } else {
            debounceSelection(name, value)
          }
        }
        signalListeners.set(param, handleSignal)
        vegaView.addSignalListener(param, handleSignal)
      })

      endSelectionRestoreRef.current = () => {
        isRestoreSuppressed = false
      }

      teardownRef.current = () => {
        if (!isActive) {
          return
        }
        isActive = false
        isRestoreSuppressed = false

        container?.removeEventListener("pointerdown", handlePointerDown, true)
        container?.removeEventListener("pointerout", handlePointerOut)
        container?.removeEventListener("contextmenu", handleContextMenu, true)
        DISCRETE_INPUT_EVENTS.forEach(type =>
          container?.removeEventListener(type, handleDiscreteInput, true)
        )
        CONTINUOUS_INPUT_EVENTS.forEach(type =>
          container?.removeEventListener(type, handleContinuousInput, true)
        )
        window.removeEventListener("pointerup", handlePointerRelease)
        window.removeEventListener("pointercancel", handlePointerRelease)
        window.removeEventListener("pointerout", handlePointerOut)
        window.removeEventListener("blur", handleWindowBlur)
        signalListeners.forEach((listener, param) => {
          vegaView.removeSignalListener(param, listener)
        })

        clearDiscreteInput()
        const selections = new Map(heldSelections)
        heldSelections.clear()
        debouncedSelections.forEach((debouncedSelection, name) => {
          clearTimeout(debouncedSelection.timerId)
          selections.set(name, debouncedSelection.value)
        })
        debouncedSelections.clear()
        try {
          sendSelections(selections)
        } catch (error) {
          LOG.warn("Failed to flush Vega selections during teardown", error)
        }
      }

      // Restore selected marks and interval extents after remount or fullscreen.
      // Suppress widget updates until endSelectionRestore: setState skips
      // listeners for its own pulse, but follow-up runAsync/resize can still
      // notify.
      const viewState = widgetMgr.getElementState<VegaViewState>(
        chartId,
        "viewState"
      )
      if (notNullOrUndefined(viewState)) {
        isRestoreSuppressed = true
        try {
          return vegaView.setState(
            sanitizeViewStateForRestore(vegaView, viewState, selectionMode)
          )
        } catch (e) {
          // setState applies asynchronously via runAsync; this catch only
          // handles a synchronous throw. Invalid keys are filtered above.
          isRestoreSuppressed = false
          LOG.warn("Failed to restore view state", e)
          widgetMgr.deleteElementState(chartId, "viewState")
        }
      }

      return vegaView
    },
    [chartId, selectionMode, widgetMgr, formId, fragmentId, teardownSelections]
  )

  const onFormCleared = useCallback(() => {
    widgetMgr.deleteElementState(chartId, "viewState")
    const emptySelectionState: VegaLiteState = {
      selection: {},
    }
    // Initialize all parameters defined in the selectionMode with an empty object.
    selectionMode.forEach(param => {
      emptySelectionState.selection[param] = {}
    })
    const widgetInfo = { id: chartId, formId }
    const currentWidgetStateStr = widgetMgr.getStringValue(widgetInfo)
    const currentWidgetState = currentWidgetStateStr
      ? JSON.parse(currentWidgetStateStr)
      : // If there wasn't any selection yet, the selection state
        // is assumed to be empty.
        emptySelectionState

    if (!isEqual(currentWidgetState, emptySelectionState)) {
      widgetMgr.setStringValue(
        widgetInfo.id,
        JSON.stringify(emptySelectionState),
        {
          formId: widgetInfo.formId,
          fragmentId,
          fromUser: true,
        }
      )
    }
  }, [chartId, formId, fragmentId, selectionMode, widgetMgr])

  return {
    maybeConfigureSelections,
    teardownSelections,
    onFormCleared,
    endSelectionRestore,
  }
}
