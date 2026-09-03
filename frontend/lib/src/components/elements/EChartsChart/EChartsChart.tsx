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
  memo,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { FileDownload } from "@emotion-icons/material-outlined"
import * as echarts from "echarts"
import { isPlainObject } from "lodash-es"
import { getLogger } from "loglevel"

import {
  EChartsChart as EChartsChartProto,
  streamlit,
} from "@streamlit/protobuf"

import { ElementFullscreenContext } from "~lib/components/shared/ElementFullscreen/ElementFullscreenContext"
import withFullScreenWrapper from "~lib/components/shared/FullScreenWrapper/withFullScreenWrapper"
import { StyledToolbarElementContainer } from "~lib/components/shared/Toolbar/styled-components"
import Toolbar, { ToolbarAction } from "~lib/components/shared/Toolbar/Toolbar"
import { FormClearHelper } from "~lib/components/widgets/Form/FormClearHelper"
import { useCalculatedDimensions } from "~lib/hooks/useCalculatedDimensions"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"
import { ensureError } from "~lib/util/ErrorHandling"
import { isNullOrUndefined } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  applyStreamlitOptionDefaults,
  buildStreamlitEChartsTheme,
  EChartsOptionObject,
  STREAMLIT_THEME,
} from "./CustomTheme"
import {
  StyledEChartsChartContainer,
  StyledEChartsChartFill,
  StyledEChartsChartRoot,
  StyledEChartsChartStack,
  StyledEChartsError,
  StyledEChartsErrorOverlay,
} from "./styled-components"
import { useEChartsSelections } from "./useEChartsSelections"

const LOG = getLogger("EChartsChart")

type ChartErrorSource = "theme" | "option" | "resize"

interface EChartsChartProps {
  element: EChartsChartProto
  widgetMgr: WidgetStateManager
  /**
   * When true, the chart does not bind selection handlers or write widget
   * state. Mirrors st.plotly_chart (e.g. a disconnected app).
   */
  disabled?: boolean
  fragmentId?: string
  disableFullscreenMode?: boolean
  heightConfig?: streamlit.IHeightConfig | null
}

function optionHasBackgroundColor(target: unknown): boolean {
  return (
    isPlainObject(target) &&
    (target as EChartsOptionObject).backgroundColor !== undefined
  )
}

/**
 * Whether the option (or a timeline/media variant) sets ``backgroundColor``.
 *
 * PNG export supplies the Streamlit page background when the chart itself has
 * none, so a background configured only on ``baseOption`` or
 * ``media[*].option`` still counts as explicit.
 */
function hasExplicitBackgroundColor(
  option: EChartsOptionObject | null
): boolean {
  if (isNullOrUndefined(option)) {
    return false
  }
  if (optionHasBackgroundColor(option)) {
    return true
  }
  if (optionHasBackgroundColor(option.baseOption)) {
    return true
  }
  if (
    Array.isArray(option.options) &&
    option.options.some(optionHasBackgroundColor)
  ) {
    return true
  }
  if (Array.isArray(option.media)) {
    return option.media.some(
      entry =>
        isPlainObject(entry) &&
        optionHasBackgroundColor((entry as Record<string, unknown>).option)
    )
  }
  return false
}

function isAriaEnabled(option: EChartsOptionObject): boolean {
  const target = isPlainObject(option.baseOption)
    ? (option.baseOption as EChartsOptionObject)
    : option
  const aria = target.aria
  if (isPlainObject(aria)) {
    return (aria as { enabled?: unknown }).enabled !== false
  }
  return true
}

/**
 * Reconcile ECharts-owned `role` / `aria-label` after `setOption`.
 *
 * ECharts 6.1 can leave `role="img"` and `aria-label` behind when a later
 * option disables ARIA, and an empty series can get `role="img"` with no
 * accessible name. Keyed charts reuse this DOM node, so those stale
 * attributes persist across option updates.
 */
function reconcileEChartsAria(
  dom: HTMLElement,
  option: EChartsOptionObject
): void {
  if (!isAriaEnabled(option)) {
    if (dom.getAttribute("role") === "img") {
      dom.removeAttribute("role")
    }
    if (dom.hasAttribute("aria-label")) {
      dom.removeAttribute("aria-label")
    }
    return
  }
  if (dom.getAttribute("role") === "img" && !dom.getAttribute("aria-label")) {
    dom.removeAttribute("role")
  }
}

