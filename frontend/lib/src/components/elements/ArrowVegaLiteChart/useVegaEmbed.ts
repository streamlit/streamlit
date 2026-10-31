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
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import { isPlainObject } from "lodash-es"
import { getLogger } from "loglevel"
import { truthy, type View as VegaView } from "vega"
import embed, { type VisualizationSpec } from "vega-embed"
import { expressionInterpreter } from "vega-interpreter"
import { varName } from "vega-lite"

import { useFormClearHelper } from "~lib/components/widgets/Form/FormClearHelper"
import type { Quiver } from "~lib/dataframes/Quiver"
import type { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  getAliasedDataSets,
  getDataArray,
  getDataArrays,
  getInlineData,
  type VegaLiteChartElement,
  type WrappedNamedDataset,
} from "./arrowUtils"
import { bindVegaRangeProgress } from "./styled-components"
import { useVegaLiteSelections } from "./useVegaLiteSelections"

const DEFAULT_DATA_NAME = "source"
const LOG = getLogger("useVegaEmbed")

/** Composition keys whose child views can declare their own params. */
const CHILD_VIEW_KEYS = ["layer", "concat", "hconcat", "vconcat", "spec"]

/**
 * Names of the selection stores that hold the spec's zoom and pan: the
 * `{param}_store` of each interval param bound to the scales, such as the
 * one Altair's `.interactive()` adds. Params in `selectionMode` are left out,
 * because those stores are selections that Streamlit reports and restores.
 */
function getZoomStores(
  spec: unknown,
  selectionMode: readonly string[]
): string[] {
  const stores = new Set<string>()
  const visit = (view: unknown): void => {
    if (!isPlainObject(view)) {
      return
    }
    const viewSpec = view as Record<string, unknown>
    const params = Array.isArray(viewSpec.params) ? viewSpec.params : []
    for (const param of params) {
      const { name, bind } = isPlainObject(param)
        ? (param as { name?: unknown; bind?: unknown })
        : {}
      if (
        bind === "scales" &&
        typeof name === "string" &&
        !selectionMode.includes(name)
      ) {
        stores.add(`${varName(name)}_store`)
      }
    }
    for (const key of CHILD_VIEW_KEYS) {
      const child = viewSpec[key]
      ;(Array.isArray(child) ? child : [child]).forEach(visit)
    }
  }
  visit(spec)
  return [...stores]
}

interface UseVegaEmbedOutput {
  createView: (
    containerRef: RefObject<HTMLDivElement>,
    spec: VisualizationSpec | string
  ) => Promise<VegaView | null>
  updateView: (
    data: Quiver | null,
    datasets: WrappedNamedDataset[]
  ) => Promise<VegaView | null>
  finalizeView: () => void
  resizeView: (width: number, height: number) => Promise<boolean>
  exportToPng: () => Promise<string | null>
  isViewReady: boolean
}

/**
 * Hook that returns a set of lifecycle functions that can be used to create,
 * update, and remove a vega-lite chart into the DOM.
 *
 * @param inputElement The vega-lite chart element
 * @param widgetMgr The widget manager
 * @param fragmentId The fragment id of the element
 */
