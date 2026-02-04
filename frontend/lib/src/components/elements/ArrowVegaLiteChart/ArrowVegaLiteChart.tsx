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

import { FC, memo, useEffect, useLayoutEffect, useRef, useState } from "react"

import { Global } from "@emotion/react"
import { InsertChart, TableChart } from "@emotion-icons/material-outlined"

import { streamlit } from "@streamlit/protobuf"

import {
  shouldHeightStretch,
  shouldWidthStretch,
} from "~lib/components/core/Layout/utils"
import { ElementFullscreenContext } from "~lib/components/shared/ElementFullscreen/ElementFullscreenContext"
import { withFullScreenWrapper } from "~lib/components/shared/FullScreenWrapper"
import Toolbar, {
  StyledToolbarElementContainer,
  ToolbarAction,
} from "~lib/components/shared/Toolbar"
import { ReadOnlyGrid } from "~lib/components/widgets/DataFrame"
import { useCalculatedDimensions } from "~lib/hooks/useCalculatedDimensions"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { VegaLiteChartElement } from "./arrowUtils"
import {
  StyledVegaLiteChartContainer,
  StyledVegaLiteChartTooltips,
} from "./styled-components"
import { useVegaElementPreprocessor } from "./useVegaElementPreprocessor"
import { useVegaEmbed } from "./useVegaEmbed"

// Exported for testing
export function isFacetChart(spec: string | object): boolean {
  try {
    const parsedSpec = typeof spec === "string" ? JSON.parse(spec) : spec

    return !!(
      parsedSpec.facet ||
      // TODO (lawilby): do some tests for row/column
      // shorthand facet charts to confirm they work with
      // sizing in the same way.
      parsedSpec.encoding?.row ||
      parsedSpec.encoding?.column ||
      parsedSpec.encoding?.facet
    )
  } catch {
    return false
  }
}

/**
 * Check if a vconcat spec contains nested composition operators.
 *
 * In valid Vega-Lite specs, composition operators (hconcat, vconcat, concat, layer)
 * are always top-level keys of a view specification. They cannot be buried inside
 * encoding, mark, or other nested properties.
 *
 * Nested compositions don't work well with fit-x autosize type and forced width
 * settings, as they can cause "infinite extent" errors (issue #13410).
 */
// Exported for testing
export function hasNestedComposition(spec: string | object): boolean {
  try {
    const parsedSpec = typeof spec === "string" ? JSON.parse(spec) : spec

    if (!("vconcat" in parsedSpec) || !Array.isArray(parsedSpec.vconcat)) {
      return false
    }

    // Check if any child in vconcat contains a composition operator
    return parsedSpec.vconcat.some(
      (child: unknown) =>
        child !== null &&
        typeof child === "object" &&
        ("hconcat" in child ||
          "vconcat" in child ||
          "concat" in child ||
          "layer" in child)
    )
  } catch {
    return false
  }
}
export interface Props {
  element: VegaLiteChartElement
  widgetMgr: WidgetStateManager
  fragmentId?: string
  disableFullscreenMode?: boolean
  widthConfig: streamlit.IWidthConfig | null | undefined
  heightConfig: streamlit.IHeightConfig | null | undefined
}

