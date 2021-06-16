/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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

import { Map as ImmutableMap } from "immutable"
import Protobuf, {
  Arrow as ArrowProto,
  ArrowNamedDataSet,
  BetaVegaLiteChart as BetaVegaLiteChartProto,
  Block as BlockProto,
  Delta,
  Element,
  ForwardMsgMetadata,
  IArrow,
  IArrowNamedDataSet,
  NamedDataSet,
} from "src/autogen/proto"
import {
  VegaLiteChartElement,
  WrappedNamedDataset,
} from "src/components/elements/BetaVegaLiteChart/BetaVegaLiteChart"
import { Quiver } from "src/lib/Quiver"
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
   * Return a Set of all the Elements contained in the tree.
   * If an existing Set is passed in, that Set will be mutated and returned.
   * Otherwise, a new Set will be created and will be returned.
   */
  getElements(elementSet?: Set<Element>): Set<Element>
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
   * This is temporary! `immutableElement` is currently needed for
   * dataframe-consuming elements because our dataframe API is
   * immutableJS-based. It'll go away when we've converted to an ArrowJS-based
   * dataframe API.
   *
   * Because most elements do *not* use the Dataframe API, and therefore
   * do not need to access `immutableElement`, it is calculated lazily.
   */
  private lazyImmutableElement: ImmutableMap<string, any> | undefined

  private lazyQuiverElement?: Quiver | VegaLiteChartElement

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

  public get quiverElement(): Quiver | VegaLiteChartElement {
    if (this.lazyQuiverElement !== undefined) {
      return this.lazyQuiverElement
    }

    // Element type is the only key in the object.
    const [elementType] = Object.keys(this.element)

    let toReturn: Quiver | VegaLiteChartElement
    switch (elementType) {
      case "betaTable": {
        toReturn = new Quiver(this.element.betaTable as ArrowProto)
        break
      }
      case "betaDataFrame": {
        toReturn = new Quiver(this.element.betaDataFrame as ArrowProto)
        break
      }
      case "betaVegaLiteChart": {
        const proto = this.element.betaVegaLiteChart as BetaVegaLiteChartProto
        const modifiedData = proto.data ? new Quiver(proto.data) : null
        const modifiedDatasets =
          proto.datasets.length > 0 ? wrapDatasets(proto.datasets) : []

        toReturn = {
          data: modifiedData,
          spec: proto.spec,
          datasets: modifiedDatasets,
          useContainerWidth: proto.useContainerWidth,
        }
        break
      }
      default: {
        // This should never happen!
        throw new Error("Unsupported quiverElement type.")
      }
    }

    this.lazyQuiverElement = toReturn
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

  public getElements(elements?: Set<Element>): Set<Element> {
    if (elements == null) {
      elements = new Set<Element>()
    }
    elements.add(this.element)
    return elements
  }

  public addRows(namedDataSet: NamedDataSet, reportId: string): ElementNode {
    const newNode = new ElementNode(this.element, this.metadata, reportId)
    newNode.lazyImmutableElement = addRows(
      this.immutableElement,
      toImmutableProto(NamedDataSet, namedDataSet)
    )
    return newNode
  }

  public betaAddRows(
    namedDataSet: ArrowNamedDataSet,
    reportId: string
  ): ElementNode {
    const newNode = new ElementNode(this.element, this.metadata, reportId)
    newNode.lazyQuiverElement = ElementNode.betaAddRowsHelper(
      this.quiverElement,
      namedDataSet
    )
    return newNode
  }

  private static betaAddRowsHelper(
    element: Quiver | VegaLiteChartElement,
    namedDataSet: ArrowNamedDataSet
  ): Quiver | VegaLiteChartElement {
    const name = namedDataSet.hasName ? namedDataSet.name : null
    const newRows = namedDataSet.data
    const namedDataSets = (element as VegaLiteChartElement).datasets
    const [existingDatasetIndex, existingDataSet] = getNamedDataSet(
      namedDataSets,
      name
    )

    let dataframeToModify

    // There are 5 cases to consider:
    // 1. add_rows has a named dataset
    //   a) element has a named dataset with that name -> use that one
    //   b) element has no named dataset with that name -> put the new dataset into the element
    // 2. add_rows as an unnamed dataset
    //   a) element has an unnamed dataset -> use that one
    //   b) element has only named datasets -> use the first named dataset
    //   c) element has no dataset -> put the new dataset into the element
    if (namedDataSet.hasName) {
      if (existingDataSet) {
        dataframeToModify = existingDataSet.data
      } else {
        const newQuiver = new Quiver(newRows as IArrow)

        if (element.data instanceof Quiver) {
          element.data.addRows(newQuiver)
          return element
        }

        return setDataFrame(element, newQuiver)
      }
    } else {
      const existingDataFrame =
        element instanceof Quiver ? element : element.data
      if (existingDataFrame) {
        dataframeToModify = existingDataFrame
      } else if (existingDataSet) {
        dataframeToModify = existingDataSet.data
      } else {
        return setDataFrame(element, new Quiver(newRows as IArrow))
      }
    }

    dataframeToModify.addRows(new Quiver(newRows as IArrow))

    if (existingDataSet) {
      ;(element as VegaLiteChartElement).datasets[
        existingDatasetIndex
      ].data = dataframeToModify

      return element
    }
    return setDataFrame(element, dataframeToModify)
  }
}

