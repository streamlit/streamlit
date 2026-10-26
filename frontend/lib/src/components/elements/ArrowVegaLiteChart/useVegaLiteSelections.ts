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

import { isValidFormId, notNullOrUndefined } from "~lib/util/utils"
import type { WidgetInfo, WidgetStateManager } from "~lib/WidgetStateManager"

import type { VegaLiteChartElement } from "./arrowUtils"

/** Delay for continuous selection changes such as hover and wheel zoom. */
const DEBOUNCE_TIME_MS = 150

const DISCRETE_INPUT_EVENTS = ["click", "dblclick", "keydown", "keyup"]
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

  const teardownSelections = useCallback(() => {
    teardownRef.current?.()
    teardownRef.current = null
  }, [])

  const maybeConfigureSelections = useCallback(
    (vegaView: VegaView): VegaView => {
      teardownSelections()

      if (selectionMode.length === 0) {
        return vegaView
      }

      let isActive = true
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

      const handleDiscreteInput = (): void => {
        clearDiscreteInput()
        isDiscreteInputTask = true
        // Keep the marker through microtasks queued by this input event, but
        // never let it classify a later task as part of the same action.
        // eslint-disable-next-line no-restricted-globals -- This task marker is local to the imperative Vega event lifecycle.
        discreteInputResetTimerId = setTimeout(clearDiscreteInput, 0)
      }

      const startPointerGesture = (event: PointerEvent): void => {
        // Ignore additional pointers while the initiating pointer is held. A
        // new gesture may start while the previous release is still settling.
        if (isPointerDown && pendingPointerReleaseGestureId === null) {
          return
        }
        clearDiscreteInput()
        pointerGestureId += 1
        activePointerId = event.pointerId
        isPointerDown = true
        pendingPointerReleaseGestureId = null
      }

      const handlePointerDown = (event: PointerEvent): void => {
        const target = event.target
        if (
          event.button !== 0 ||
          event.isPrimary === false ||
          !(target instanceof Element) ||
          target.closest(".vega-bindings, select, input, textarea, button") !==
            null ||
          target.closest("canvas, svg") === null
        ) {
          return
        }
        startPointerGesture(event)
      }

      const handleContinuousInput = (event: Event): void => {
        if (
          event.type === "pointermove" &&
          !isPointerDown &&
          (event as PointerEvent).buttons !== 0
        ) {
          startPointerGesture(event as PointerEvent)
        } else if (!isPointerDown) {
          clearDiscreteInput()
        }
      }

      const clearDebouncedSelection = (name: string): void => {
        const debouncedSelection = debouncedSelections.get(name)
        if (debouncedSelection) {
          clearTimeout(debouncedSelection.timerId)
          debouncedSelections.delete(name)
        }
      }

      const sendSelections = (
        selections: ReadonlyMap<string, SignalValue>
      ): void => {
        if (selections.size === 0) {
          return
        }

        // Preserve the Vega state locally so remounts and fullscreen changes can
        // restore the selection without syncing the full view state to Python.
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
          if ("vlPoint" in value && "or" in value.vlPoint) {
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
          // Vega serializes this run behind dataflow work queued by its release
          // handler, so release-generated signals remain held until they finish.
          await vegaView.runAsync()
        } catch (error) {
          LOG.warn("Failed to finish Vega pointer release processing", error)
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

      const handlePointerRelease = (event: PointerEvent): void => {
        if (
          !isPointerDown ||
          event.pointerId !== activePointerId ||
          pendingPointerReleaseGestureId !== null
        ) {
          return
        }
        const releasedGestureId = pointerGestureId
        pendingPointerReleaseGestureId = releasedGestureId
        void finishPointerRelease(releasedGestureId)
      }

      const handlePointerOut = (event: PointerEvent): void => {
        if (
          event.relatedTarget !== null ||
          event.pointerId !== activePointerId ||
          pendingPointerReleaseGestureId !== null
        ) {
          return
        }
        finishActivePointerGesture()
      }

      const handleWindowBlur = (): void => {
        if (isPointerDown && pendingPointerReleaseGestureId === null) {
          finishActivePointerGesture()
        }
      }

      const handleContextMenu = (): void => {
        if (isPointerDown && pendingPointerReleaseGestureId === null) {
          finishActivePointerGesture()
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
      window.addEventListener("blur", handleWindowBlur)

      // Add listeners for all selection events. Find out more here:
      // https://vega.github.io/vega/docs/api/view/#view_addSignalListener
      selectionMode.forEach(param => {
        const handleSignal = (name: string, value: SignalValue): void => {
          if (!isActive) {
            return
          }
          clearDebouncedSelection(name)
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

      teardownRef.current = () => {
        if (!isActive) {
          return
        }
        isActive = false

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

      // Try to load the previous state of the chart from the element state.
      // This is useful to restore the selection state when the component is re-mounted
      // or when its put into fullscreen mode.
      const viewState = widgetMgr.getElementState<{
        signals?: unknown
        data?: unknown
      }>(chartId, "viewState")
      if (notNullOrUndefined(viewState)) {
        try {
          return vegaView.setState(viewState)
        } catch (e) {
          LOG.warn("Failed to restore view state", e)
        }
      }

      return vegaView
    },
    [chartId, selectionMode, widgetMgr, formId, fragmentId, teardownSelections]
  )

  const onFormCleared = useCallback(() => {
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

  return { maybeConfigureSelections, teardownSelections, onFormCleared }
}