const ArrowVegaLiteChart: FC<Props> = ({
  disableFullscreenMode,
  element: inputElement,
  fragmentId,
  widgetMgr,
  widthConfig,
  heightConfig,
}) => {
  const [showData, setShowData] = useState(false)
  const [enableShowData, setEnableShowData] = useState(false)

  const {
    expanded: isFullScreen,
    height: fullScreenHeight,
    width: fullScreenWidth,
    expand,
    collapse,
  } = useRequiredContext(ElementFullscreenContext)

  // When we are in full screen mode, this will be the
  // width/height of the screen based on the expansion
  // of the parent StyledFullScreenFrame.
  // Otherwise, it will be according to the user's settings
  // determined by styling on the StyledElementContainer.
  const {
    width: chartContainerWidth,
    height: chartContainerHeight,
    elementRef: containerRef,
  } = useCalculatedDimensions(
    // We need to update whenever the showData state changes because
    // the underlying element ref that needs to be observed is updated.
    [showData],
    {
      // Debounce resize events to reduce updates during rapid window dragging
      debounceMs: 50,
    }
  )

  const useStretchWidth =
    shouldWidthStretch(widthConfig) || inputElement.useContainerWidth

  const useStretchHeight = shouldHeightStretch(heightConfig)

  // Facet charts need the container element to have a width and also
  // do not work well with stretch/container width
  // so they cannot use the width from the StyledVegaLiteChartContainer.
  const isFacet = isFacetChart(inputElement.spec)

  // Nested compositions (vconcat containing hconcat/layer/etc.) also don't work
  // well with forced stretch width, as it can cause "infinite extent" errors.
  const hasNestedComp = hasNestedComposition(inputElement.spec)

  // We preprocess the input vega element to do a two things:
  // 1. Update the spec to handle Streamlit specific configurations such as
  //    theming, container width, and full screen mode
  // 2. Stabilize some aspects of the input element to detect changes in the
  //    configuration of the chart since each element will always provide new references
  //    Note: We do not stabilize data/datasets as that is managed by the embed.
  const element = useVegaElementPreprocessor(
    inputElement,
    // Facet charts enter a loop when using the width/height from the StyledVegaLiteChartContainer.
    isFacet ? (fullScreenWidth ?? 0) : chartContainerWidth,
    (isFullScreen ? fullScreenHeight : chartContainerHeight) ?? 0,
    // Don't force stretch width for nested compositions - they need natural sizing
    isFullScreen && !hasNestedComp ? true : useStretchWidth,
    isFullScreen ? true : useStretchHeight
  )

  // This hook provides lifecycle functions for creating and removing the view.
  // It also will update the view if the data changes (and not the spec)
  const { createView, updateView, resizeView, finalizeView } = useVegaEmbed(
    element,
    widgetMgr,
    fragmentId
  )

  const { data, datasets, spec, baseSpec, chartWidth, chartHeight } = element

  // Track if the view has been created to avoid resizing before creation
  const viewCreatedRef = useRef(false)
  // Track the last dimensions used for resizeView to detect dimension-only changes
  const lastDimensionsRef = useRef({
    width: 0,
    height: 0 as number | undefined,
  })
  // Store the spec via ref so changes don't trigger useLayoutEffect
  const specRef = useRef(spec)
  specRef.current = spec
  // Track the last baseSpec JSON to only recreate when it actually changes
  const lastBaseSpecJsonRef = useRef("")
  // Track fullscreen state to force recreation on fullscreen changes
  const lastFullscreenRef = useRef({
    width: fullScreenWidth,
    height: fullScreenHeight,
  })

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      viewCreatedRef.current = false
      finalizeView()
    }
  }, [finalizeView])

  // Create the view once the container is ready and re-create
  // when the BASE spec changes OR when fullscreen state changes.
  useLayoutEffect(() => {
    // For charts using container width, wait for valid dimensions to avoid flash
    // of incorrectly sized content. For fixed-width charts, create immediately.
    const needsDimensions = element.useContainerWidth
    if (needsDimensions && chartWidth <= 0) {
      return
    }

    const baseSpecJson = JSON.stringify(baseSpec)
    const baseSpecActuallyChanged =
      baseSpecJson !== lastBaseSpecJsonRef.current

    // Check if fullscreen state changed (entering or exiting fullscreen)
    const fullscreenChanged =
      fullScreenWidth !== lastFullscreenRef.current.width ||
      fullScreenHeight !== lastFullscreenRef.current.height

    // Skip if nothing significant changed and view already exists
    // We must recreate on fullscreen changes because the container context changes
    if (
      !baseSpecActuallyChanged &&
      !fullscreenChanged &&
      viewCreatedRef.current
    ) {
      return
    }

    lastBaseSpecJsonRef.current = baseSpecJson
    lastFullscreenRef.current = {
      width: fullScreenWidth,
      height: fullScreenHeight,
    }

    if (containerRef.current !== null) {
      viewCreatedRef.current = false
      // Note: createView internally calls finalizeView() before creating the new view
      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO: Fix this
      createView(containerRef, specRef.current).then(() => {
        viewCreatedRef.current = true
        lastDimensionsRef.current = { width: chartWidth, height: chartHeight }
      })
    }
    // No cleanup returned - createView handles finalization internally,
    // and unmount cleanup is handled by the separate useEffect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    createView,
    baseSpec,
    fullScreenWidth,
    fullScreenHeight,
    showData,
    containerRef,
    chartWidth, // Added to trigger creation once dimensions are available
  ])

  // Handle dimension changes efficiently without recreating the view.
  // This is the key performance optimization - using Vega's built-in resize
  // API instead of destroying and recreating the entire chart.
  // Uses throttling to ensure smooth animation during rapid resize events.
  useEffect(() => {
    // Only resize if dimensions actually changed from what we last used
    const { width: lastWidth, height: lastHeight } = lastDimensionsRef.current
    const dimensionsChanged =
      chartWidth !== lastWidth || chartHeight !== lastHeight

    // Skip if no change, invalid dimensions, or this is the initial render
    // (initial render is handled by useLayoutEffect which sets lastDimensionsRef)
    if (!dimensionsChanged || chartWidth <= 0 || lastWidth === 0) {
      return
    }

    let cancelled = false

    const doResize = (): void => {
      if (cancelled) return
      if (viewCreatedRef.current) {
        void resizeView(chartWidth, chartHeight).then(success => {
          if (success && !cancelled) {
            lastDimensionsRef.current = {
              width: chartWidth,
              height: chartHeight,
            }
          }
        })
      }
    }

    // Use requestAnimationFrame for smooth visual updates during resize
    const rafId = requestAnimationFrame(() => {
      doResize()
    })

    return () => {
      cancelled = true
      if (rafId !== undefined) {
        cancelAnimationFrame(rafId)
      }
    }
    // We intentionally exclude resizeView from deps as it has internal state deps
    // that would cause unnecessary re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartWidth, chartHeight])

  // The references to data and datasets will always change each rerun
  // because the forward message always produces new references, so
  // this function will run regularly to update the view.
  useEffect(() => {
    void updateView(data, datasets)

    // We only want to update the view if the data or datasets change.
    // updateView isn't stable because its updated via the isCreatingView flag.
    // With updateView as dependency, the chart seems to
    // expand within the parent container (less left/right padding).

    // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO: Update to match React best practices
  }, [data, datasets])

  useEffect(() => {
    // We only show data if its provided via data or if there
    // is one data set in the datasets array. In this case,
    // only the first dataset is shown:
    if (data || datasets?.[0]?.data) {
      setEnableShowData(true)
    } else {
      setEnableShowData(false)
    }
  }, [data, datasets])

  if (showData) {
    const derivedHeight =
      fullScreenHeight ??
      (chartContainerHeight > 0 ? chartContainerHeight : undefined)

    return (
      <ReadOnlyGrid
        data={data ?? datasets[0]?.data}
        height={derivedHeight}
        width={widthConfig ?? undefined}
        customToolbarActions={[
          <ToolbarAction
            key="show-chart"
            label="Show chart"
            icon={InsertChart}
            onClick={() => {
              setShowData(false)
            }}
          />,
        ]}
      />
    )
  }

  // Create the container inside which Vega draws its content.
  // To style the Vega tooltip, we need to apply global styles since
  // the tooltip element is drawn outside of this component.

  // Determine container height: use fullscreen height when in fullscreen mode,
  // otherwise use "100%" for stretch height or let it auto-size
  const containerHeight =
    isFullScreen || !useStretchHeight ? fullScreenHeight : "100%"

  return (
    <StyledToolbarElementContainer
      height={containerHeight}
      useContainerWidth={isFullScreen || useStretchWidth}
    >
      <Toolbar
        target={StyledToolbarElementContainer}
        isFullScreen={isFullScreen}
        onExpand={expand}
        onCollapse={collapse}
        disableFullscreenMode={disableFullscreenMode}
      >
        {enableShowData && (
          <ToolbarAction
            label="Show data"
            icon={TableChart}
            onClick={() => {
              setShowData(true)
            }}
          />
        )}
      </Toolbar>
      <Global styles={StyledVegaLiteChartTooltips} />
      <StyledVegaLiteChartContainer
        data-testid="stVegaLiteChart"
        className="stVegaLiteChart"
        useContainerWidth={useStretchWidth}
        useContainerHeight={useStretchHeight}
        ref={containerRef}
      />
    </StyledToolbarElementContainer>
  )
}

const ArrowVegaLiteChartWithFullScreen =
  withFullScreenWrapper(ArrowVegaLiteChart)
export default memo(ArrowVegaLiteChartWithFullScreen)