/**
 * A container ReportNode that holds children.
 */
export class BlockNode implements ReportNode {
  public readonly children: ReportNode[]

  public readonly deltaBlock: BlockProto

  public readonly reportId: string

  public constructor(
    children?: ReportNode[],
    deltaBlock?: BlockProto,
    reportId?: string
  ) {
    this.children = children ?? []
    this.deltaBlock = deltaBlock ?? new BlockProto({})
    this.reportId = reportId ?? NO_REPORT_ID
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

  public getElements(elementSet?: Set<Element>): Set<Element> {
    if (elementSet == null) {
      elementSet = new Set<Element>()
    }

    for (const child of this.children) {
      child.getElements(elementSet)
    }

    return elementSet
  }
}

/**
 * The root of our data tree. It contains the app's top-level BlockNodes.
 */
export class ReportRoot {
  private readonly root: BlockNode

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

    const main = new BlockNode(
      mainNodes,
      new BlockProto({ allowEmpty: true }),
      NO_REPORT_ID
    )

    const sidebar = new BlockNode(
      [],
      new BlockProto({ allowEmpty: true }),
      NO_REPORT_ID
    )

    return new ReportRoot(new BlockNode([main, sidebar]))
  }

  public constructor(root: BlockNode) {
    this.root = root

    // Verify that our root node has exactly 2 children: a 'main' block and
    // a 'sidebar' block.
    if (
      this.root.children.length !== 2 ||
      this.main == null ||
      this.sidebar == null
    ) {
      throw new Error(`Invalid root node children! ${root}`)
    }
  }

  public get main(): BlockNode {
    return this.root.children[Protobuf.RootContainer.MAIN] as BlockNode
  }

  public get sidebar(): BlockNode {
    return this.root.children[Protobuf.RootContainer.SIDEBAR] as BlockNode
  }

  public applyDelta(
    reportId: string,
    delta: Delta,
    metadata: ForwardMsgMetadata
  ): ReportRoot {
    // The full path to the ReportNode within the element tree.
    // Used to find and update the element node specified by this Delta.
    const { deltaPath } = metadata

    // Update Metrics
    MetricsManager.current.incrementDeltaCounter(
      getRootContainerName(deltaPath)
    )

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

        return this.addElement(deltaPath, reportId, element, metadata)
      }

      case "addBlock": {
        MetricsManager.current.incrementDeltaCounter("new block")
        return this.addBlock(deltaPath, delta.addBlock as BlockProto, reportId)
      }

      case "addRows": {
        MetricsManager.current.incrementDeltaCounter("add rows")
        return this.addRows(deltaPath, delta.addRows as NamedDataSet, reportId)
      }

      case "betaAddRows": {
        // MetricsManager.current.incrementDeltaCounter("beta add rows")
        return this.betaAddRows(
          deltaPath,
          delta.betaAddRows as ArrowNamedDataSet,
          reportId
        )
      }

