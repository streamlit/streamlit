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
import { addRows } from "./dataFrameProto"
import { toImmutableProto } from "./immutableProto"
import { MetricsManager } from "./MetricsManager"
import { makeElementWithInfoText, notUndefined } from "./utils"

const NO_REPORT_ID = "NO_REPORT_ID"

/**
 * An immutable node of the "Report Data Tree".
 *
 * Trees are composed of `ElementNode` leaves, which contain data about
 * a single visual element, and `BlockNode` branches, which determine the
 * layout of a group of children nodes.
 *
 * A simple tree might look like this:
 *
 *   ReportRoot
 *   ├── BlockNode ("main")
 *   │   ├── ElementNode (text: "Ahoy, Streamlit!")
 *   │   └── ElementNode (button: "Don't Push This")
 *   └── BlockNode ("sidebar")
 *       └── ElementNode (checkbox: "Batten The Hatches")
 *
 * To build this tree, the frontend receives `Delta` messages from Python,
 * each of which corresponds to a tree mutation ("add an element",
 * "add a block", "add rows to an existing element"). The frontend builds the
 * tree bit by bit in response to these `Delta`s.
 *
 * To render the app, the `ReportView` class walks this tree and outputs
 * a corresponding DOM structure, using React, that's essentially a mapping
 * of `ReportElement` -> `ReactNode`. This rendering happens "live" - that is,
 * the app is re-rendered each time a new `Delta` is received.
 *
 * Because the app gets re-rendered frequently, updates need to be fast.
 * Our React components - the building blocks of the app - are "pure"
 * (see https://reactjs.org/docs/react-api.html#reactpurecomponent), which
 * means that React uses shallow comparison to determine which ReactNodes to
 * update.
 *
 * Thus, each node in our tree is _immutable_ - any change to a `ReportNode`
 * actually results in a *new* `ReportNode` instance. This occurs recursively,
 * so inserting a new `ElementNode` into the tree will also result in new
 * `BlockNode`s for each of that Element's ancestors, all the way up to the
 * root node. Then, when React re-renders the app, it will re-traverse the new
 * nodes that have been created, and rebuild just the bits of the app that
 * have changed.
 */
export interface ReportNode {
  /**
   * The ID of the report this node was generated in. When a report finishes
   * running, the app prunes all stale nodes.
   */
  readonly reportId: string

  /**
   * Return the ReportNode for the given index path, or undefined if the path
   * is invalid.
   */
  getIn(path: number[]): ReportNode | undefined

  /**
   * Return a copy of this node with a new element set at the given index
   * path. Throws an error if the path is invalid.
   */
  setIn(path: number[], node: ReportNode, reportId: string): ReportNode

  /**
   * Recursively remove children nodes whose reportID is no longer current.
   * If this node should no longer exist, return undefined.
   */
  clearStaleNodes(currentReportId: string): ReportNode | undefined

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
  public setIn(
    path: number[],
    node: ReportNode,
    reportId: string
  ): ReportNode {
    throw new Error("'setIn' cannot be called on an ElementNode")
  }

  public clearStaleNodes(currentReportId: string): ElementNode | undefined {
    return this.reportId === currentReportId ? this : undefined
  }

  public getElements(elements: Set<Element>): void {
    elements.add(this.element)
  }

  public addRows(namedDataSet: NamedDataSet, reportId: string): ElementNode {
    const newNode = new ElementNode(this.element, this.metadata, reportId)
    newNode.lazyImmutableElement = addRows(
      this.immutableElement,
      toImmutableProto(NamedDataSet, namedDataSet)
    )
    return newNode
  }
}

/**
 * A container ReportNode that holds children.
 */
export class BlockNode implements ReportNode {
  public readonly children: ReportNode[]

  public readonly deltaBlock: BlockProto

  public readonly reportId: string

  /**
   * Create an empty BlockNode.
   */
  public static empty(): BlockNode {
    return new BlockNode([], BlockProto.create({}), NO_REPORT_ID)
  }

  public constructor(
    children: ReportNode[],
    deltaBlock: BlockProto,
    reportId: string
  ) {
    this.children = children
    this.deltaBlock = deltaBlock
    this.reportId = reportId
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

  public setIn(path: number[], node: ReportNode, reportId: string): BlockNode {
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
        node,
        reportId
      )
    }

    return new BlockNode(newChildren, this.deltaBlock, reportId)
  }

  public clearStaleNodes(currentReportId: string): BlockNode | undefined {
    if (this.reportId !== currentReportId) {
      return undefined
    }

    // Recursively clear our children.
    const newChildren = this.children
      .map(child => child.clearStaleNodes(currentReportId))
      .filter(notUndefined)

    // If we have no children and our `allowEmpty` flag is not set, prune
    // ourselves!
    if (newChildren.length === 0 && !this.deltaBlock.allowEmpty) {
      return undefined
    }

    return new BlockNode(newChildren, this.deltaBlock, currentReportId)
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
      new BlockNode(
        mainNodes,
        BlockProto.create({ allowEmpty: true }),
        NO_REPORT_ID
      ),
      BlockNode.empty()
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
          delta.addBlock as BlockProto,
          reportId
        )
      }

      case "addRows": {
        MetricsManager.current.incrementDeltaCounter("add rows")
        return this.addRows(
          containerId,
          deltaPath,
          delta.addRows as NamedDataSet,
          reportId
        )
      }

      default:
        throw new Error(`Unrecognized deltaType: '${delta.type}'`)
    }
  }

  public clearStaleNodes(currentReportId: string): ReportRoot {
    const main =
      this.main.clearStaleNodes(currentReportId) || BlockNode.empty()
    const sidebar =
      this.sidebar.clearStaleNodes(currentReportId) || BlockNode.empty()

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
    const newContainer = existingContainer.setIn(deltaPath, newNode, reportId)
    return this.setContainer(containerId, newContainer)
  }

  private addBlock(
    containerId: number,
    deltaPath: number[],
    block: BlockProto,
    reportId: string
  ): ReportRoot {
    const existingContainer = this.getContainer(containerId)
    const existingNode = existingContainer.getIn(deltaPath)

    // If we're replacing an existing Block, this new Block inherits
    // the existing Block's children. This prevents existing widgets from
    // having their values reset.
    const children: ReportNode[] =
      existingNode instanceof BlockNode ? existingNode.children : []

    const newNode = new BlockNode(children, block, reportId)
    const newContainer = existingContainer.setIn(deltaPath, newNode, reportId)
    return this.setContainer(containerId, newContainer)
  }

  private addRows(
    containerId: number,
    deltaPath: number[],
    namedDataSet: NamedDataSet,
    reportId: string
  ): ReportRoot {
    const existingContainer = this.getContainer(containerId)
    const existingNode = existingContainer.getIn(deltaPath) as ElementNode
    if (existingNode == null) {
      throw new Error(`Can't addRows: invalid deltaPath: ${deltaPath}`)
    }

    const newNode = existingNode.addRows(namedDataSet, reportId)
    const newContainer = existingContainer.setIn(deltaPath, newNode, reportId)
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
