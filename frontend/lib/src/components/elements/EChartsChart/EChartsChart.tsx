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
  type ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  FileDownload,
  FullscreenExit,
  InsertChart,
  TableChart,
} from "@emotion-icons/material-outlined"
import * as echarts from "echarts"
import { isPlainObject } from "lodash-es"
import { getLogger } from "loglevel"

import {
  EChartsChart as EChartsChartProto,
  type streamlit,
} from "@streamlit/protobuf"

import { ElementFullscreenContext } from "~lib/components/shared/ElementFullscreen/ElementFullscreenContext"
import withFullScreenWrapper from "~lib/components/shared/FullScreenWrapper/withFullScreenWrapper"
import { StyledToolbarElementContainer } from "~lib/components/shared/Toolbar/styled-components"
import Toolbar, { ToolbarAction } from "~lib/components/shared/Toolbar/Toolbar"
import { ReadOnlyGrid } from "~lib/components/widgets/DataFrame/ReadOnlyGrid"
import { FormClearHelper } from "~lib/components/widgets/Form/FormClearHelper"
import type { Quiver } from "~lib/dataframes/Quiver"
import { useCalculatedDimensions } from "~lib/hooks/useCalculatedDimensions"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"
import { downloadDataUrl } from "~lib/util/downloadDataUrl"
import { ensureError } from "~lib/util/ErrorHandling"
import { isNullOrUndefined } from "~lib/util/utils"
import type { WidgetStateManager } from "~lib/WidgetStateManager"

import { hydrateArrowDatasetSources } from "./arrowDataset"
import {
  applyAltToOption,
  applyStreamlitOptionDefaults,
  buildStreamlitEChartsTheme,
  type EChartsOptionObject,
  STREAMLIT_THEME,
} from "./CustomTheme"
import { useInsideDataZoomWheelGuard } from "./insideDataZoomWheel"
import {
  StyledEChartsChartContainer,
  StyledEChartsChartFill,
  StyledEChartsChartRoot,
  StyledEChartsChartStack,
  StyledEChartsError,
  StyledEChartsErrorOverlay,
} from "./styled-components"
import { applyTooltipFormatters } from "./tooltipFormatters"
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
  heightConfig?: streamlit.HeightConfig.$Properties | null
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
 * none, so a background configured only on ``baseOption``, ``options[]``, or
 * nested ``media[*].option`` (including ``baseOption.media`` and
 * ``options[*].media``) still counts as explicit. This matches the Python
 * ``_iter_option_variants`` walker.
 */
