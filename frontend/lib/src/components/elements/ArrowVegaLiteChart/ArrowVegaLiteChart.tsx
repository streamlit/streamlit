/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import React, {
  FC,
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

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
import { useDebouncedCallback } from "~lib/hooks/useDebouncedCallback"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { VegaLiteChartElement } from "./arrowUtils"
import {
  StyledVegaLiteChartContainer,
  StyledVegaLiteChartTooltips,
} from "./styled-components"
import { useVegaElementPreprocessor } from "./useVegaElementPreprocessor"
import { useVegaEmbed } from "./useVegaEmbed"

function isFacetChart(spec: string | object): boolean {
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
    // Use 0 as fallback instead of -1 because Vega-Lite cannot handle negative dimensions
    0
  )

  const useStretchWidth =
    shouldWidthStretch(widthConfig) || inputElement.useContainerWidth

  const useStretchHeight = shouldHeightStretch(heightConfig)

  // Facet charts need the container element to have a width and also
  // do not work well with stretch/container width
  // so they cannot use the width from the StyledVegaLiteChartContainer.
  const isFacet = isFacetChart(inputElement.spec)

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
    isFullScreen ? true : useStretchWidth,
    isFullScreen ? true : useStretchHeight
  )

  // This hook provides lifecycle functions for creating and removing the view.
  // It also will update the view if the data changes (and not the spec)
  const { createView, updateView, updateDimensions, finalizeView } =
    useVegaEmbed(element, widgetMgr, fragmentId)

  const { data, datasets, spec, specWithoutDimensions, dimensions } = element

  // Debounce dimension updates during continuous resizing to prevent lag
  // when there are many charts on screen.
  const RESIZE_DEBOUNCE_MS = 100
  const {
    debouncedCallback: debouncedUpdateDimensions,
    cancel: cancelResize,
  } = useDebouncedCallback((width: number, height: number) => {
    void updateDimensions(
      width,
      height,
      isFullScreen ? true : useStretchWidth,
      isFullScreen ? true : useStretchHeight
    )
  }, RESIZE_DEBOUNCE_MS)

  // Track if this is the initial mount to skip dimension updates on first render
  const isInitialMount = useRef(true)

  // Create the view once the container is ready and re-create
  // only if the structural spec changes (not just dimensions).
  // We utilize useLayoutEffect to ensure that the view is created
  // after the container is mounted to avoid layout shift.
  useLayoutEffect(() => {
    if (containerRef.current !== null) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO: Fix this
      createView(containerRef, spec)
      // Mark that initial mount has completed after view creation
      isInitialMount.current = false
    }

    return () => {
      finalizeView()
      // Cancel any pending resize updates when view is finalized
      cancelResize()
      // Reset initial mount flag for next view creation
      isInitialMount.current = true
    }
    // Use specWithoutDimensions to only recreate when structure changes.
    // Dimension changes are handled separately via updateDimensions.
  }, [
    createView,
    finalizeView,
    cancelResize,
    specWithoutDimensions,
    fullScreenWidth,
    fullScreenHeight,
    showData,
    containerRef,
    // Include spec for initial render to have correct dimensions
    spec,
  ])

  // Handle dimension changes efficiently by updating the existing view
  // instead of recreating it. This is debounced to prevent performance
  // issues when resizing the window with many charts.
  useEffect(() => {
    // Skip the initial mount - the view is created with the correct dimensions
    if (isInitialMount.current) {
      return
    }

    // For facet charts, we skip dimension updates as they don't work well
    // with container width and can enter loops
    if (isFacet) {
      return
    }

    debouncedUpdateDimensions(dimensions.width, dimensions.height)
  }, [dimensions.width, dimensions.height, isFacet, debouncedUpdateDimensions])

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
    return (
      <ReadOnlyGrid
        data={data ?? datasets[0]?.data}
        height={fullScreenHeight ?? chartContainerHeight ?? undefined}
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
  return (
    <StyledToolbarElementContainer
      height={
        useStretchHeight
          ? isFullScreen
            ? fullScreenHeight
            : "100%"
          : fullScreenHeight
      }
      useContainerWidth={isFullScreen ? true : useStretchWidth}
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
