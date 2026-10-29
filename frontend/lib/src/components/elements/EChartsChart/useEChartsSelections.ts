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

import type { EChartsChart as EChartsChartProto } from "@streamlit/protobuf"

import { FormClearHelper } from "~lib/components/widgets/Form/FormClearHelper"
import type { WidgetInfo, WidgetStateManager } from "~lib/WidgetStateManager"

import {
  type EChartsOptionObject,
  withDefaultSeriesCursor,
} from "./CustomTheme"
import {
  clearStoredSelection,
  createEChartsSelectionBinding,
  type EChartsSelectionBinding,
  type EChartsSelectionInstance,
  EMPTY_SELECTION,
  type WriteSelection,
} from "./selectionBinding"
import { parseOptionSpec } from "./selectionModel"

const EMPTY_SELECTION_JSON = JSON.stringify({ selection: EMPTY_SELECTION })

export interface UseEChartsSelectionsOptions {
  element: EChartsChartProto
  widgetMgr: WidgetStateManager
  /** The live ECharts instance, or ``null`` before it exists. */
  chart: EChartsSelectionInstance | null
  fragmentId?: string
  /**
   * When true, the chart keeps its persisted selection visible but binds no
   * selection handlers and writes no user selection.
   */
  disabled?: boolean
  /** The already-parsed spec, so the hook does not parse it again. */
  parsedOption?: Record<string, unknown> | null
}

export interface UseEChartsSelectionsOutput {
  /**
   * Replace the misleading ``"pointer"`` series cursor on display-only
   * charts, which aren't clickable. Selection widgets get the option
   * unchanged: Streamlit never injects selection config, so selections are
   * whatever the spec enables (``selectedMode`` on a series, a ``brush``
   * component).
   */
  applyDisplayOnlyCursorDefault: (
    option: EChartsOptionObject
  ) => EChartsOptionObject
  /**
   * Re-apply the persisted selection after an option-replacing ``setOption``
   * or ``setTheme``. A no-op for display-only charts.
   */
  restoreSelection: () => void
  /**
   * Drop pixel-only brush overlays after a container resize. A no-op for
   * display-only charts.
   */
  pruneAfterResize: () => void
  /**
   * Dispose the binding while its chart can still hit-test. Call right before
   * ``chart.dispose()``: a renderer change disposes the instance before the
   * binding effect sees the new one, and a finished brush waiting on its
   * throttled snapshot would be lost.
   */
  releaseSelection: () => void
}

/**
 * Hook that wires ECharts native and brush selection events into Streamlit's
 * widget-state mechanism. Modeled on ``useVegaLiteSelections``.
 *
 * The per-instance state machine lives in ``createEChartsSelectionBinding``;
 * this hook creates one binding per chart instance and connects it to the
 * widget value, the form-submit validator, and the form-clear listener.
 *
 * The chart component calls this hook before declaring its own effects, so
 * the binding effect below runs first and ``restoreSelection`` /
 * ``pruneAfterResize`` from the component's effects reach the binding for
 * the current instance.
 */
