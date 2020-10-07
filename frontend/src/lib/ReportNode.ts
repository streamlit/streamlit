/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  Block as BlockProto,
  BlockPath,
  Delta,
  Element,
  ForwardMsgMetadata,
  NamedDataSet,
} from "autogen/proto"
import { Map as ImmutableMap } from "immutable"
import _ from "lodash"
import { addRows } from "./dataFrameProto"
import { toImmutableProto } from "./immutableProto"
import { MetricsManager } from "./MetricsManager"
import { makeElementWithInfoText, notUndefined, requireNonNull } from "./utils"

const NO_REPORT_ID = "NO_REPORT_ID"

/** Return an Element's widget ID if it's a widget, and undefined otherwise. */
export function getElementWidgetID(element: Element): string | undefined {
  return _.get(element as any, [requireNonNull(element.type), "id"])
}

/**
 * An immutable node of the element tree.
 */
export interface ReportNode {
  /**
   * Return the ReportNode for the given index path, or undefined if the path
   * is invalid.
   */
  getIn(path: number[]): ReportNode | undefined

  /**
   * Return a copy of this node with a new element set at the given index
   * path. Throws an error if the path is invalid.
   */
  setIn(path: number[], node: ReportNode): ReportNode

  /**
   * Recursively remove children nodes whose reportID is no longer current.
   * If this node should no longer exist, return undefined.
   */
  clearStaleNodes(reportId: string): ReportNode | undefined

  /**
   * Recursively add all Elements contained in the tree to a set.
   */
  getElements(elementSet: Set<Element>): void
}

/**
 * A leaf ReportNode. Contains a single element to render.
 */
export class ElementNode implements ReportNode {
  public readonly element: Element

  public readonly metadata: ForwardMsgMetadata

  /**
   * The ID of the report this node was generated in. When a report finishes
   * running, the app prunes all stale nodes.
   */
  public readonly reportId: string

  /**
   * A lazily-created immutableJS version of our element.
   *
   * This is a temporary! `immutableElement` is currently needed for
   * dataframe-consuming elements because our dataframe API is
   * immutableJS-based. It'll go away when we've converted to an ArrowJS-based
   * dataframe API.
   *
   * Because most elements do *not* use the Dataframe API, and therefore
   * do not need to access `immutableElement`, it is calculated lazily.
   */
  private lazyImmutableElement: ImmutableMap<string, any> | undefined

  /** Create a new ElementNode. */
  public constructor(
    element: Element,
    metadata: ForwardMsgMetadata,
    reportId: string
  ) {
    this.element = element
    this.metadata = metadata
    this.reportId = reportId
  }

  public get immutableElement(): ImmutableMap<string, any> {
    if (this.lazyImmutableElement !== undefined) {
      return this.lazyImmutableElement
    }

    const toReturn = toImmutableProto(Element, this.element)
    this.lazyImmutableElement = toReturn
    return toReturn
  }

  // eslint-disable-next-line class-methods-use-this
  public getIn(path: number[]): ReportNode | undefined {
    return undefined
  }

  // eslint-disable-next-line class-methods-use-this
  public setIn(path: number[], node: ReportNode): ReportNode {
    throw new Error("'setIn' cannot be called on an ElementNode")
  }

  public clearStaleNodes(reportId: string): ElementNode | undefined {
    if (this.reportId === reportId) {
      return this
    }
    return undefined
  }

  public getElements(elements: Set<Element>): void {
    elements.add(this.element)
  }

  public addRows(namedDataSet: NamedDataSet): ElementNode {
    const newNode = new ElementNode(this.element, this.metadata, this.reportId)
    newNode.lazyImmutableElement = addRows(this.immutableElement, namedDataSet)
    return newNode
  }
}

/**
 * A container ReportNode that holds children.
 */
export class BlockNode implements ReportNode {
  public readonly children: ReportNode[]

  public readonly deltaBlock: BlockProto

  public constructor(children: ReportNode[], deltaBlock: BlockProto) {
    this.children = children
    this.deltaBlock = deltaBlock
  }

  /** True if this Block has no children. */
  public get isEmpty(): boolean {
    return this.children.length === 0
  }