      default:
        throw new Error(`Unrecognized deltaType: '${delta.type}'`)
    }
  }

  public clearStaleNodes(currentReportId: string): ReportRoot {
    const main = this.main.clearStaleNodes(currentReportId) || new BlockNode()
    const sidebar =
      this.sidebar.clearStaleNodes(currentReportId) || new BlockNode()

    return new ReportRoot(
      new BlockNode(
        [main, sidebar],
        new BlockProto({ allowEmpty: true }),
        currentReportId
      )
    )
  }

  /** Return a Set containing all Elements in the tree. */
  public getElements(): Set<Element> {
    const elements = new Set<Element>()
    this.main.getElements(elements)
    this.sidebar.getElements(elements)
    return elements
  }

  private addElement(
    deltaPath: number[],
    reportId: string,
    element: Element,
    metadata: ForwardMsgMetadata
  ): ReportRoot {
    const elementNode = new ElementNode(element, metadata, reportId)
    return new ReportRoot(this.root.setIn(deltaPath, elementNode, reportId))
  }

  private addBlock(
    deltaPath: number[],
    block: BlockProto,
    reportId: string
  ): ReportRoot {
    const existingNode = this.root.getIn(deltaPath)

    // If we're replacing an existing Block, this new Block inherits
    // the existing Block's children. This prevents existing widgets from
    // having their values reset.
    const children: ReportNode[] =
      existingNode instanceof BlockNode ? existingNode.children : []

    const blockNode = new BlockNode(children, block, reportId)
    return new ReportRoot(this.root.setIn(deltaPath, blockNode, reportId))
  }

  private addRows(
    deltaPath: number[],
    namedDataSet: NamedDataSet,
    reportId: string
  ): ReportRoot {
    const existingNode = this.root.getIn(deltaPath) as ElementNode
    if (existingNode == null) {
      throw new Error(`Can't addRows: invalid deltaPath: ${deltaPath}`)
    }

    const elementNode = existingNode.addRows(namedDataSet, reportId)
    return new ReportRoot(this.root.setIn(deltaPath, elementNode, reportId))
  }

  private betaAddRows(
    deltaPath: number[],
    namedDataSet: ArrowNamedDataSet,
    reportId: string
  ): ReportRoot {
    const existingNode = this.root.getIn(deltaPath) as ElementNode
    if (existingNode == null) {
      throw new Error(`Can't betaAddRows: invalid deltaPath: ${deltaPath}`)
    }

    const elementNode = existingNode.betaAddRows(namedDataSet, reportId)
    return new ReportRoot(this.root.setIn(deltaPath, elementNode, reportId))
  }
}

function getRootContainerName(deltaPath: number[]): string {
  if (deltaPath.length > 0) {
    switch (deltaPath[0]) {
      case Protobuf.RootContainer.MAIN:
        return "main"
      case Protobuf.RootContainer.SIDEBAR:
        return "sidebar"
      default:
        break
    }
  }

  throw new Error(`Unrecognized RootContainer in deltaPath: ${deltaPath}`)
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

/**
 * Sets the dataframe of this element.
 * Returns a new element -- NOT A DATAFRAME!
 */
function setDataFrame(
  element: Quiver | VegaLiteChartElement,
  newRows: Quiver
): Quiver | VegaLiteChartElement {
  if (element instanceof Quiver) {
    element = newRows
  } else {
    element.data = newRows
  }

  return element
}

/**
 * If there is only one NamedDataSet, returns [0, NamedDataSet] with the 0th
 * NamedDataSet.
 * Otherwise, returns the [index, NamedDataSet] with the NamedDataSet
 * matching the given name.
 */
function getNamedDataSet(
  namedDataSets: WrappedNamedDataset[] | null,
  name: string | null
): any {
  if (namedDataSets != null) {
    if (namedDataSets.length === 1) {
      const firstNamedDataSet = namedDataSets[0]
      return [0, firstNamedDataSet]
    }

    const namedDataSetEntry = namedDataSets.find(
      (ds: any) => ds.hasName && ds.name === name
    )

    if (namedDataSetEntry) {
      return namedDataSetEntry
    }
  }

  return [-1, null]
}
