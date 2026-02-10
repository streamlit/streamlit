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

import { produce } from "immer"

import {
  ArrowNamedDataSet,
  Dataframe as DataframeProto,
  Element,
  ForwardMsgMetadata,
  IArrowData,
  IArrowNamedDataSet,
  VegaLiteChart as VegaLiteChartProto,
} from "@streamlit/protobuf"

import {
  VegaLiteChartElement,
  WrappedNamedDataset,
} from "~lib/components/elements/ArrowVegaLiteChart"
import { Quiver } from "~lib/dataframes/Quiver"

import { AppNode } from "./AppNode.interface"
import { TransientNode } from "./TransientNode"
import { AppNodeVisitor } from "./visitors/AppNodeVisitor.interface"
import { ClearStaleNodeVisitor } from "./visitors/ClearStaleNodeVisitor"
import { DebugVisitor } from "./visitors/DebugVisitor"

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

    if (this.element.type !== "table" && this.element.type !== "dataframe") {
      throw new Error(
        `elementType '${this.element.type}' is not a valid Quiver element!`
      )
    }

    const arrowData =
      this.element.type === "table"
        ? (this.element.table?.arrowData as IArrowData)
        : ((this.element.dataframe as DataframeProto)?.arrowData as IArrowData)
    const toReturn = new Quiver(arrowData)
    // TODO (lukasmasuch): Delete element from proto object?
    this.lazyQuiverElement = toReturn
    return toReturn
  }

  public get vegaLiteChartElement(): VegaLiteChartElement {
    if (this.lazyVegaLiteChartElement !== undefined) {
      return this.lazyVegaLiteChartElement
    }

    if (this.element.type !== "vegaLiteChart") {
      throw new Error(
        `elementType '${this.element.type}' is not a valid VegaLiteChartElement!`
      )
    }

    const proto = this.element.vegaLiteChart as VegaLiteChartProto
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
      case "table":
      case "dataframe": {
        newNode.lazyQuiverElement = ElementNode.quiverAddRowsHelper(
          this.quiverElement,
          namedDataSet
        )
        break
      }
      case "vegaLiteChart": {
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

    const newQuiver = new Quiver(namedDataSet.data as IArrowData)
    return element.addRows(newQuiver)
  }

  private static vegaLiteChartAddRowsHelper(
    element: VegaLiteChartElement,
    namedDataSet: ArrowNamedDataSet
  ): VegaLiteChartElement {
    const newDataSetName = namedDataSet.hasName ? namedDataSet.name : null
    const newDataSetQuiver = new Quiver(namedDataSet.data as IArrowData)

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

  /**
   * Accept a visitor.
   * @param visitor - The visitor to accept.
   * @returns The result of the visitor's visitElementNode method.
   * @example
   * const visitor = new DebugVisitor()
   * const result = elementNode.accept(visitor)
   * console.log(result)
   */
  public accept<T>(visitor: AppNodeVisitor<T>): T {
    return visitor.visitElementNode(this)
  }

  /**
   * Returns a string representation of this ElementNode for debugging purposes.
   * This method can be used to log or inspect the state of the node.
   *
   * @returns {string} A debug string describing this node.
   */
  public debug(): string {
    return this.accept(new DebugVisitor())
  }

  public replaceTransientNodeWithSelf(node: TransientNode): AppNode {
    if (node.scriptRunId !== this.scriptRunId) {
      // This TransientNode was not defined in this script run, so we return the element node
      // to replace everything
      return this
    }

    // It's essentially an empty transient node, so we return the element node
    if (node.transientNodes.length === 0) {
      return this
    }

    // At this point, we should clear the transient nodes that are stale
    const newTransientNodes = node.updateTransientNodes(
      element =>
        // All transient nodes should be ElementNodes
        element.accept(new ClearStaleNodeVisitor(this.scriptRunId)) as
          | ElementNode
          | undefined
    )

    // The resulting transient node is empty, so we return this node
    if (newTransientNodes.length === 0) {
      return this
    }

    // In this case, we require the transient node to be included, but we are providing
    // a new anchor node
    return new TransientNode(
      this.scriptRunId,
      this,
      newTransientNodes,
      node.deltaMsgReceivedAt
    )
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
      data: new Quiver(dataset.data as IArrowData),
    }
  })
}