export function EChartsChart({
  element,
  widgetMgr,
  fragmentId,
  disableFullscreenMode,
  disabled = false,
  heightConfig,
}: Readonly<EChartsChartProps>): ReactElement {
  const theme = useEmotionTheme()
  const isStretchHeight = !!heightConfig?.useStretch

  const {
    expanded: isFullScreen,
    height: fullScreenHeight,
    expand,
    collapse,
  } = useRequiredContext(ElementFullscreenContext)

  const {
    width,
    height,
    elementRef: containerRef,
  } = useCalculatedDimensions<HTMLDivElement>([], 0)

  // The last option object applied via setOption. `preparedOption` is already
  // memoized, so identity comparison skips no-op reruns without re-serializing.
  const appliedOptionRef = useRef<EChartsOptionObject | null>(null)
  // The instance the resize effect last observed, used to skip the resize that
  // coincides with (re)creating the instance (see the resize effect below).
  const resizedInstanceRef = useRef<echarts.ECharts | null>(null)
  // The live ECharts instance, tracked in state so recreating it (on a
  // renderer change) re-runs the option and selection effects.
  const [chartInstance, setChartInstance] = useState<echarts.ECharts | null>(
    null
  )
  const [opErrors, setOpErrors] = useState<
    Partial<Record<ChartErrorSource, string>>
  >({})
  const [hasRendered, setHasRendered] = useState(false)

  const setOpError = useCallback(
    (op: ChartErrorSource, message: string | null): void => {
      setOpErrors(prev => {
        if (message === null) {
          if (prev[op] === undefined) {
            return prev
          }
          const next = { ...prev }
          delete next[op]
          return next
        }
        if (prev[op] === message) {
          return prev
        }
        return { ...prev, [op]: message }
      })
    },
    []
  )
  // An option error is the most actionable; a resize failure is usually a
  // downstream symptom of the same bad option.
  const renderError =
    opErrors.option ?? opErrors.theme ?? opErrors.resize ?? null

  // Parse the spec, memoized on the spec string.
  const { option, parseError } = useMemo<{
    option: EChartsOptionObject | null
    parseError: string | null
  }>(() => {
    if (!element.spec) {
      return { option: {}, parseError: null }
    }
    try {
      const parsed: unknown = JSON.parse(element.spec)
      if (!isPlainObject(parsed)) {
        return {
          option: null,
          parseError: "The ECharts option must be a JSON object.",
        }
      }
      return { option: parsed as EChartsOptionObject, parseError: null }
    } catch (error) {
      return { option: null, parseError: ensureError(error).message }
    }
  }, [element.spec])

  const rendererStr =
    element.renderer === EChartsChartProto.Renderer.SVG ? "svg" : "canvas"

  const themeArg = useMemo(
    () =>
      element.theme === STREAMLIT_THEME
        ? buildStreamlitEChartsTheme(theme)
        : undefined,
    [element.theme, theme]
  )
  // The create effect reads the theme through a ref so that re-theming doesn't
  // recreate the instance; `appliedThemeRef` tracks what the live instance has.
  const themeArgRef = useRef(themeArg)
  themeArgRef.current = themeArg
  const appliedThemeRef = useRef(themeArg)

  const {
    isSelectionActivated,
    configureSelectionOption,
    bindSelections,
    restoreSelection,
    onFormCleared,
    prunePixelOnlyBrushAfterResize,
  } = useEChartsSelections(element, widgetMgr, fragmentId, disabled)

  // The option actually handed to setOption: Streamlit theming defaults plus
  // selection (brush/toolbox) configuration when selections are active.
  const preparedOption = useMemo(() => {
    if (!option) {
      return null
    }
    return configureSelectionOption(
      applyStreamlitOptionDefaults(option, element.theme)
    )
  }, [option, element.theme, configureSelectionOption])

  const hasValidSpec = option !== null
  const hasValidDimensions = width > 0 && height > 0
  const sizeRef = useRef({ width, height })
  sizeRef.current = { width, height }
  // When ``echarts.init`` runs against a 0x0 container (hasBeenSized is latched
  // but the current measurement is 0), the first positive-size pass must
  // ``resize()`` instead of being treated as the coincident init skip.
  const needsResizeAfterZeroInitRef = useRef(false)
  const lastPositiveSizeRef = useRef<{ width: number; height: number } | null>(
    null
  )

  // Latch: once the container has been measured with non-zero dimensions, keep
  // the chart mounted. Dimensions can transiently report 0 during layout
  // reflows (e.g. a runtime theme switch via the settings menu); gating the
  // create effect on the raw `hasValidDimensions` would tear the instance down
  // and leave the chart permanently blank, so we gate on this one-way latch and
  // let the resize effect handle the actual (possibly changing) pixel sizes.
  const [hasBeenSized, setHasBeenSized] = useState(false)
  useEffect(() => {
    if (hasValidDimensions) {
      setHasBeenSized(true)
    }
  }, [hasValidDimensions])

  // Create (and dispose) the ECharts instance. Only the renderer is fixed at
  // init time, so only a renderer change recreates the instance; a theme change
  // is applied in place by the effect below. The theme is read through a ref so
  // that a light/dark toggle doesn't tear the instance down. The latch prevents
  // the initial zero-size creation. If dimensions become zero during a later
  // renderer recreation, the resize effect recovers on the next positive
  // measurement.
  useEffect(() => {
    const dom = containerRef.current
    if (!dom || !hasValidSpec || !hasBeenSized) {
      return
    }

    const { width: initWidth, height: initHeight } = sizeRef.current
    needsResizeAfterZeroInitRef.current = initWidth <= 0 || initHeight <= 0

    const chart = echarts.init(dom, themeArgRef.current, {
      renderer: rendererStr,
    })
    appliedThemeRef.current = themeArgRef.current
    // Force the setOption effect to re-apply against the fresh instance.
    appliedOptionRef.current = null
    setHasRendered(false)
    setOpErrors({})
    setChartInstance(chart)

    return () => {
      chart.dispose()
      setChartInstance(null)
      setHasRendered(false)
    }
  }, [containerRef, rendererStr, hasValidSpec, hasBeenSized])

  // Re-theme in place when the app switches between light and dark. ECharts
  // 6's `setTheme` keeps the current option model, so this avoids the
  // dispose/re-init flash and the entry-animation replay a recreate would
  // cause. `"default"` is ECharts' way of reverting to its built-in theme.
  useEffect(() => {
    if (!chartInstance || chartInstance.isDisposed()) {
      return
    }
    if (appliedThemeRef.current === themeArg) {
      return
    }

    try {
      chartInstance.setTheme(themeArg ?? "default")
      appliedThemeRef.current = themeArg
      setOpError("theme", null)
      // Re-theming re-runs the render pipeline, which drops the native
      // select/brush visuals, so put them back.
      restoreSelection(chartInstance)
    } catch (error) {
      setOpError("theme", ensureError(error).message)
    }
  }, [chartInstance, themeArg, restoreSelection, setOpError])

  // Apply the option whenever it (or the underlying instance) changes. Skips
  // no-op setOption calls so unrelated reruns don't replay entry animations,
  // then re-applies the persisted selection afterwards.
  useEffect(() => {
    // When the instance is recreated (renderer change), an effect keyed on
    // the previous `chartInstance` can still run once against the just-disposed
    // instance before the state update lands. Skip it so we don't mark the
    // option as applied against a dead instance (which would make the fresh one
    // skip its own render and stay blank).
    if (!chartInstance || !preparedOption || chartInstance.isDisposed()) {
      return
    }

    if (appliedOptionRef.current === preparedOption) {
      return
    }
    // Mark this option as attempted up front so a rendering error isn't cleared
    // by a redundant retry against the same option.
    appliedOptionRef.current = preparedOption

    try {
      chartInstance.setOption(preparedOption as echarts.EChartsOption, {
        notMerge: true,
      })
      if (containerRef.current) {
        reconcileEChartsAria(containerRef.current, preparedOption)
      }
      setOpError("option", null)
      setHasRendered(true)
      // A full replacement clears the selected/brushed state, so restore it.
      restoreSelection(chartInstance)
    } catch (error) {
      setOpError("option", ensureError(error).message)
    }
  }, [
    chartInstance,
    preparedOption,
    containerRef,
    restoreSelection,
    setOpError,
  ])

  // Bind selection handlers to the current instance (no-op for display-only).
  // This effect is intentionally declared *after* the option-apply effect so
  // that, when the instance is (re)created, `restoreSelection` runs before
  // these handlers are bound and its dispatch does not re-emit a selection.
  useEffect(() => {
    if (!chartInstance || chartInstance.isDisposed()) {
      return
    }
    return bindSelections(chartInstance)
  }, [chartInstance, bindSelections])

  // Resize the chart when its container dimensions change. Entering/exiting
  // fullscreen changes the measured width/height, so this covers it too.
  useEffect(() => {
    if (!chartInstance || chartInstance.isDisposed()) {
      return
    }
    if (width <= 0 || height <= 0) {
      // Don't record this instance as already resized. ``hasBeenSized`` can
      // stay latched while dimensions transiently report 0 (theme-menu
      // reflow), and init against a 0x0 container must still ``resize()`` on
      // the first positive-size pass.
      return
    }
    // Skip the resize triggered on the same pass the instance was (re)created
    // at a positive size: echarts already sizes to the container at init, and
    // resizing during its first render is a no-op that logs a benign "resize
    // during main process" warning. If this instance was created at 0x0, the
    // first positive observation must resize.
    if (resizedInstanceRef.current !== chartInstance) {
      resizedInstanceRef.current = chartInstance
      lastPositiveSizeRef.current = { width, height }
      if (!needsResizeAfterZeroInitRef.current) {
        return
      }
      needsResizeAfterZeroInitRef.current = false
    }
    try {
      chartInstance.resize()
      setOpError("resize", null)
      const previousSize = lastPositiveSizeRef.current
      lastPositiveSizeRef.current = { width, height }
      if (
        previousSize &&
        (previousSize.width !== width || previousSize.height !== height)
      ) {
        prunePixelOnlyBrushAfterResize(chartInstance)
      }
    } catch (error) {
      // `resize` re-runs the full render pipeline, so an option that already
      // failed in `setOption` throws again here. Surface it as an in-chart
      // error; letting it escape the effect would trip the error boundary and
      // replace the element with an unrecoverable stack trace.
      setOpError("resize", ensureError(error).message)
    }
  }, [
    chartInstance,
    width,
    height,
    setOpError,
    prunePixelOnlyBrushAfterResize,
  ])

  // Reset the selection when the surrounding form is cleared.
  useEffect(() => {
    if (!element.formId || !isSelectionActivated) {
      return
    }

    const formClearHelper = new FormClearHelper()
    formClearHelper.manageFormClearListener(
      widgetMgr,
      element.formId,
      onFormCleared
    )

    return () => {
      formClearHelper.disconnect()
    }
  }, [element.formId, widgetMgr, isSelectionActivated, onFormCleared])

  const downloadType = rendererStr === "svg" ? "svg" : "png"

  const handleDownloadChart = useCallback((): void => {
    if (!chartInstance) {
      return
    }
    try {
      const dataUrl = chartInstance.getDataURL({
        type: downloadType,
        ...(downloadType === "png"
          ? {
              pixelRatio: 2,
              ...(hasExplicitBackgroundColor(option) ||
              element.theme !== STREAMLIT_THEME
                ? {}
                : { backgroundColor: theme.colors.bgColor }),
            }
          : {}),
      })
      // Build a `YYYY-MM-DDTHH-MM` timestamp from local time so the filename
      // reflects the user's wall-clock time rather than UTC. Matches the
      // download naming used by st.vega_lite_chart / st.altair_chart.
      const now = new Date()
      const pad = (value: number): string => String(value).padStart(2, "0")
      const timestamp =
        `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
        `T${pad(now.getHours())}-${pad(now.getMinutes())}`
      const link = document.createElement("a")
      // SVG renderer: getDataURL returns an SVG payload, so the extension
      // must match. Canvas renderer stays PNG.
      link.download = `${timestamp}_chart.${downloadType}`
      link.href = dataUrl
      link.style.display = "none"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      LOG.error(
        `Failed to export ECharts chart as ${downloadType.toUpperCase()}`,
        ensureError(error)
      )
    }
  }, [
    chartInstance,
    theme.colors.bgColor,
    downloadType,
    option,
    element.theme,
  ])

  return (
    <StyledEChartsChartRoot isStretchHeight={isStretchHeight}>
      <StyledEChartsChartFill isStretchHeight={isStretchHeight}>
        <StyledToolbarElementContainer
          height={isFullScreen ? fullScreenHeight : "100%"}
          useContainerWidth={true}
          useContainerHeight={true}
        >
          <Toolbar
            target={StyledToolbarElementContainer}
            isFullScreen={isFullScreen}
            onExpand={expand}
            onCollapse={collapse}
            disableFullscreenMode={disableFullscreenMode}
          >
            {chartInstance !== null && (
              <ToolbarAction
                label={`Download as ${downloadType.toUpperCase()}`}
                icon={FileDownload}
                onClick={handleDownloadChart}
              />
            )}
          </Toolbar>
          {parseError !== null ? (
            <StyledEChartsError role="alert" data-testid="stEChartsChartError">
              ECharts chart error: {parseError}
            </StyledEChartsError>
          ) : (
            <>
              <StyledEChartsChartStack>
                {/*
              No `role` here on purpose. ECharts sets `role="img"` plus a
              generated `aria-label` on this same element (`zr.dom`) whenever
              `aria.enabled` is on, which is the default. Declaring the role
              here too would leave it behind as an image with no accessible
              name for users who opt out with `aria: {enabled: false}`.
            */}
                <StyledEChartsChartContainer
                  ref={containerRef}
                  className="stEChartsChart"
                  data-testid="stEChartsChart"
                  aria-busy={!hasRendered && renderError === null}
                />
                {renderError !== null && (
                  <StyledEChartsErrorOverlay
                    role="alert"
                    data-testid="stEChartsChartError"
                  >
                    ECharts chart error: {renderError}
                  </StyledEChartsErrorOverlay>
                )}
              </StyledEChartsChartStack>
            </>
          )}
        </StyledToolbarElementContainer>
      </StyledEChartsChartFill>
    </StyledEChartsChartRoot>
  )
}

const EChartsChartWithFullScreenWrapper = withFullScreenWrapper(EChartsChart)
export default memo(EChartsChartWithFullScreenWrapper)
