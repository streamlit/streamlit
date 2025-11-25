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

import {
  ArrowNamedDataSet,
  Arrow as ArrowProto,
  ArrowVegaLiteChart as ArrowVegaLiteChartProto,
  Element,
  ForwardMsgMetadata,
  IArrow,
} from "@streamlit/protobuf"

import { AppNode } from "./AppNode.interface"
import { AppNodeVisitor } from "./visitors/AppNodeVisitor.interface"
import { DebugVisitor } from "./visitors/DebugVisitor"

/**
 * A leaf AppNode. Contains a single element to render.
 */
export class ElementNode implements AppNode {
  public readonly element: Element

  public readonly metadata: ForwardMsgMetadata

  public readonly scriptRunId: string

  public readonly fragmentId?: string

  // Store raw arrow data instead of Quiver to avoid loading apache-arrow in entry bundle
  private cachedArrowData?: ArrowProto

  // Store array of added rows to accumulate multiple add_rows calls
  private cachedAddedRowsList?: IArrow[]

  // For VegaLite charts, store the proto and addRows data separately
  private lazyVegaLiteChartElement?: ArrowVegaLiteChartProto

  // Store array of added rows for VegaLite to accumulate multiple add_rows calls
  private vegaLiteAddedRowsList?: ArrowNamedDataSet[]

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

  /**
   * Get the raw Arrow data for this element.
   * Returns ArrowProto that can be used to instantiate Quiver in the component.
   * This avoids importing apache-arrow in the entry bundle.
   */
  public get arrowData(): { data: ArrowProto; addedRowsList?: IArrow[] } {
    if (this.cachedArrowData !== undefined) {
      return {
        data: this.cachedArrowData,
        addedRowsList: this.cachedAddedRowsList,
      }
    }

    if (
      this.element.type !== "arrowTable" &&
      this.element.type !== "arrowDataFrame"
    ) {
      throw new Error(
        `elementType '${this.element.type}' is not a valid Arrow element!`
      )
    }

    const arrowProto = this.element[this.element.type] as ArrowProto
    this.cachedArrowData = arrowProto
    return { data: arrowProto, addedRowsList: this.cachedAddedRowsList }
  }

  /**
   * Get the VegaLiteChartElement. Returns raw proto and any pending addRows data
   * separately, avoiding loading apache-arrow in the entry bundle.
   */
  public get vegaLiteChartElement(): {
    proto: ArrowVegaLiteChartProto
    addedRowsList?: ArrowNamedDataSet[]
  } {
    if (this.lazyVegaLiteChartElement !== undefined) {
      return {
        proto: this.lazyVegaLiteChartElement,
        addedRowsList: this.vegaLiteAddedRowsList,
      }
    }

    if (this.element.type !== "arrowVegaLiteChart") {
      throw new Error(
        `elementType '${this.element.type}' is not a valid VegaLiteChartElement!`
      )
    }

    const proto = this.element.arrowVegaLiteChart as ArrowVegaLiteChartProto

    // Cache proto - ArrowVegaLiteChart component will instantiate Quiver
    this.lazyVegaLiteChartElement = proto
    return {
      proto,
      addedRowsList: this.vegaLiteAddedRowsList,
    }
  }

  /**
   * Store added rows data without instantiating Quiver.
   * The component will handle merging when it instantiates Quiver.
   */
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

    // Copy cached data from current node
    newNode.cachedArrowData = this.cachedArrowData
    newNode.cachedAddedRowsList = this.cachedAddedRowsList
      ? [...this.cachedAddedRowsList]
      : undefined

    switch (elementType) {
      case "arrowTable":
      case "arrowDataFrame": {
        if (namedDataSet.hasName) {
          throw new Error(
            "Add rows cannot be used with a named dataset for this element."
          )
        }
        // Append the new data to the list of added rows
        if (!newNode.cachedAddedRowsList) {
          newNode.cachedAddedRowsList = []
        }
        newNode.cachedAddedRowsList.push(namedDataSet.data as IArrow)
        break
      }
      case "arrowVegaLiteChart": {
        // For VegaLite, store the proto and addRows data separately
        // Use cached proto if available, otherwise read from element
        newNode.lazyVegaLiteChartElement =
          this.lazyVegaLiteChartElement ??
          (this.element.arrowVegaLiteChart as ArrowVegaLiteChartProto)
        // Copy the list of added rows and append the new one
        newNode.vegaLiteAddedRowsList = this.vegaLiteAddedRowsList
          ? [...this.vegaLiteAddedRowsList]
          : []
        newNode.vegaLiteAddedRowsList.push(namedDataSet)
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
}