export function useVegaEmbed(
  inputElement: VegaLiteChartElement,
  widgetMgr: WidgetStateManager,
  fragmentId?: string
): UseVegaEmbedOutput {
  const vegaViewRef = useRef<VegaView | null>(null)
  const vegaFinalizerRef = useRef<(() => void) | null>(null)
  const defaultDataNameRef = useRef<string>(DEFAULT_DATA_NAME)
  const prevDataRef = useRef<Quiver | null>(null)
  const prevDatasetsRef = useRef<WrappedNamedDataset[]>([])
  // The dataset names compiled into the view, by alias. A data-only rerun of
  // an Altair chart renames its datasets but keeps the view, so updates write
  // to the names the view knows.
  const viewDatasetNamesRef = useRef<Map<string, string>>(new Map())
  // The selection stores that hold the view's zoom and pan (see getZoomStores).
  const zoomStoresRef = useRef<string[]>([])
  // Always-up-to-date props for safe access inside stable callbacks to avoid stale closure issues
  const latestDataRef = useRef<Quiver | null>(null)
  const latestDatasetsRef = useRef<WrappedNamedDataset[]>([])
  // Bumped by finalizeView / each createView so overlapping embeds can detect
  // they were superseded and must not assign or replay into another view.
  const createGenerationRef = useRef(0)
  // This is used to prevent the view from being updated while it is being created
  const [isCreatingView, setIsCreatingView] = useState(false)

  // Setup interactivity for the chart if it supports selections
  const {
    maybeConfigureSelections,
    teardownSelections,
    onFormCleared,
    endSelectionRestore,
  } = useVegaLiteSelections(inputElement, widgetMgr, fragmentId)

  useFormClearHelper({ widgetMgr, element: inputElement, onFormCleared })

  const { data, datasets, selectionMode } = inputElement

  // Keep latest refs in sync during render so createView (which runs in
  // useLayoutEffect, before useEffect) can merge named datasets into the
  // spec before embed.
  latestDataRef.current = data
  latestDatasetsRef.current = datasets

  useEffect(() => {
    // Initialize previous refs before the first view exists so subsequent
    // updates have a baseline to diff against.
    if (vegaViewRef.current === null) {
      prevDataRef.current = data
      prevDatasetsRef.current = datasets
    }
  }, [data, datasets])

  const finalizeView = useCallback(() => {
    // Invalidate in-flight createView work so a superseded embed cannot
    // assign or replay into a finalized or replacement view.
    createGenerationRef.current += 1

    try {
      vegaFinalizerRef.current?.()
    } finally {
      vegaFinalizerRef.current = null
      vegaViewRef.current = null
    }
  }, [])

  /** Applies one dataset to the view and returns whether its rows changed. */
  const updateData = useCallback(
    (
      view: VegaView,
      name: string,
      prevData: Quiver | null,
      dataArg: Quiver | null
    ): boolean => {
      const hadRows = (prevData?.dimensions.numDataRows ?? 0) > 0
      if (!dataArg || dataArg.dimensions.numDataRows === 0) {
        // The new data is empty, so we remove the dataset from the
        // chart view if the named dataset exists.
        try {
          view.remove(name, truthy)
        } catch {
          // The dataset was already removed, so we do nothing
        }
        return hadRows
      }

      if (!prevData || !hadRows) {
        // The previous data was empty, so we just insert the new data.
        view.insert(name, getDataArray(dataArg))
        return true
      }

      if (dataArg.hasSameBytes(prevData)) {
        return false
      }
      // Data has changed, replace the dataset.
      view.data(name, getDataArray(dataArg))
      LOG.info(`Replaced the ${name} dataset in Vega view.`)
      return true
    },
    []
  )

  /**
   * Applies `inputData`/`inputDatasets` to an existing Vega view by diffing them
   * against `prevDataRef`/`prevDatasetsRef`. Callers must advance those refs
   * after the resulting `runAsync()` resolves.
   */
  const syncViewData = useCallback(
    (
      view: VegaView,
      inputData: Quiver | null,
      inputDatasets: WrappedNamedDataset[]
    ): void => {
      const prevData = prevDataRef.current
      const prevDatasets = prevDatasetsRef.current
      let isDataChanged = false

      if (prevData || inputData) {
        isDataChanged = updateData(
          view,
          defaultDataNameRef.current,
          prevData,
          inputData
        )
      }

      // Match datasets by alias rather than name, since Altair renames a
      // dataset whenever its data changes.
      const prevDataSets = getAliasedDataSets(prevDatasets)
      const dataSets = getAliasedDataSets(inputDatasets)
      // The name the view compiled for this alias. A dataset the view hasn't
      // seen keeps its own name, and an empty name uses the default dataset.
      const getViewDatasetName = (alias: string, name: string): string =>
        (viewDatasetNamesRef.current.get(alias) ?? name) ||
        defaultDataNameRef.current

      for (const [alias, { name, data: dataset }] of dataSets) {
        isDataChanged =
          updateData(
            view,
            getViewDatasetName(alias, name),
            prevDataSets.get(alias)?.data ?? null,
            dataset
          ) || isDataChanged
      }

      // Remove the datasets that the new data no longer sends.
      for (const [alias, { name, data: prevDataset }] of prevDataSets) {
        const viewDatasetName = getViewDatasetName(alias, name)
        if (
          !dataSets.has(alias) &&
          viewDatasetName !== defaultDataNameRef.current
        ) {
          isDataChanged =
            updateData(view, viewDatasetName, prevDataset, null) ||
            isDataChanged
        }
      }

      // New data can lie outside a zoomed-in window, which would show an
      // empty chart. Reset zoom and pan like a double-click does.
      if (isDataChanged) {
        for (const store of zoomStoresRef.current) {
          try {
            view.remove(store, truthy)
          } catch {
            // The view has no such store, so there is nothing to reset.
          }
        }
      }
    },
    [updateData]
  )

  const createView = useCallback(
    async (
      containerRef: RefObject<HTMLDivElement>,
      spec: VisualizationSpec | string
    ): Promise<VegaView | null> => {
      if (containerRef.current === null) {
        throw new Error("Element missing.")
      }
      const container = containerRef.current
      // Finalize the previous view so it can be garbage collected. This also
      // bumps the generation so any overlapping createView bails out.
      finalizeView()
      const generation = createGenerationRef.current
      setIsCreatingView(true)
      try {
        const options = {
          // Adds interpreter support for Vega expressions that is compliant with CSP
          ast: true,
          expr: expressionInterpreter,

          // Disable vega-embed's injected default CSS. Container, tooltip, and
          // parameter-binding styles live in styled-components.ts instead.
          tooltip: { disableDefaultStyle: true },
          defaultStyle: false,
          // Disable all built-in vega-embed action links ("View Source", "Open
          // in Vega Editor", "Save as PNG/SVG"). Combined with sanitizing
          // usermeta.embedOptions (see useVegaElementPreprocessor), this prevents
          // a chart spec from using these actions to open same-origin pages with
          // serialized spec contents. We expose our own toolbar actions instead.
          // Note: `actions: false` also changes vega-embed's DOM output: it no
          // longer wraps the chart in a `.chart-wrapper`/`.vega-actions`
          // structure and instead applies `role="graphics-document"` and the
          // `fit-x`/`fit-y` sizing classes directly to this container element
          // (which our styles and e2e locators rely on).
          actions: false,
        }

        // Snapshot the datasets compiled into this view. A rerun can land
        // during embed; we record this snapshot as prev and replay any
        // later change after the view exists.
        const compiledData = latestDataRef.current
        const compiledDatasets = latestDatasetsRef.current

        // Named Arrow datasets must be in the spec before embed so Vega-Lite
        // can compile lookups and filters against them. GeoJSON/TopoJSON named
        // datasets already live on spec.datasets and are preserved.
        const dataArrays = getDataArrays(compiledDatasets) ?? {}
        const datasetNames = Object.keys(dataArrays)

        // Copy object specs so the preprocessor spec (also used for
        // copy-to-clipboard) is not mutated when Arrow rows are merged in.
        // Leave string specs untouched: vega-embed treats a string as a URL.
        let specForEmbed: VisualizationSpec | string
        if (typeof spec === "string") {
          specForEmbed = spec
        } else {
          const objectSpec = { ...spec } as VisualizationSpec & {
            datasets?: Record<string, unknown>
          }
          if (datasetNames.length > 0) {
            objectSpec.datasets = {
              ...objectSpec.datasets,
              ...dataArrays,
            }
          }
          specForEmbed = objectSpec
        }

        const { vgSpec, view, finalize } = await embed(
          container,
          specForEmbed,
          options
        )

        if (generation !== createGenerationRef.current) {
          finalize()
          return null
        }

        const createdView = maybeConfigureSelections(view)
        vegaViewRef.current = createdView
        viewDatasetNamesRef.current = new Map(
          Array.from(
            getAliasedDataSets(compiledDatasets),
            ([alias, { name }]) => [alias, name]
          )
        )
        zoomStoresRef.current = getZoomStores(specForEmbed, selectionMode)

        const unbindRangeProgress = bindVegaRangeProgress(container)
        vegaFinalizerRef.current = () => {
          unbindRangeProgress()
          try {
            teardownSelections()
          } finally {
            finalize()
          }
        }

        const isSuperseded = (): boolean =>
          generation !== createGenerationRef.current ||
          vegaViewRef.current !== createdView

        // Heuristic to determine the default dataset name, from the named
        // datasets collected above.
        if (datasetNames.length === 1) {
          const [datasetName] = datasetNames
          defaultDataNameRef.current = datasetName
        } else if (datasetNames.length === 0 && vgSpec.data) {
          defaultDataNameRef.current = DEFAULT_DATA_NAME
        }

        // Unnamed Arrow table data is inserted after embed. Named datasets on
        // object specs are already in spec.datasets, so inserting them again
        // would duplicate rows. String specs are URLs, so named Arrow rows
        // must be inserted here.
        const dataObj = getInlineData(compiledData)
        if (dataObj) {
          createdView.insert(defaultDataNameRef.current, dataObj)
        }
        if (typeof spec === "string") {
          for (const [name, rows] of Object.entries(dataArrays)) {
            createdView.insert(name || defaultDataNameRef.current, rows)
          }
        }

        await createdView.runAsync()
        if (isSuperseded()) {
          return vegaViewRef.current
        }

        // Fix bug where the "..." menu button overlaps with charts where width is
        // set to -1 on first load.
        await createdView.resize().runAsync()
        // Keep restore suppression through this first resize so scale-trigger
        // rewrites cannot emit a widget update. Skip if this createView was
        // superseded so we do not unsuppress the replacement view.
        if (isSuperseded()) {
          return vegaViewRef.current
        }
        endSelectionRestore()

        prevDataRef.current = compiledData
        prevDatasetsRef.current = compiledDatasets

        // Replay data that arrived during embed or during this replay's
        // runAsync. updateView is a no-op while isCreatingView is true.
        while (
          latestDataRef.current !== prevDataRef.current ||
          latestDatasetsRef.current !== prevDatasetsRef.current
        ) {
          if (isSuperseded()) {
            return vegaViewRef.current
          }
          const pendingData = latestDataRef.current
          const pendingDatasets = latestDatasetsRef.current
          syncViewData(createdView, pendingData, pendingDatasets)
          await createdView.resize().runAsync()
          if (isSuperseded()) {
            return vegaViewRef.current
          }
          prevDataRef.current = pendingData
          prevDatasetsRef.current = pendingDatasets
        }

        return createdView
      } finally {
        // End restore for this generation when createView returns or throws
        // before the resize pulse. A superseded generation must not
        // unsuppress the replacement view.
        if (generation === createGenerationRef.current) {
          endSelectionRestore()
          setIsCreatingView(false)
        }
      }
    },
    [
      endSelectionRestore,
      finalizeView,
      maybeConfigureSelections,
      selectionMode,
      syncViewData,
      teardownSelections,
    ]
  )

  const updateView = useCallback(
    async (
      inputData: Quiver | null,
      inputDatasets: WrappedNamedDataset[]
    ): Promise<VegaView | null> => {
      if (vegaViewRef.current === null || isCreatingView) {
        return null
      }

      syncViewData(vegaViewRef.current, inputData, inputDatasets)
      await vegaViewRef.current.resize().runAsync()

      prevDataRef.current = inputData
      prevDatasetsRef.current = inputDatasets

      return vegaViewRef.current
    },
    [syncViewData, isCreatingView]
  )

  const resizeView = useCallback(
    async (width: number, height: number): Promise<boolean> => {
      if (vegaViewRef.current === null || isCreatingView) {
        return false
      }
      try {
        if (width > 0) {
          vegaViewRef.current.width(width)
        }
        if (height > 0) {
          vegaViewRef.current.height(height)
        }
        await vegaViewRef.current.resize().runAsync()
        return true
      } catch (error) {
        LOG.warn("Failed to resize Vega view:", error)
        return false
      }
    },
    [isCreatingView]
  )

  const exportToPng = useCallback(async (): Promise<string | null> => {
    if (vegaViewRef.current === null || isCreatingView) {
      return null
    }

    try {
      // Vega's default PNG export is at 1x, which produces a blurry image on
      // HiDPI/retina displays where the on-screen canvas is rendered at
      // `window.devicePixelRatio`. We upscale the PNG to at least 2x so the
      // exported file matches (or exceeds) the perceived on-screen fidelity.
      // See https://github.com/streamlit/streamlit/issues/8177.
      const scaleFactor = Math.max(2, window.devicePixelRatio || 1)
      return await vegaViewRef.current.toImageURL("png", scaleFactor)
    } catch (error) {
      LOG.warn("Failed to export Vega view as PNG:", error)
      return null
    }
  }, [isCreatingView])

  // Whether the view exists and is not mid-creation, so it's safe to resize.
  // This is derived from a ref (`vegaViewRef`) rather than state, so it only
  // reflects the latest value on re-render. That's sufficient here because
  // `setIsCreatingView` toggles around view creation and forces the re-render
  // that recomputes this flag once the view becomes ready.
  const isViewReady = vegaViewRef.current !== null && !isCreatingView

  return {
    createView,
    updateView,
    finalizeView,
    resizeView,
    exportToPng,
    isViewReady,
  }
}
