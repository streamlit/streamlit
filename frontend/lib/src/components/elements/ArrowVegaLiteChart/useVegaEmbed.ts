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

import { RefObject, useCallback, useEffect, useRef } from "react"

import { getLogger } from "loglevel"
import { truthy, View as VegaView } from "vega"
import embed from "vega-embed"
import { expressionInterpreter } from "vega-interpreter"

import { useFormClearHelper } from "~lib/components/widgets/Form"
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
import { useVegaLiteSelections } from "./useVegaLiteSelections"

const DEFAULT_DATA_NAME = "source"
const LOG = getLogger("useVegaEmbed")

interface UseVegaEmbedOutput {
  createView: (
    containerRef: RefObject<HTMLDivElement>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    spec: any
  ) => Promise<VegaView | null>
  updateView: (
    data: Quiver | null,
    datasets: WrappedNamedDataset[]
  ) => Promise<VegaView | null>
  finalizeView: () => void
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
  const vegaView = useRef<VegaView | null>(null)
  const vegaFinalizer = useRef<(() => void) | null>(null)
  const defaultDataName = useRef<string>(DEFAULT_DATA_NAME)
  const dataRef = useRef<Quiver | null>(null)
  const datasetsRef = useRef<WrappedNamedDataset[]>([])

  // Setup interactivity for the chart if it supports selections
  const { maybeConfigureSelections, onFormCleared } = useVegaLiteSelections(
    inputElement,
    widgetMgr,
    fragmentId
  )

  useFormClearHelper({ widgetMgr, element: inputElement, onFormCleared })

  const { data, datasets } = inputElement

  // Initialize the data and datasets refs with the current data and datasets
  // This is predominantly used to handle the case where we want to reference
  // these in createView before the first render.
  useEffect(() => {
    if (vegaView.current === null) {
      dataRef.current = data
      datasetsRef.current = datasets
    }
  }, [data, datasets])

  const finalizeView = useCallback(() => {
    if (vegaFinalizer.current) {
      vegaFinalizer.current()
    }

    vegaFinalizer.current = null
    vegaView.current = null
  }, [])

  const createView = useCallback(
    async (
      containerRef: RefObject<HTMLDivElement>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
      spec: any
    ): Promise<VegaView | null> => {
      if (containerRef.current === null) {
        throw new Error("Element missing.")
      }

      // Finalize the previous view so it can be garbage collected.
      finalizeView()

      const options = {
        // Adds interpreter support for Vega expressions that is compliant with CSP
        ast: true,
        expr: expressionInterpreter,

        // Disable default styles so that vega doesn't inject <style> tags in the
        // DOM. We set these styles manually for finer control over them and to
        // avoid inlining styles.
        tooltip: { disableDefaultStyle: true },
        defaultStyle: false,
        forceActionsMenu: true,
      }

      const { vgSpec, view, finalize } = await embed(
        containerRef.current,
        spec,
        options
      )

      vegaView.current = maybeConfigureSelections(view)

      vegaFinalizer.current = finalize

      // Load the initial set of data into the chart.
      const dataArrays = getDataArrays(datasetsRef.current)

      // Heuristic to determine the default dataset name.
      const datasetNames = dataArrays ? Object.keys(dataArrays) : []
      if (datasetNames.length === 1) {
        const [datasetName] = datasetNames
        defaultDataName.current = datasetName
      } else if (datasetNames.length === 0 && vgSpec.data) {
        defaultDataName.current = DEFAULT_DATA_NAME
      }

      const dataObj = getInlineData(dataRef.current)
      if (dataObj) {
        vegaView.current.insert(defaultDataName.current, dataObj)
      }
      if (dataArrays) {
        for (const [name, dataArg] of Object.entries(dataArrays)) {
          vegaView.current.insert(name, dataArg)
        }
      }

      await vegaView.current.runAsync()

      // Fix bug where the "..." menu button overlaps with charts where width is
      // set to -1 on first load.
      await vegaView.current.resize().runAsync()

      return vegaView.current
    },
    [finalizeView, maybeConfigureSelections]
  )

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
        } finally {
          // The finally block ensures execution flow continues even if view.remove() fails
          // This allows us to safely exit the function while still propagating any errors
        }
        return
      }

      if (!prevData || prevData.dimensions.numDataRows === 0) {
        // The previous data was empty, so we just insert the new data.
        view.insert(name, getDataArray(dataArg))
        return
      }

      // Check if dataframes have same "shape" but the new one has more rows.
      if (dataArg.hash !== prevData.hash) {
        // Clean the dataset and insert from scratch.
        view.data(name, getDataArray(dataArg))
        LOG.info(
          `Had to clear the ${name} dataset before inserting data through Vega view.`
        )
      }
    },
    []
  )

  const updateView = useCallback(
    async (
      inputData: Quiver | null,
      inputDatasets: WrappedNamedDataset[]
    ): Promise<VegaView | null> => {
      if (vegaView.current === null) {
        return null
      }

      // At this point the previous data should be updated
      const prevData = dataRef.current
      const prevDatasets = datasetsRef.current

      if (prevData || inputData) {
        updateData(
          vegaView.current,
          defaultDataName.current,
          prevData,
          inputData
        )
      }

      const prevDataSets = getDataSets(prevDatasets) ?? {}
      const dataSets = getDataSets(inputDatasets) ?? {}

      for (const [name, dataset] of Object.entries(dataSets)) {
        const datasetName = name || defaultDataName.current
        const prevDataset = prevDataSets[datasetName]

        updateData(vegaView.current, datasetName, prevDataset, dataset)
      }

      // Remove all datasets that are in the previous but not the current datasets.
      for (const name of Object.keys(prevDataSets)) {
        if (
          !Object.hasOwn(dataSets, name) &&
          name !== defaultDataName.current
        ) {
          updateData(vegaView.current, name, null, null)
        }
      }

      await vegaView.current?.resize().runAsync()

      dataRef.current = inputData
      datasetsRef.current = inputDatasets

      return vegaView.current
    },
    [updateData]
  )

  return { createView, updateView, finalizeView }
}