  public getIn(path: number[]): ReportNode | undefined {
    if (path.length === 0) {
      return undefined
    }

    const childIndex = path[0]
    if (childIndex < 0 || childIndex >= this.children.length) {
      return undefined
    }

    if (path.length === 1) {
      return this.children[childIndex]
    }

    return this.children[childIndex].getIn(path.slice(1))
  }

  public setIn(path: number[], node: ReportNode): BlockNode {
    if (path.length === 0) {
      throw new Error(`empty path!`)
    }

    const childIndex = path[0]
    if (childIndex < 0 || childIndex > this.children.length) {
      throw new Error(
        `Bad 'setIn' index ${childIndex} (should be between [0, ${this.children.length}])`
      )
    }

    const newChildren = this.children.slice()
    if (path.length === 1) {
      // Base case
      newChildren[childIndex] = node
    } else {
      // Pop the current element off our path, and recurse into our children
      newChildren[childIndex] = newChildren[childIndex].setIn(
        path.slice(1),
        node
      )
    }

    return new BlockNode(newChildren, this.deltaBlock)
  }

  public clearStaleNodes(reportId: string): BlockNode | undefined {
    // Recursively clear our children.
    const newChildren = this.children
      .map(child => child.clearStaleNodes(reportId))
      .filter(notUndefined)

    // Container blocks that have the "allowEmpty" property continue
    // to exist even if they don't have children.
    if (
      newChildren.length > 0 ||
      (this.deltaBlock != null && this.deltaBlock.allowEmpty)
    ) {
      return new BlockNode(newChildren, this.deltaBlock)
    }

    return undefined
  }

  public getElements(elementSet: Set<Element>): void {
    for (const child of this.children) {
      child.getElements(elementSet)
    }
  }
}

/**
 * The top-level node container. It contains pointers to the app's two
 * top-level BlockNodes.
 *
 * TODO: it would be really nice if this was just another BlockNode!
 */
export class ReportRoot {
  public readonly main: BlockNode

  public readonly sidebar: BlockNode

  /**
   * Create an empty ReportRoot with an optional placeholder element.
   */
  public static empty(placeholderText?: string): ReportRoot {
    let mainNodes: ReportNode[]
    if (placeholderText != null) {
      const waitNode = new ElementNode(
        makeElementWithInfoText(placeholderText),
        ForwardMsgMetadata.create({}),
        NO_REPORT_ID
      )
      mainNodes = [waitNode]
    } else {
      mainNodes = []
    }

    return new ReportRoot(
      new BlockNode(mainNodes, BlockProto.create({ allowEmpty: true })),
      new BlockNode([], BlockProto.create({ allowEmpty: true }))
    )
  }

  public constructor(main: BlockNode, sidebar: BlockNode) {
    this.main = main
    this.sidebar = sidebar
  }

  public applyDelta(
    reportId: string,
    delta: Delta,
    metadata: ForwardMsgMetadata
  ): ReportRoot {
    const parentBlock = metadata.parentBlock as BlockPath
    const parentBlockPath = parentBlock.path
    const containerId = parentBlock.container
    const { deltaId } = metadata

    // Update Metrics
    MetricsManager.current.incrementDeltaCounter(getContainerName(containerId))

    // The full path to the ReportNode within the element tree.
    // Used to find and update the element node specified by this Delta.
    const deltaPath: number[] = [...parentBlockPath, deltaId]

    switch (delta.type) {
      case "newElement": {
        const element = delta.newElement as Element
        if (element.type != null) {
          MetricsManager.current.incrementDeltaCounter(element.type)
        }

        // Track component instance name.
        if (element.type === "componentInstance") {
          const componentName = element.componentInstance?.componentName
          if (componentName != null) {
            MetricsManager.current.incrementCustomComponentCounter(
              componentName
            )
          }
        }

        return this.addElement(
          containerId,
          deltaPath,
          reportId,
          element,
          metadata
        )
      }

      case "addBlock": {
        MetricsManager.current.incrementDeltaCounter("new block")
        return this.addBlock(
          containerId,
          deltaPath,
          delta.addBlock as BlockProto
        )
      }

      case "addRows": {
        MetricsManager.current.incrementDeltaCounter("add rows")
        return this.addRows(
          containerId,
          deltaPath,
          delta.addRows as NamedDataSet
        )
      }

      default:
        throw new Error(`Unrecognized deltaType: '${delta.type}'`)
    }
  }