function hasExplicitBackgroundColor(
  option: EChartsOptionObject | null
): boolean {
  if (isNullOrUndefined(option) || !isPlainObject(option)) {
    return false
  }
  if (optionHasBackgroundColor(option)) {
    return true
  }
  if (
    hasExplicitBackgroundColor(option.baseOption as EChartsOptionObject | null)
  ) {
    return true
  }
  if (
    Array.isArray(option.options) &&
    option.options.some(entry =>
      hasExplicitBackgroundColor(entry as EChartsOptionObject | null)
    )
  ) {
    return true
  }
  if (Array.isArray(option.media)) {
    return option.media.some(entry => {
      if (!isPlainObject(entry)) {
        return false
      }
      return hasExplicitBackgroundColor(
        (entry as Record<string, unknown>).option as EChartsOptionObject | null
      )
    })
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
  const isStretchHeight = heightConfig?.useStretch === true

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
          const { [op]: _removed, ...next } = prev
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

  // Parse the spec and replace its Arrow `dataset.source` placeholders with
  // rows. Memoized on the spec string, which embeds each dataset's content
  // hash. An unreadable dataset is reported as a spec error, so ECharts never
  // receives a placeholder.
  const { option, parseError, dataViewData } = useMemo<{
    option: EChartsOptionObject | null
    parseError: string | null
    dataViewData: Quiver | null
  }>(() => {
    if (!element.spec) {
      return { option: {}, parseError: null, dataViewData: null }
    }
    try {
      const parsed: unknown = JSON.parse(element.spec)
      if (!isPlainObject(parsed)) {
        return {
          option: null,
          parseError: "The ECharts option must be a JSON object.",
          dataViewData: null,
        }
      }
      const parsedOption = parsed as EChartsOptionObject
      const dataViewData = hydrateArrowDatasetSources(
        parsedOption,
        element.datasets
      )
      return { option: parsedOption, parseError: null, dataViewData }
    } catch (error) {
      return {
        option: null,
        parseError: ensureError(error).message,
        dataViewData: null,
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the spec embeds each dataset's content hash, so element.datasets only changes when element.spec does
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
  useLayoutEffect(() => {
    themeArgRef.current = themeArg
  }, [themeArg])
  const appliedThemeRef = useRef(themeArg)

  const {
    isSelectionActivated,
    configureSelectionOption,
    bindSelections,
    restoreSelection,
    onFormCleared,
    prunePixelOnlyBrushAfterResize,
  } = useEChartsSelections(element, widgetMgr, fragmentId, disabled, option)

  // The option handed to setOption:
  // - Streamlit theme defaults.
  // - Tooltip string formatters turned into functions.
  // - On display-only charts, a non-pointer series cursor so they don't look
  //   clickable. Selection widgets keep the author's cursor.
  // Grid insets are rem-derived, so they must rebuild when the spacing tokens
  // or configured base font size change — not on every new theme object (a
  // light/dark switch would re-apply the option and replay entry animations).
  const { spacing, fontSizes } = theme
  const preparedOption = useMemo(() => {
    if (!option) {
      return null
    }
    let prepared = configureSelectionOption(
      applyTooltipFormatters(
        applyStreamlitOptionDefaults(option, element.theme, theme)
      )
    )
    // Proto `alt` wins over generated / author aria.label.description and
    // forces aria.enabled so the chart stays named.
    if (element.alt) {
      prepared = applyAltToOption(prepared, element.alt)
    }
    return prepared
    // Rebuild only when layout tokens change. `theme` is read for rem→px insets
    // (spacing, title size, baseFontSize) and for the inside funnel and pie
    // label colors, which are the same in light and dark mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- color-only theme copies must not re-apply the option
  }, [
    option,
    element.theme,
    configureSelectionOption,
    element.alt,
    spacing.sm,
    spacing.md,
    spacing.lg,
    spacing.twoXL,
    fontSizes.sm,
    fontSizes.baseFontSize,
  ])

  const hasValidSpec = option !== null
  const hasValidDimensions = width > 0 && height > 0
  const sizeRef = useRef({ width, height })
  useLayoutEffect(() => {
    sizeRef.current = { width, height }
  }, [width, height])
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

    let chart: echarts.ECharts
    try {
      chart = echarts.init(dom, themeArgRef.current, {
        renderer: rendererStr,
      })
    } catch (error) {
      // Uncaught throws trip the error boundary and replace the element.
      setOpError("option", ensureError(error).message)
      return
    }
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
  }, [containerRef, rendererStr, hasValidSpec, hasBeenSized, setOpError])

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
      // Keyed charts reuse zr.dom. ECharts 6.1 setLabel can leave a prior
      // aria-label when the new option has no description and no series
      // (it sets role="img" then returns). Clear before setOption when
      // Streamlit is not applying alt so a removed name cannot stick;
      // ECharts rewrites the label when it has series data or a description.
      if (containerRef.current && !element.alt) {
        containerRef.current.removeAttribute("aria-label")
      }
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
    element.alt,
  ])

  // Bind selection handlers to the current instance (no-op for display-only).
  // Order relative to the option-apply and theme effects does not matter:
  // `restoreSelection` suppresses the events its own dispatches fire, and
  // ECharts fires no selection events from `setOption`.
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
    const previousSize = lastPositiveSizeRef.current
    const isNewInstance = resizedInstanceRef.current !== chartInstance
    const skipCoincidentInitResize =
      isNewInstance && !needsResizeAfterZeroInitRef.current
    if (isNewInstance) {
      resizedInstanceRef.current = chartInstance
      needsResizeAfterZeroInitRef.current = false
    }

    try {
      if (!skipCoincidentInitResize) {
        chartInstance.resize()
        setOpError("resize", null)
      }
      lastPositiveSizeRef.current = { width, height }
      // Capture ``previousSize`` before updating the ref so a renderer
      // recreate at a different size still drops stale pixel-only overlays,
      // even when we skip the coincident init ``resize()``.
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

  useInsideDataZoomWheelGuard(containerRef, option)

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
      // SVG renderer: getDataURL returns an SVG payload, so the extension
      // must match. Canvas renderer stays PNG.
      downloadDataUrl(dataUrl, downloadType)
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

  // "Show data" swaps the chart for a read-only table of its first dataframe.
  // The chart is hidden, not unmounted, so ECharts keeps its zoom, legend, and
  // timeline state.
  const [isShowingData, setIsShowingData] = useState(false)
  const [dataViewHeight, setDataViewHeight] = useState<number | undefined>()
  // Close the table when a rerun drops its dataset:
  // - The chart shows instead of an empty slot.
  // - A later rerun that restores the data leaves the table closed.
  if (isShowingData && dataViewData === null) {
    setIsShowingData(false)
  }
  const isDataViewOpen = isShowingData && dataViewData !== null

  // The open table uses the chart's inline height:
  // - A pixel height, including resolved "content", comes from the layout
  //   config, so a rerun that changes it resizes the table.
  // - Stretch height uses the last inline measurement, because the hidden
  //   chart measures 0 and the fullscreen chart measures the screen.
  const pixelHeight = heightConfig?.pixelHeight ?? undefined
  const inlineHeightRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!isFullScreen && height > 0) {
      inlineHeightRef.current = height
    }
  }, [isFullScreen, height])

  const handleShowData = useCallback((): void => {
    setDataViewHeight(inlineHeightRef.current)
    setIsShowingData(true)
  }, [])

  const handleShowChart = useCallback((): void => {
    setIsShowingData(false)
  }, [])

  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- blank alt is absent
  const labelContext = element.alt?.trim() || undefined

  return (
    <>
      {isDataViewOpen && (
        <ReadOnlyGrid
          data={dataViewData}
          height={fullScreenHeight ?? pixelHeight ?? dataViewHeight}
          alt={labelContext}
          customToolbarActions={[
            <ToolbarAction
              key="show-chart"
              label="Show chart"
              icon={InsertChart}
              onClick={handleShowChart}
              labelContext={labelContext}
            />,
            // The grid hides its own fullscreen controls, so without this the
            // table would only leave fullscreen through Escape.
            ...(isFullScreen
              ? [
                  <ToolbarAction
                    key="close-fullscreen"
                    label="Close fullscreen"
                    icon={FullscreenExit}
                    onClick={collapse}
                    labelContext={labelContext}
                  />,
                ]
              : []),
          ]}
        />
      )}
      <StyledEChartsChartRoot
        isStretchHeight={isStretchHeight}
        isHidden={isDataViewOpen}
      >
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
              labelContext={labelContext}
            >
              {dataViewData !== null && (
                <ToolbarAction
                  label="Show data"
                  icon={TableChart}
                  onClick={handleShowData}
                  labelContext={labelContext}
                />
              )}
              {chartInstance !== null && (
                <ToolbarAction
                  label={`Download as ${downloadType.toUpperCase()}`}
                  icon={FileDownload}
                  onClick={handleDownloadChart}
                  labelContext={labelContext}
                />
              )}
            </Toolbar>
            {parseError !== null ? (
              <StyledEChartsError
                role="alert"
                data-testid="stEChartsChartError"
              >
                ECharts chart error: {parseError}
              </StyledEChartsError>
            ) : (
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
                  isDisabled={disabled && element.selectionActivated}
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
            )}
          </StyledToolbarElementContainer>
        </StyledEChartsChartFill>
      </StyledEChartsChartRoot>
    </>
  )
}

const EChartsChartWithFullScreenWrapper = withFullScreenWrapper(EChartsChart)
export default memo(EChartsChartWithFullScreenWrapper)
