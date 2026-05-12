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
  FC,
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { Global } from "@emotion/react"
import { InsertChart, TableChart } from "@emotion-icons/material-outlined"

import {
  IArrowData,
  IArrowNamedDataSet,
  streamlit,
  VegaLiteChart as VegaLiteChartProto,
} from "@streamlit/protobuf"

import {
  shouldHeightStretch,
  shouldWidthStretch,
} from "~lib/components/core/Layout/utils"
import { ElementFullscreenContext } from "~lib/components/shared/ElementFullscreen/ElementFullscreenContext"
import withFullScreenWrapper from "~lib/components/shared/FullScreenWrapper/withFullScreenWrapper"
import { StyledToolbarElementContainer } from "~lib/components/shared/Toolbar/styled-components"
import Toolbar, { ToolbarAction } from "~lib/components/shared/Toolbar/Toolbar"
import { ReadOnlyGrid } from "~lib/components/widgets/DataFrame/ReadOnlyGrid"
import { Quiver } from "~lib/dataframes/Quiver"
import { useCalculatedDimensions } from "~lib/hooks/useCalculatedDimensions"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { VegaLiteChartElement, WrappedNamedDataset } from "./arrowUtils"
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
 * In valid Vega-Lite specs, composition operators
 * (hconcat, vconcat, concat, layer, facet, repeat) are always top-level keys
 * of a view specification. They cannot be buried inside encoding, mark, or
 * other nested properties.
 *
 * Nested compositions don't work well with fit-x autosize type and forced width
 * settings, as they can cause "infinite extent" errors (issues #13410, #14050).
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
          "layer" in child ||
          "facet" in child ||
          "repeat" in child)
    )
  } catch {
    return false
  }
}
export interface Props {
  element: VegaLiteChartProto
  elementHash?: string
  widgetMgr: WidgetStateManager
  fragmentId?: string
  disableFullscreenMode?: boolean
  widthConfig: streamlit.IWidthConfig | null | undefined
  heightConfig: streamlit.IHeightConfig | null | undefined
}

/** Iterates over datasets and converts data to Quiver. */
function wrapDatasets(datasets: IArrowNamedDataSet[]): WrappedNamedDataset[] {
  return datasets.map((dataset: IArrowNamedDataSet) => ({
    hasName: dataset.hasName as boolean,
    name: dataset.name as string,
    data: new Quiver(dataset.data as IArrowData),
  }))
}

const ArrowVegaLiteChart: FC<Props> = ({
  disableFullscreenMode,
  element: elementProto,
  elementHash,
  fragmentId,
  widgetMgr,
  widthConfig,
  heightConfig,
}) => {
  // Construct the VegaLiteChartElement from the proto's data. The elementHash
  // serves as the primary memoization key to avoid unnecessary re-parsing when
  // the payload hasn't changed.
  const inputElement = useMemo<VegaLiteChartElement>(
    () => ({
      data: elementProto.data ? new Quiver(elementProto.data) : null,
      spec: elementProto.spec,
      datasets: wrapDatasets(elementProto.datasets),
      useContainerWidth: elementProto.useContainerWidth,
      vegaLiteTheme: elementProto.theme,
      id: elementProto.id,
      selectionMode: elementProto.selectionMode,
      formId: elementProto.formId,
    }),
    // elementHash is intentionally included as a stability anchor for memoization
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [elementHash, elementProto]
  )
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
    [showData]
  )

  const useStretchWidth =
    shouldWidthStretch(widthConfig) || inputElement.useContainerWidth

  const useStretchHeight = shouldHeightStretch(heightConfig)

  // Facet charts need the container element to have a width and also
  // do not work well with stretch/container width
  // so they cannot use the width from the StyledVegaLiteChartContainer.
  // Memoize to avoid repeated JSON.parse on every render.
  const isFacet = useMemo(
    () => isFacetChart(inputElement.spec),
    [inputElement.spec]
  )

  // Nested compositions (vconcat containing hconcat/layer/etc.) also don't work
  // well with forced stretch width, as it can cause "infinite extent" errors.
  // Memoize to avoid repeated JSON.parse on every render.
  const hasNestedComp = useMemo(
    () => hasNestedComposition(inputElement.spec),
    [inputElement.spec]
  )

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
  const { createView, updateView, resizeView, finalizeView, isViewReady } =
    useVegaEmbed(element, widgetMgr, fragmentId)

  const { data, datasets, spec, baseSpecKey, chartWidth, chartHeight } =
    element

  // Refs to track the last spec and dimensions for detecting changes
  const lastBaseSpecKeyRef = useRef<string>("")
  const lastDimensionsRef = useRef<{ width: number; height: number }>({
    width: 0,
    height: 0,
  })

  // Create the view once the container is ready and re-create
  // ONLY when the spec structure actually changes (not dimensions).
  // When only dimensions change, we use resizeView() instead (~10x faster).
  useLayoutEffect(() => {
    const baseSpecChanged = baseSpecKey !== lastBaseSpecKeyRef.current

    // Skip view creation if only dimensions changed and view already exists
    if (!baseSpecChanged && isViewReady) {
      return
    }

    if (containerRef.current !== null) {
      lastBaseSpecKeyRef.current = baseSpecKey
      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO: Fix this
      createView(containerRef, spec).then(() => {
        lastDimensionsRef.current = { width: chartWidth, height: chartHeight }
      })
    }

    return finalizeView
  }, [
    createView,
    finalizeView,
    spec,
    baseSpecKey,
    chartWidth,
    chartHeight,
    fullScreenWidth,
    fullScreenHeight,
    showData,
    containerRef,
    isViewReady,
  ])

  // Handle dimension-only changes with resizeView (~10x faster than recreating)
  useEffect(() => {
    const { width: lastWidth, height: lastHeight } = lastDimensionsRef.current
    const dimensionsChanged =
      chartWidth !== lastWidth || chartHeight !== lastHeight

    // Skip if no change, invalid dimensions, or initial render
    if (!dimensionsChanged || chartWidth <= 0 || lastWidth === 0) {
      return
    }

    // Only resize if view is ready
    if (isViewReady) {
      void resizeView(chartWidth, chartHeight).then(success => {
        if (success) {
          lastDimensionsRef.current = {
            width: chartWidth,
            height: chartHeight,
          }
        }
      })
    }
  }, [chartWidth, chartHeight, isViewReady, resizeView])

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