export function useEChartsSelections({
  element,
  widgetMgr,
  chart,
  fragmentId,
  disabled = false,
  parsedOption: parsedOptionInput,
}: UseEChartsSelectionsOptions): UseEChartsSelectionsOutput {
  const chartId = element.id
  const formId = element.formId

  // Handlers and user writes need an enabled host. Everything else (restore,
  // prune, the cursor default) follows ``element.selectionActivated``, so a
  // disconnected widget keeps its highlight.
  const isSelectionInteractive = element.selectionActivated && !disabled
  const parsedOption = useMemo(
    () =>
      parsedOptionInput !== undefined
        ? parsedOptionInput
        : parseOptionSpec(element.spec),
    [parsedOptionInput, element.spec]
  )
  // Keep the parsed spec in a ref so the binding stays stable across
  // data-only updates (keyed live data, fragment reruns). Rebinding would
  // re-run restore and flush a debounced write early.
  const parsedOptionRef = useRef(parsedOption)
  // A layout effect runs before the chart's passive effects, so the binding
  // never reads a stale spec.
  useLayoutEffect(() => {
    parsedOptionRef.current = parsedOption
  }, [parsedOption])

  const widgetInfo: WidgetInfo = useMemo(
    () => ({ id: chartId, formId }),
    [chartId, formId]
  )

  // True after a write that did not request a rerun (`fromUser: false`).
  // A later user commit of that same JSON still has to call `setStringValue`
  // so the gesture reruns. Identical user writes stay skipped. Lives here,
  // not in the binding, so it survives a rebind.
  const pendingUserRerunRef = useRef(false)

  const writeSelection: WriteSelection = useCallback(
    (selection, fromUser = true): void => {
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

  const applyDisplayOnlyCursorDefault = useCallback(
    (option: EChartsOptionObject): EChartsOptionObject => {
      // Ignores ``disabled``: folding it in would rewrite the option on
      // disconnect and replay the entry animation.
      return element.selectionActivated
        ? option
        : withDefaultSeriesCursor(option)
    },
    [element.selectionActivated]
  )

  // The binding for the current chart instance. ``null`` for display-only
  // charts and before the instance exists.
  const bindingRef = useRef<EChartsSelectionBinding | null>(null)

  useEffect(() => {
    // Keyed display-only charts also have an element ID (CSS class + remount
    // identity). Binding against that ID would re-apply leftover widget state
    // after ``on_select`` is turned off, with no handlers to clear the
    // highlight. A disabled selection widget (host-disabled inputs or a
    // dropped connection) still gets a binding, without handlers, so it
    // restores and prunes its overlay.
    if (
      !chart ||
      chart.isDisposed() ||
      !chartId ||
      !element.selectionActivated
    ) {
      return
    }
    const binding = createEChartsSelectionBinding({
      chart,
      chartId,
      formId,
      widgetMgr,
      writeSelection,
      getParsedOption: () => parsedOptionRef.current,
      isInteractive: isSelectionInteractive,
    })
    bindingRef.current = binding
    // A rebind (re-enable, form or fragment change) gets no new
    // ``setOption``, so restore here too. On a fresh instance the
    // component's option effect restores again after its ``setOption``;
    // before that, ECharts ignores the dispatches.
    binding.restore()
    return () => {
      if (bindingRef.current === binding) {
        bindingRef.current = null
      }
      binding.dispose()
    }
  }, [
    chart,
    chartId,
    formId,
    element.selectionActivated,
    isSelectionInteractive,
    widgetMgr,
    writeSelection,
  ])

  const restoreSelection = useCallback((): void => {
    bindingRef.current?.restore()
  }, [])

  const pruneAfterResize = useCallback((): void => {
    bindingRef.current?.pruneAfterResize()
  }, [])

  const releaseSelection = useCallback((): void => {
    const binding = bindingRef.current
    bindingRef.current = null
    binding?.dispose()
  }, [])

  useEffect(() => {
    if (!formId || !chartId || !isSelectionInteractive) {
      return
    }
    const validator = (): boolean =>
      bindingRef.current?.flushPendingBrushForSubmit() ?? true
    widgetMgr.addFormSubmitValidator(formId, chartId, validator)
    return () => {
      widgetMgr.removeFormSubmitValidator(formId, chartId)
    }
  }, [formId, chartId, isSelectionInteractive, widgetMgr])

  // Reset the selection when the surrounding form is cleared. Match
  // Plotly/Vega/basic widgets: ``fromUser: true`` writes into the form's
  // pending dict. Python keeps the last submitted selection until the next
  // submit.
  useEffect(() => {
    if (!formId || !chartId || !isSelectionInteractive) {
      return
    }
    const handleFormCleared = (): void => {
      if (bindingRef.current) {
        bindingRef.current.clear()
      } else {
        // No chart instance yet, so only the stored selection needs clearing.
        clearStoredSelection(widgetMgr, chartId, writeSelection)
      }
    }
    const formClearHelper = new FormClearHelper()
    formClearHelper.manageFormClearListener(
      widgetMgr,
      formId,
      handleFormCleared
    )
    return () => {
      formClearHelper.disconnect()
    }
  }, [formId, chartId, isSelectionInteractive, widgetMgr, writeSelection])

  return {
    applyDisplayOnlyCursorDefault,
    restoreSelection,
    pruneAfterResize,
    releaseSelection,
  }
}
