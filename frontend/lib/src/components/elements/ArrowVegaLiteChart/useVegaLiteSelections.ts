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
import { varName } from "vega-lite"

import { isNullOrEmptyString } from "@streamlit/utils"

import { isValidFormId, notNullOrUndefined } from "~lib/util/utils"
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

/** Vega view state persisted in element state to restore selections on remount. */
interface VegaViewState {
  signals?: Record<string, unknown>
  data?: unknown
}

/**
 * One projection of a Vega-Lite selection, as listed by its
 * `{param}_tuple_fields` signal and by each `{param}_store` tuple. `type` is
 * `"R"` for a ranged interval on a continuous scale and `"E"` for enumerated
 * values (points and band, point, or ordinal intervals).
 */
interface SelectionProjection {
  field: string
  channel?: string
  type: string
}

/** Returns whether the view defines this signal; Vega throws for unknown signals. */
const hasSignal = (view: VegaView, name: string): boolean => {
  try {
    view.signal(name)
    return true
  } catch {
    return false
  }
}

const isRangedXYProjection = ({
  type,
  channel,
}: SelectionProjection): boolean =>
  type === "R" && (channel === "x" || channel === "y")

/**
 * Compares projections by field, channel, and type only. Vega caches a
 * `getter` function on each stored field once marks test the selection.
 */
const sameProjections = (
  stored: unknown,
  projections: readonly SelectionProjection[]
): boolean =>
  Array.isArray(stored) &&
  stored.length === projections.length &&
  projections.every(({ field, channel, type }, index) => {
    const candidate = stored[index] as Partial<SelectionProjection> | null
    return (
      candidate?.field === field &&
      candidate.channel === channel &&
      candidate.type === type
    )
  })

/**
 * Names of the data-space and pixel extent signals Vega-Lite compiles for each
 * projection of an interval param. Mirrors Vega-Lite's projection compiler:
 * names are `varName("{param}_{field}")` then `varName("{param}_{channel}")`,
 * with `_1`, `_2`, ... appended on collision (for example, a field named `x`).
 */
const intervalExtentSignalNames = (
  param: string,
  projections: readonly SelectionProjection[]
): Array<{ data: string; pixel: string }> => {
  const usedNames = new Set<string>()
  const nextName = (suffix: string): string => {
    let name = varName(`${param}_${suffix}`)
    for (let counter = 1; usedNames.has(name); counter++) {
      name = varName(`${param}_${suffix}_${counter}`)
    }
    usedNames.add(name)
    return name
  }
  return projections.map(({ field, channel }) => ({
    data: nextName(field),
    pixel: nextName(channel ?? ""),
  }))
}

/**
 * Rebuilds the brush extent signals of one interval param from its restored
 * `{param}_store`, using the new view's scales so the pixel extent fits the
 * view's current size.
 *
 * Returns `undefined`, restoring only the store, unless the store holds one
 * tuple whose projections match the view's `{param}_tuple_fields`, every
 * projection is a ranged x/y interval, and the view defines every extent
 * signal and scale. Enumerated intervals stay store-only because Vega-Lite
 * resets their pixel extent when the scale changes, which clears the store.
 */
const intervalExtentsFromStore = (
  view: VegaView,
  param: string,
  store: unknown
): Record<string, unknown> | undefined => {
  const tupleFieldsSignal = `${param}_tuple_fields`
  if (
    !Array.isArray(store) ||
    store.length !== 1 ||
    !hasSignal(view, tupleFieldsSignal)
  ) {
    return undefined
  }
  const [tuple] = store as Array<{ fields?: unknown; values?: unknown }>
  const projections = view.signal(tupleFieldsSignal) as SelectionProjection[]
  if (
    !Array.isArray(projections) ||
    projections.length === 0 ||
    !projections.every(isRangedXYProjection) ||
    !sameProjections(tuple.fields, projections) ||
    !Array.isArray(tuple.values)
  ) {
    return undefined
  }

  const values: unknown[] = tuple.values
  const signals: Record<string, unknown> = {}
  const names = intervalExtentSignalNames(param, projections)
  for (const [index, { data, pixel }] of names.entries()) {
    const extent = values[index]
    if (
      !Array.isArray(extent) ||
      extent.length !== 2 ||
      !hasSignal(view, data) ||
      !hasSignal(view, pixel)
    ) {
      return undefined
    }
    let scale: (value: unknown) => number
    try {
      scale = view.scale(projections[index].channel as string)
    } catch {
      // Layered charts with independent scales use other scale names.
      return undefined
    }
    signals[data] = extent
    signals[pixel] = extent.map(value => scale(value))
  }
  return signals
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
 * Builds the state to apply to a new view: the snapshot's `{param}_store`
 * datasets plus brush extents rebuilt from each interval store. Snapshot
 * signals are ignored, so a resized view or changed spec cannot apply stale
 * pixels.
 */
const buildRestoreState = (
  view: VegaView,
  viewState: VegaViewState,
  selectionMode: readonly string[]
): VegaViewState => {
  const data = pickSelectionStores(viewState.data, selectionMode)
  if (data === null || typeof data !== "object") {
    return { data }
  }
  const stores = data as Record<string, unknown>
  const signals: Record<string, unknown> = Object.assign(
    {},
    ...selectionMode.map(param =>
      intervalExtentsFromStore(view, param, stores[`${param}_store`])
    )
  )
  return Object.keys(signals).length > 0 ? { data, signals } : { data }
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

        // Preserve the selection stores locally so remounts and fullscreen
        // changes can restore the selection, including the interval brush,
        // without syncing the view state to Python.
        const viewState = vegaView.getState({
          data: (nameArg?: string, _operator?: unknown) => {
            // Vega-Lite stores each selection in `<param name>_store`.
            // https://vega.github.io/vega/docs/api/view/#view_getState
            return selectionMode.some(mode => `${mode}_store` === nameArg)
          },
          // Restoring subcontext data can cause Vega to throw.
          recurse: false,
        })

        if (notNullOrUndefined(viewState)) {
          widgetMgr.setElementState(chartId, "viewState", viewState)
        }

        const widgetInfo: WidgetInfo = { id: chartId, formId }
        const widgetStateStr = widgetMgr.getStringValue(widgetInfo)
        // Missing or empty widget state parses as an empty object.
        const currentWidgetState = JSON.parse(
          isNullOrEmptyString(widgetStateStr) ? "{}" : widgetStateStr
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

      // Restore selected marks and the interval brush after a remount or
      // fullscreen change. Restoring a store notifies its selection listener,
      // so widget updates stay suppressed until useVegaEmbed calls
      // endSelectionRestore after the view's first resize.
      const viewState = widgetMgr.getElementState<VegaViewState>(
        chartId,
        "viewState"
      )
      if (notNullOrUndefined(viewState)) {
        isRestoreSuppressed = true
        try {
          return vegaView.setState(
            buildRestoreState(vegaView, viewState, selectionMode)
          )
        } catch (e) {
          isRestoreSuppressed = false
          LOG.warn("Failed to restore view state", e)
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
    const currentWidgetState = !isNullOrEmptyString(currentWidgetStateStr)
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
