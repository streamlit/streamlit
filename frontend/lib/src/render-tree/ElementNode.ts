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

import { produce } from "immer"

import {
  ArrowNamedDataSet,
  Arrow as ArrowProto,
  ArrowVegaLiteChart as ArrowVegaLiteChartProto,
  Element,
  ForwardMsgMetadata,
  IArrow,
  IArrowNamedDataSet,
} from "@streamlit/protobuf"

import {
  VegaLiteChartElement,
  WrappedNamedDataset,
} from "~lib/components/elements/ArrowVegaLiteChart"
import { Quiver } from "~lib/dataframes/Quiver"
import { isNullOrUndefined } from "~lib/util/utils"

import { AppNode } from "./AppNode.interface"

/**
 * A leaf AppNode. Contains a single element to render.
 */
export class ElementNode implements AppNode {
  public readonly element: Element

  public readonly metadata: ForwardMsgMetadata

  public readonly scriptRunId: string

  public readonly fragmentId?: string

  private lazyQuiverElement?: Quiver

  private lazyVegaLiteChartElement?: VegaLiteChartElement

  // The hash of the script that created this element.
  public readonly activeScriptHash: string

  /** Create a new ElementNode. */
  public constructor(
    element: Element,
    metadata: ForwardMsgMetadata,
    scriptRunId: string,
    activeScriptHash: string,
    fragmentId?: string
  ) {
    this.element = element
    this.metadata = metadata
    this.scriptRunId = scriptRunId
    this.activeScriptHash = activeScriptHash
    this.fragmentId = fragmentId
  }

  public get quiverElement(): Quiver {
    if (this.lazyQuiverElement !== undefined) {
      return this.lazyQuiverElement
    }

    if (
      this.element.type !== "arrowTable" &&
      this.element.type !== "arrowDataFrame"
    ) {
      throw new Error(
        `elementType '${this.element.type}' is not a valid Quiver element!`
      )
    }

    const toReturn = new Quiver(this.element[this.element.type] as ArrowProto)
    // TODO (lukasmasuch): Delete element from proto object?
    this.lazyQuiverElement = toReturn
    return toReturn
  }

  public get vegaLiteChartElement(): VegaLiteChartElement {
    if (this.lazyVegaLiteChartElement !== undefined) {
      return this.lazyVegaLiteChartElement
    }

    if (this.element.type !== "arrowVegaLiteChart") {
      throw new Error(
        `elementType '${this.element.type}' is not a valid VegaLiteChartElement!`
      )
    }

    const proto = this.element.arrowVegaLiteChart as ArrowVegaLiteChartProto
    const modifiedData = proto.data ? new Quiver(proto.data) : null
    const modifiedDatasets =
      proto.datasets.length > 0 ? wrapDatasets(proto.datasets) : []

    const toReturn = {
      data: modifiedData,
      spec: proto.spec,
      datasets: modifiedDatasets,
      useContainerWidth: proto.useContainerWidth,
      vegaLiteTheme: proto.theme,
      id: proto.id,
      selectionMode: proto.selectionMode,
      formId: proto.formId,
    }

    this.lazyVegaLiteChartElement = toReturn
    return toReturn
  }

  public getIn(): AppNode | undefined {
    return undefined
  }

  public setIn(): AppNode {
    throw new Error("'setIn' cannot be called on an ElementNode")
  }

  public filterMainScriptElements(
    mainScriptHash: string
  ): AppNode | undefined {
    if (this.activeScriptHash !== mainScriptHash) {
      return undefined
    }

    return this
  }

  public clearStaleNodes(
    currentScriptRunId: string,
    fragmentIdsThisRun?: Array<string>,
    fragmentIdOfBlock?: string
  ): ElementNode | undefined {
    if (fragmentIdsThisRun?.length) {
      // If we're currently running a fragment, nodes unrelated to the fragment
      // shouldn't be cleared. This can happen when,
      //   1. This element doesn't correspond to a fragment at all.
      //   2. This element is a fragment but is in no path that was modified.
      //   3. This element belongs to a path that was modified, but it was modified in the same run.
      if (
        !this.fragmentId ||
        !fragmentIdOfBlock ||
        this.scriptRunId === currentScriptRunId
      ) {
        return this
      }
    }
    return this.scriptRunId === currentScriptRunId ? this : undefined
  }

  public getElements(elements?: Set<Element>): Set<Element> {
    if (isNullOrUndefined(elements)) {
      elements = new Set<Element>()
    }
    elements.add(this.element)
    return elements
  }

  public arrowAddRows(
    namedDataSet: ArrowNamedDataSet,
    scriptRunId: string
  ): ElementNode {
    const elementType = this.element.type
    const newNode = new ElementNode(
      this.element,
      this.metadata,
      scriptRunId,
      this.activeScriptHash,
      this.fragmentId
    )

    switch (elementType) {
      case "arrowTable":
      case "arrowDataFrame": {
        newNode.lazyQuiverElement = ElementNode.quiverAddRowsHelper(
          this.quiverElement,
          namedDataSet
        )
        break
      }
      case "arrowVegaLiteChart": {
        newNode.lazyVegaLiteChartElement =
          ElementNode.vegaLiteChartAddRowsHelper(
            this.vegaLiteChartElement,
            namedDataSet
          )
        break
      }
      default: {
        // This should never happen!
        throw new Error(
          `elementType '${this.element.type}' is not a valid arrowAddRows target!`
        )
      }
    }

    return newNode
  }

  private static quiverAddRowsHelper(
    element: Quiver,
    namedDataSet: ArrowNamedDataSet
  ): Quiver {
    if (namedDataSet.hasName) {
      throw new Error(
        "Add rows cannot be used with a named dataset for this element."
      )
    }

    const newQuiver = new Quiver(namedDataSet.data as IArrow)
    return element.addRows(newQuiver)
  }

  private static vegaLiteChartAddRowsHelper(
    element: VegaLiteChartElement,
    namedDataSet: ArrowNamedDataSet
  ): VegaLiteChartElement {
    const newDataSetName = namedDataSet.hasName ? namedDataSet.name : null
    const newDataSetQuiver = new Quiver(namedDataSet.data as IArrow)

    return produce(element, (draft: VegaLiteChartElement) => {
      const existingDataSet = getNamedDataSet(draft.datasets, newDataSetName)
      if (existingDataSet) {
        existingDataSet.data = existingDataSet.data.addRows(newDataSetQuiver)
      } else {
        draft.data = draft.data
          ? draft.data.addRows(newDataSetQuiver)
          : newDataSetQuiver
      }
    })
  }
}

/**
 * If there is only one NamedDataSet, return it.
 * If there is a NamedDataset that matches the given name, return it.
 * Otherwise, return `undefined`.
 */
function getNamedDataSet(
  namedDataSets: WrappedNamedDataset[],
  name: string | null
): WrappedNamedDataset | undefined {
  if (namedDataSets.length === 1) {
    return namedDataSets[0]
  }

  return namedDataSets.find(
    (dataset: WrappedNamedDataset) => dataset.hasName && dataset.name === name
  )
}

/** Iterates over datasets and converts data to Quiver. */
function wrapDatasets(datasets: IArrowNamedDataSet[]): WrappedNamedDataset[] {
  return datasets.map((dataset: IArrowNamedDataSet) => {
    return {
      hasName: dataset.hasName as boolean,
      name: dataset.name as string,
      data: new Quiver(dataset.data as IArrow),
    }
  })
}
