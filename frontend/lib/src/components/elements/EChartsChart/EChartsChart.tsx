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

import { EChartsChart as EChartsChartProto } from "@streamlit/protobuf"

import { ElementFullscreenContext } from "~lib/components/shared/ElementFullscreen/ElementFullscreenContext"
import withFullScreenWrapper from "~lib/components/shared/FullScreenWrapper/withFullScreenWrapper"
import { StyledToolbarElementContainer } from "~lib/components/shared/Toolbar/styled-components"
import Toolbar, { ToolbarAction } from "~lib/components/shared/Toolbar/Toolbar"
import { FormClearHelper } from "~lib/components/widgets/Form/FormClearHelper"
import { useCalculatedDimensions } from "~lib/hooks/useCalculatedDimensions"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"
import { ensureError } from "~lib/util/ErrorHandling"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  applyStreamlitOptionDefaults,
  buildStreamlitEChartsTheme,
  EChartsOptionObject,
  STREAMLIT_THEME,
} from "./CustomTheme"
import {
  StyledEChartsChartContainer,
  StyledEChartsError,
} from "./styled-components"
import { useEChartsSelections } from "./useEChartsSelections"

const LOG = getLogger("EChartsChart")

interface EChartsChartProps {
  element: EChartsChartProto
  widgetMgr: WidgetStateManager
  /** Reserved for future use; not wired in v1 (mirrors st.plotly_chart). */
  disabled?: boolean
  fragmentId?: string
  disableFullscreenMode?: boolean
}

