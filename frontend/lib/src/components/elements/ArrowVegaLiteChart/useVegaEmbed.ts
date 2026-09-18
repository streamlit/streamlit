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

import { RefObject, useCallback, useEffect, useRef, useState } from "react"

import { getLogger } from "loglevel"
import { truthy, View as VegaView } from "vega"
import embed, { VisualizationSpec } from "vega-embed"
import { expressionInterpreter } from "vega-interpreter"

import { useFormClearHelper } from "~lib/components/widgets/Form/FormClearHelper"
import { Quiver } from "~lib/dataframes/Quiver"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  getDataArray,
  getDataArrays,
  getDataSets,
  getInlineData,
  VegaLiteChartElement,
  WrappedNamedDataset,
} from "./arrowUtils"
import { bindVegaRangeProgress } from "./styled-components"
import { useVegaLiteSelections } from "./useVegaLiteSelections"

const DEFAULT_DATA_NAME = "source"
const LOG = getLogger("useVegaEmbed")

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
  // Always-up-to-date props for safe access inside stable callbacks to avoid stale closure issues
  const latestDataRef = useRef<Quiver | null>(null)
  const latestDatasetsRef = useRef<WrappedNamedDataset[]>([])
  // Bumped by finalizeView / each createView so overlapping embeds can detect
  // they were superseded and must not assign or replay into another view.
  const createGenerationRef = useRef(0)
  // This is used to prevent the view from being updated while it is being created
  const [isCreatingView, setIsCreatingView] = useState(false)

  // Setup interactivity for the chart if it supports selections
  const { maybeConfigureSelections, onFormCleared } = useVegaLiteSelections(
    inputElement,
    widgetMgr,
    fragmentId
  )

  useFormClearHelper({ widgetMgr, element: inputElement, onFormCleared })

  const { data, datasets } = inputElement

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

    if (vegaFinalizerRef.current) {
      vegaFinalizerRef.current()
    }

    vegaFinalizerRef.current = null
    vegaViewRef.current = null
  }, [])

  const updateData = useCallback(
    (
      view: VegaView,
      name: string,
      prevData: Quiver | null,
      dataArg: Quiver | null
    ): void => {
      if (!dataArg || dataArg.dimensions.numDataRows === 0) {
        // The new data is empty, so we remove the dataset from the
        // chart view if the named dataset exists.
        try {
          view.remove(name, truthy)
        } catch {
          // The dataset was already removed, so we do nothing
        }
        return
      }

      if (!prevData || prevData.dimensions.numDataRows === 0) {
        // The previous data was empty, so we just insert the new data.
        view.insert(name, getDataArray(dataArg))
        return
      }

      if (dataArg.hash !== prevData.hash) {
        // Data has changed, replace the dataset.
        view.data(name, getDataArray(dataArg))
        LOG.info(`Replaced the ${name} dataset in Vega view.`)
      }
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

      if (prevData || inputData) {
        updateData(view, defaultDataNameRef.current, prevData, inputData)
      }

      const prevDataSets = getDataSets(prevDatasets) ?? {}
      const dataSets = getDataSets(inputDatasets) ?? {}

      for (const [name, dataset] of Object.entries(dataSets)) {
        const datasetName = name || defaultDataNameRef.current
        const prevDataset = prevDataSets[datasetName]

        updateData(view, datasetName, prevDataset, dataset)
      }

      // Remove all datasets that are in the previous but not the current datasets.
      for (const name of Object.keys(prevDataSets)) {
        if (
          !Object.hasOwn(dataSets, name) &&
          name !== defaultDataNameRef.current
        ) {
          updateData(view, name, null, null)
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

        const unbindRangeProgress = bindVegaRangeProgress(container)
        vegaFinalizerRef.current = () => {
          unbindRangeProgress()
          finalize()
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
        if (isSuperseded()) {
          return vegaViewRef.current
        }

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
        if (generation === createGenerationRef.current) {
          setIsCreatingView(false)
        }
      }
    },
    [finalizeView, maybeConfigureSelections, syncViewData]
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
