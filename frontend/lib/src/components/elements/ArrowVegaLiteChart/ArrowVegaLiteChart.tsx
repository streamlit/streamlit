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
  type FC,
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { Global } from "@emotion/react"
import {
  Check,
  ContentCopy,
  FileDownload,
  InsertChart,
  TableChart,
} from "@emotion-icons/material-outlined"

import type {
  ArrowData,
  ArrowNamedDataSet,
  streamlit,
  VegaLiteChart as VegaLiteChartProto,
} from "@streamlit/protobuf"
import { isLocalhost } from "@streamlit/utils"

import {
  FlexContext,
  hasStretchHeightFallback,
} from "~lib/components/core/Layout/FlexContext"
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
import { useCopyToClipboard } from "~lib/hooks/useCopyToClipboard"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"
import { downloadDataUrl } from "~lib/util/downloadDataUrl"
import type { WidgetStateManager } from "~lib/WidgetStateManager"

import type { VegaLiteChartElement, WrappedNamedDataset } from "./arrowUtils"
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
    const parsedSpec: unknown =
      typeof spec === "string" ? JSON.parse(spec) : spec
    if (
      parsedSpec === null ||
      typeof parsedSpec !== "object" ||
      Array.isArray(parsedSpec)
    ) {
      return false
    }

    const { vconcat } = parsedSpec as { vconcat?: unknown }
    if (!Array.isArray(vconcat)) {
      return false
    }

    // Check if any child in vconcat contains a composition operator
    return vconcat.some(
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
const COMPOSITION_KEYS = ["facet", "repeat", "concat", "hconcat", "vconcat"]

const parseSpecObject = (
  spec: string | object
): Record<string, unknown> | undefined => {
  try {
    const parsedSpec: unknown =
      typeof spec === "string" ? JSON.parse(spec) : spec
    return parsedSpec !== null &&
      typeof parsedSpec === "object" &&
      !Array.isArray(parsedSpec)
      ? (parsedSpec as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

// Exported for testing
/**
 * A single-view chart has one width, known before rendering. Facet, repeat,
 * and concat compositions take their width from their children. Layered
 * charts are still a single view.
 */
export function isSingleViewChart(spec: string | object): boolean {
  const parsedSpec = parseSpecObject(spec)
  return (
    parsedSpec !== undefined &&
    !COMPOSITION_KEYS.some(key => key in parsedSpec) &&
    !isFacetChart(parsedSpec)
  )
}

// Exported for testing
/**
 * Get the numeric top-level width of a spec, if it has one. With Streamlit's
 * "fit" autosizing, a single-view chart renders exactly this wide; without a
 * width, it uses the default chart width.
 */
export function getSpecWidth(spec: string | object): number | undefined {
  const width = parseSpecObject(spec)?.width
  return typeof width === "number" && width > 0 ? width : undefined
}

export interface Props {
  element: VegaLiteChartProto
  elementHash?: string
  widgetMgr: WidgetStateManager
  fragmentId?: string
  disableFullscreenMode?: boolean
  widthConfig: streamlit.WidthConfig.$Properties | null | undefined
  heightConfig: streamlit.HeightConfig.$Properties | null | undefined
}

/** Iterates over datasets and converts data to Quiver. */
function wrapDatasets(
  datasets: ArrowNamedDataSet.$Properties[]
): WrappedNamedDataset[] {
  return datasets.map(dataset => ({
    hasName: dataset.hasName as boolean,
    name: dataset.name as string,
    data: new Quiver(dataset.data as ArrowData.$Properties),
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
      alt: elementProto.alt ?? "",
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

  const baseStretchWidth =
    shouldWidthStretch(widthConfig) || inputElement.useContainerWidth

  const useStretchHeight = shouldHeightStretch(heightConfig)
  const hasFallbackHeight = hasStretchHeightFallback(useContext(FlexContext))

  // Parse the spec once per spec change instead of on every resize render.
  // - Facet charts need the container element to have a width and also do not
  //   work well with stretch/container width, so they cannot use the width
  //   from the StyledVegaLiteChartContainer.
  // - Nested compositions (vconcat containing hconcat/layer/etc.) also don't
  //   work well with forced stretch width, as it can cause "infinite extent"
  //   errors.
  const { isFacet, hasNestedComp, isSingleView, specWidth } = useMemo(() => {
    const parsedSpec = parseSpecObject(inputElement.spec)
    if (parsedSpec === undefined) {
      return {
        isFacet: false,
        hasNestedComp: false,
        isSingleView: false,
        specWidth: undefined,
      }
    }
    return {
      isFacet: isFacetChart(parsedSpec),
      hasNestedComp: hasNestedComposition(parsedSpec),
      isSingleView: isSingleViewChart(parsedSpec),
      specWidth: getSpecWidth(parsedSpec),
    }
  }, [inputElement.spec])

  // Facet charts should only use container width in fullscreen mode.
  // Outside fullscreen, they use their natural size (determined by Vega-Lite).
  // This prevents the infinite loop caused by container-driven facet sizing.
  const useStretchWidth = isFacet && !isFullScreen ? false : baseStretchWidth

  // A content-width chart with a container-driven height would otherwise
  // collapse to 0×0. Single-view charts know their width from the spec, so
  // size them like a stretch-width chart inside a box of that width.
  const isContentWidthContained =
    useStretchHeight && !useStretchWidth && isSingleView
  const isSizeContained =
    useStretchHeight && (useStretchWidth || isContentWidthContained)

  // Height of Vega's parameter-binding controls, which it renders inside the
  // chart container below the chart.
  const [bindingsHeight, setBindingsHeight] = useState(0)

  // The dimensions to apply to the chart. Facet charts in fullscreen use
  // fullScreenWidth; outside fullscreen they use natural sizing (0). Non-facet
  // charts always use the measured container width. Height follows fullscreen
  // vs. container measurement.
  const currentWidth = isFacet
    ? isFullScreen
      ? (fullScreenWidth ?? 0)
      : 0
    : chartContainerWidth
  const availableHeight =
    (isFullScreen ? fullScreenHeight : chartContainerHeight) ?? 0

  // Whether each dimension is container-driven (stretch / fullscreen) rather than
  // a fixed size from the spec. These flags drive both spec generation and which
  // dimensions we update via Vega's native resize API. Nested compositions must
  // not be forced to container width in fullscreen to avoid "infinite extent"
  // layout errors (issues #13410, #14050).
  const forceStretchWidth =
    isFullScreen && !hasNestedComp
      ? true
      : useStretchWidth || isContentWidthContained
  const forceStretchHeight = isFullScreen ? true : useStretchHeight

  // A container-driven height has to fit the binding controls too, so the
  // chart gets the height left above them.
  const currentHeight =
    forceStretchHeight && bindingsHeight > 0 && availableHeight > 0
      ? Math.max(availableHeight - bindingsHeight, 1)
      : availableHeight

  // We preprocess the input vega element to do a two things:
  // 1. Update the spec to handle Streamlit specific configurations such as
  //    theming, container width, and full screen mode
  // 2. Stabilize some aspects of the input element to detect changes in the
  //    configuration of the chart since each element will always provide new references
  //    Note: We do not stabilize data/datasets as that is managed by the embed.
  const element = useVegaElementPreprocessor(
    inputElement,
    currentWidth,
    currentHeight,
    forceStretchWidth,
    forceStretchHeight
  )

  // This hook provides lifecycle functions for creating and removing the view.
  // It also will update the view if the data changes (and not the spec)
  const {
    createView,
    updateView,
    finalizeView,
    resizeView,
    exportToPng,
    isViewReady,
  } = useVegaEmbed(element, widgetMgr, fragmentId)

  const { data, datasets, spec, baseSpecKey } = element
  const { isCopied, copyToClipboard } = useCopyToClipboard()
  const showCopySpecAction = isLocalhost()

  const handleDownloadPng = useCallback(() => {
    void (async () => {
      const pngUrl = await exportToPng()
      if (!pngUrl) {
        return
      }

      downloadDataUrl(pngUrl, "png")
    })()
  }, [exportToPng])

  const handleCopySpec = useCallback(() => {
    // `spec` is typed as string but is the parsed spec object at runtime
    // (see useVegaElementPreprocessor), so we serialize it for the clipboard.
    // Guard against the (typed) string case defensively so we never
    // double-encode the JSON if the contract ever changes.
    copyToClipboard(
      typeof spec === "string" ? spec : JSON.stringify(spec, null, 2)
    )
  }, [copyToClipboard, spec])

  // Track the last dimensions to avoid redundant resize calls
  const lastDimensionsRef = useRef<{ width: number; height: number } | null>(
    null
  )
  // Keep a ref to the latest spec so we can access it in the effect without
  // adding spec to the dependency array (which would cause unnecessary re-renders
  // when only dimensions change).
  const latestSpecRef = useRef(spec)
  latestSpecRef.current = spec

  // Keep refs to dimensions updated so we can access them in the effect below
  const latestDimensionsRef = useRef({
    width: currentWidth,
    height: currentHeight,
  })
  latestDimensionsRef.current = { width: currentWidth, height: currentHeight }

  // Determine if we have valid dimensions for container-driven sizing.
  // For container-driven sizing, we need to wait for valid dimensions before
  // creating the view, because Vega's resize API doesn't properly recalculate
  // the data-to-pixel mapping after the initial view creation.
  // For fixed-dimension charts, dimensions are in the spec, so we don't need
  // to wait for container measurements.
  const needsContainerWidth =
    useStretchWidth || isContentWidthContained || isFullScreen
  const needsContainerHeight = useStretchHeight || isFullScreen
  const hasValidWidth = !needsContainerWidth || currentWidth > 0
  const hasValidHeight = !needsContainerHeight || currentHeight > 0
  const hasValidDimensions = hasValidWidth && hasValidHeight

  // Create the view when the structural spec changes (not on dimension-only changes).
  // useLayoutEffect ensures the view is created after the container is mounted to
  // avoid layout shift.
  // IMPORTANT: The cleanup (finalizeView) should only run when the view needs to be
  // recreated, NOT when dimensions change. Using baseSpecKey (not spec) as the key
  // dependency ensures this - baseSpecKey excludes dimension info and only changes
  // when the structural parts of the spec change.
  useLayoutEffect(() => {
    // For container-driven sizing, wait until we have valid dimensions.
    // Creating the view with invalid dimensions and then resizing doesn't
    // produce the same layout as creating with valid dimensions.
    if (containerRef.current !== null && hasValidDimensions) {
      // Initialize lastDimensionsRef with current dimensions when view is created
      lastDimensionsRef.current = {
        width: latestDimensionsRef.current.width,
        height: latestDimensionsRef.current.height,
      }
      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO: Fix this
      createView(containerRef, latestSpecRef.current)
    }

    // Finalize unconditionally: `finalizeView` is a no-op when no view exists,
    // and calling it here also tears down a view created by an async `createView`
    // that resolved after a valid->invalid dimension transition, preventing an
    // orphaned Vega view from leaking on unmount.
    return () => {
      finalizeView()
    }
  }, [
    createView,
    finalizeView,
    // Use baseSpecKey as the structural change detector, not spec.
    // spec includes dimensions which change frequently during resize;
    // we handle those via resizeView in a separate effect.
    baseSpecKey,
    // showData affects which container ref is active
    showData,
    containerRef,
    // Include hasValidDimensions so we create the view when dimensions become valid
    hasValidDimensions,
  ])

  // Handle dimension-only changes using Vega's native resize API.
  // This is much faster than recreating the entire view (~3.6x speedup).
  // We only resize dimensions that are container-driven (forceStretch*); fixed
  // dimensions come from the spec and must not be overridden by container size
  // changes.
  const shouldResize = forceStretchWidth || forceStretchHeight
  useEffect(() => {
    if (!isViewReady || !shouldResize) {
      return
    }

    const lastDims = lastDimensionsRef.current
    // Only track changes for dimensions we're actually resizing
    const widthChanged = forceStretchWidth && lastDims?.width !== currentWidth
    const heightChanged =
      forceStretchHeight && lastDims?.height !== currentHeight
    if (!widthChanged && !heightChanged) {
      return
    }

    // Guard against stale resize callbacks: if this effect is superseded by a
    // re-render with new dimensions while resizeView is still in-flight, skip
    // the cache update so the latest effect run wins (the cleanup sets `ignore`).
    let ignore = false
    // Use an async IIFE to await resizeView and only update cache on success.
    // Pass 0 for dimensions that shouldn't be resized (e.g., height='content').
    void (async () => {
      const success = await resizeView(
        forceStretchWidth ? currentWidth : 0,
        forceStretchHeight ? currentHeight : 0
      )
      if (success && !ignore) {
        lastDimensionsRef.current = {
          width: currentWidth,
          height: currentHeight,
        }
      }
    })()

    return () => {
      ignore = true
    }
  }, [
    isViewReady,
    shouldResize,
    forceStretchWidth,
    forceStretchHeight,
    resizeView,
    currentWidth,
    currentHeight,
  ])

  // Vega creates the binding controls with the view, so look for them again
  // whenever a view becomes ready. Their height depends only on the chart
  // width, so shrinking the chart to fit them can't feed back into it.
  useEffect(() => {
    if (!isViewReady || !forceStretchHeight) {
      return
    }

    const bindingsForm = containerRef.current?.querySelector(
      "form.vega-bindings"
    )
    if (!bindingsForm?.querySelector(".vega-bind")) {
      setBindingsHeight(0)
      return
    }

    const observer = new ResizeObserver(entries => {
      setBindingsHeight(entries[0]?.borderBoxSize[0]?.blockSize ?? 0)
    })
    observer.observe(bindingsForm)
    return () => {
      observer.disconnect()
    }
  }, [isViewReady, forceStretchHeight, containerRef])

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

  const labelContext = inputElement.alt?.trim() || undefined

  if (showData) {
    const derivedHeight =
      fullScreenHeight ??
      (chartContainerHeight > 0 ? chartContainerHeight : undefined)

    return (
      <ReadOnlyGrid
        data={data ?? datasets[0]?.data}
        height={derivedHeight}
        width={widthConfig ?? undefined}
        alt={labelContext}
        customToolbarActions={[
          <ToolbarAction
            key="show-chart"
            label="Show chart"
            icon={InsertChart}
            onClick={() => {
              setShowData(false)
            }}
            labelContext={labelContext}
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
      useContainerHeight={useStretchHeight}
    >
      <Toolbar
        target={StyledToolbarElementContainer}
        isFullScreen={isFullScreen}
        onExpand={expand}
        onCollapse={collapse}
        disableFullscreenMode={disableFullscreenMode}
        labelContext={labelContext}
      >
        {enableShowData && (
          <ToolbarAction
            label="Show data"
            icon={TableChart}
            onClick={() => {
              setShowData(true)
            }}
            labelContext={labelContext}
          />
        )}
        {isViewReady && (
          <ToolbarAction
            label="Download as PNG"
            icon={FileDownload}
            onClick={handleDownloadPng}
            labelContext={labelContext}
          />
        )}
        {showCopySpecAction && (
          <ToolbarAction
            // Announce the copied state to assistive tech (the icon swap alone
            // is not exposed as an accessible name change). Keep the default
            // label as the spec-specific name so e2e/queries stay stable.
            label={isCopied ? "Copied!" : "Copy Vega-Lite spec"}
            icon={isCopied ? Check : ContentCopy}
            onClick={handleCopySpec}
            // Skip context while on the transient "Copied!" label so the name
            // stays "Copied!" rather than "Copied!: {context}".
            labelContext={isCopied ? undefined : labelContext}
          />
        )}
      </Toolbar>
      <Global styles={StyledVegaLiteChartTooltips} />
      <StyledVegaLiteChartContainer
        data-testid="stVegaLiteChart"
        className="stVegaLiteChart"
        useContainerWidth={useStretchWidth}
        useContainerHeight={useStretchHeight}
        isSizeContained={isSizeContained}
        contentWidth={isContentWidthContained ? specWidth : undefined}
        hasFallbackHeight={hasFallbackHeight}
        ref={containerRef}
      />
    </StyledToolbarElementContainer>
  )
}

const ArrowVegaLiteChartWithFullScreen =
  withFullScreenWrapper(ArrowVegaLiteChart)
export default memo(ArrowVegaLiteChartWithFullScreen)