export function EChartsChart({
  element,
  widgetMgr,
  fragmentId,
  disableFullscreenMode,
}: Readonly<EChartsChartProps>): ReactElement {
  const theme = useEmotionTheme()

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

  // The JSON of the last option applied via setOption, used to skip no-op
  // setOption calls so unrelated reruns don't replay entry animations.
  const appliedOptionRef = useRef<string | null>(null)
  // The instance the resize effect last observed, used to skip the resize that
  // coincides with (re)creating the instance (see the resize effect below).
  const resizedInstanceRef = useRef<echarts.ECharts | null>(null)
  // The live ECharts instance, tracked in state so recreating it (on a
  // renderer/theme change) re-runs the option and selection effects.
  const [chartInstance, setChartInstance] = useState<echarts.ECharts | null>(
    null
  )
  const [renderError, setRenderError] = useState<string | null>(null)
  const [hasRendered, setHasRendered] = useState(false)

  // Parse the spec, memoized on the spec string (display-only charts have no id).
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

  const {
    isSelectionActivated,
    configureSelectionOption,
    bindSelections,
    restoreBrush,
    onFormCleared,
  } = useEChartsSelections(element, widgetMgr, fragmentId)

  // The option actually handed to setOption: Streamlit theming defaults plus
  // selection (brush/toolbox) configuration when selections are active.
  const preparedOption = useMemo(() => {
    if (!option) {
      return null
    }
    const withDefaults = applyStreamlitOptionDefaults(
      option,
      theme,
      element.theme
    )
    return configureSelectionOption(withDefaults)
  }, [option, theme, element.theme, configureSelectionOption])

  const hasValidSpec = option !== null
  const hasValidDimensions = width > 0 && height > 0

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

  // Create (and dispose) the ECharts instance. Because both the renderer and the
  // theme are fixed at init time, a change to either disposes and recreates the
  // instance. We never init into a zero-sized container.
  useEffect(() => {
    const dom = containerRef.current
    if (!dom || !hasValidSpec || !hasBeenSized) {
      return
    }

    const chart = echarts.init(dom, themeArg, { renderer: rendererStr })
    // Force the setOption effect to re-apply against the fresh instance.
    appliedOptionRef.current = null
    setChartInstance(chart)

    return () => {
      chart.dispose()
      setChartInstance(null)
    }
  }, [containerRef, rendererStr, themeArg, hasValidSpec, hasBeenSized])

  // Apply the option whenever it (or the underlying instance) changes. Skips
  // no-op setOption calls and re-dispatches persisted brush areas afterwards.
  useEffect(() => {
    // When the instance is recreated (renderer/theme change), an effect keyed on
    // the previous `chartInstance` can still run once against the just-disposed
    // instance before the state update lands. Skip it so we don't mark the
    // option as applied against a dead instance (which would make the fresh one
    // skip its own render and stay blank).
    if (!chartInstance || !preparedOption || chartInstance.isDisposed()) {
      return
    }

    const optionJson = JSON.stringify(preparedOption)
    if (appliedOptionRef.current === optionJson) {
      return
    }
    // Mark this option as attempted up front so a rendering error isn't cleared
    // by a redundant retry against the same option.
    appliedOptionRef.current = optionJson

    try {
      chartInstance.setOption(preparedOption as echarts.EChartsOption, {
        notMerge: true,
      })
      setRenderError(null)
      setHasRendered(true)
      // A full replacement clears drawn brush areas, so restore them.
      restoreBrush(chartInstance)
    } catch (error) {
      setRenderError(ensureError(error).message)
    }
  }, [chartInstance, preparedOption, restoreBrush])

  // Bind selection handlers to the current instance (no-op for display-only).
  // This effect is intentionally declared *after* the option-apply effect so
  // that, when the instance is (re)created, `restoreBrush` runs before these
  // handlers are bound and its brush dispatch does not re-emit a selection.
  useEffect(() => {
    if (!chartInstance || chartInstance.isDisposed()) {
      return
    }
    return bindSelections(chartInstance)
  }, [chartInstance, bindSelections])

  // Resize the chart when its container dimensions change. Entering/exiting
  // fullscreen changes the measured width/height, so this covers it too.
  useEffect(() => {
    if (
      !chartInstance ||
      chartInstance.isDisposed() ||
      width <= 0 ||
      height <= 0
    ) {
      return
    }
    // Skip the resize triggered on the same pass the instance was (re)created:
    // echarts already sizes to the container at init, and resizing during its
    // first render is a no-op that logs a benign "resize during main process"
    // warning. Subsequent size changes still resize.
    if (resizedInstanceRef.current !== chartInstance) {
      resizedInstanceRef.current = chartInstance
      return
    }
    chartInstance.resize()
  }, [chartInstance, width, height])

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

  const handleDownloadPng = useCallback((): void => {
    if (!chartInstance) {
      return
    }
    try {
      const dataUrl = chartInstance.getDataURL({
        pixelRatio: 2,
        backgroundColor: theme.colors.bgColor,
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
      link.download = `${timestamp}_chart.png`
      link.href = dataUrl
      link.click()
    } catch (error) {
      LOG.error("Failed to export ECharts chart as PNG", ensureError(error))
    }
  }, [chartInstance, theme.colors.bgColor])

  return (
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
        <ToolbarAction
          label="Download as PNG"
          icon={FileDownload}
          onClick={handleDownloadPng}
        />
      </Toolbar>
      {parseError !== null ? (
        <StyledEChartsError role="alert" data-testid="stEChartsChartError">
          ECharts chart error: {parseError}
        </StyledEChartsError>
      ) : (
        <>
          <StyledEChartsChartContainer
            ref={containerRef}
            className="stEChartsChart"
            data-testid="stEChartsChart"
            aria-busy={!hasRendered && renderError === null}
          />
          {renderError !== null && (
            <StyledEChartsError role="alert" data-testid="stEChartsChartError">
              ECharts chart error: {renderError}
            </StyledEChartsError>
          )}
        </>
      )}
    </StyledToolbarElementContainer>
  )
}

const EChartsChartWithFullScreenWrapper = withFullScreenWrapper(EChartsChart)
export default memo(EChartsChartWithFullScreenWrapper)