  public clearStaleNodes(reportId: string): ReportRoot {
    const main =
      this.main.clearStaleNodes(reportId) ||
      new BlockNode([], BlockProto.create({ allowEmpty: true }))
    const sidebar =
      this.sidebar.clearStaleNodes(reportId) ||
      new BlockNode([], BlockProto.create({ allowEmpty: true }))

    return new ReportRoot(main, sidebar)
  }

  /** Return a Set containing all Elements in the tree. */
  public getElements(): Set<Element> {
    const elements = new Set<Element>()
    this.main.getElements(elements)
    this.sidebar.getElements(elements)
    return elements
  }

  private addElement(
    containerId: number,
    deltaPath: number[],
    reportId: string,
    element: Element,
    metadata: ForwardMsgMetadata
  ): ReportRoot {
    const existingContainer = this.getContainer(containerId)

    // TODO: do we care about this? Is it a meaningful optimization?
    // (We'll need to implement IElement equality checking for it to work.)

    // Does this element already exist from a previously script run? If so,
    // we simply update its reportID and metadata, which will prevent it from
    // being cleared after the script execution is complete.
    // const existingNode = existingContainer.getIn(deltaPath)
    // if (existingNode != null && existingNode.value == element) {
    //   return existingNode.setMetadata(reportId, metadata)
    // }

    // This is a new element!
    const newNode = new ElementNode(element, metadata, reportId)
    const newContainer = existingContainer.setIn(deltaPath, newNode)
    return this.setContainer(containerId, newContainer)
  }

  private addBlock(
    containerId: number,
    deltaPath: number[],
    block: BlockProto
  ): ReportRoot {
    const existingContainer = this.getContainer(containerId)
    const existingNode = existingContainer.getIn(deltaPath)

    // If we're replacing an existing Block, this new Block inherits
    // the existing Block's children. This prevents existing widgets from
    // having their values reset.
    const children: ReportNode[] =
      existingNode instanceof BlockNode ? existingNode.children : []

    const newNode = new BlockNode(children, block)
    const newContainer = existingContainer.setIn(deltaPath, newNode)
    return this.setContainer(containerId, newContainer)
  }

  private addRows(
    containerId: number,
    deltaPath: number[],
    namedDataSet: NamedDataSet
  ): ReportRoot {
    const existingContainer = this.getContainer(containerId)
    const existingNode = existingContainer.getIn(deltaPath) as ElementNode
    if (existingNode == null) {
      throw new Error(`Can't addRows: invalid deltaPath: ${deltaPath}`)
    }

    const newNode = existingNode.addRows(namedDataSet)
    const newContainer = existingContainer.setIn(deltaPath, newNode)
    return this.setContainer(containerId, newContainer)
  }

  private setContainer(
    id: BlockPath.Container,
    container: BlockNode
  ): ReportRoot {
    switch (id) {
      case BlockPath.Container.MAIN:
        return new ReportRoot(container, this.sidebar)
      case BlockPath.Container.SIDEBAR:
        return new ReportRoot(this.main, container)
      default:
        throw new Error(`Unrecognized BlockPathContainer ID: ${id}`)
    }
  }

  private getContainer(id: BlockPath.Container): BlockNode {
    switch (id) {
      case BlockPath.Container.MAIN:
        return this.main
      case BlockPath.Container.SIDEBAR:
        return this.sidebar
      default:
        throw new Error(`Unrecognized BlockPathContainer ID: ${id}`)
    }
  }
}

function getContainerName(id: BlockPath.Container): string {
  switch (id) {
    case BlockPath.Container.MAIN:
      return "main"
    case BlockPath.Container.SIDEBAR:
      return "sidebar"
    default:
      throw new Error(`Unrecognized BlockPathContainer ID: ${id}`)
  }
}
