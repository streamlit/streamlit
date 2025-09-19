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
  Block as BlockProto,
  Delta,
  Element,
  ForwardMsgMetadata,
  Logo,
} from "@streamlit/protobuf"

import { ensureError } from "~lib/util/ErrorHandling"
import {
  getLoadingScreenType,
  isNullOrUndefined,
  LoadingScreenType,
  makeAppSkeletonElement,
  makeElementWithErrorText,
  makeElementWithInfoText,
} from "~lib/util/utils"

import { AppNode } from "./AppNode.interface"
import { BlockNode } from "./BlockNode"
import { ElementNode } from "./ElementNode"
import { ClearStaleNodeVisitor } from "./visitors/ClearStaleNodeVisitor"
import { ElementsSetVisitor } from "./visitors/ElementsSetVisitor"
import { FilterMainScriptElementsVisitor } from "./visitors/FilterMainScriptElementsVisitor"
import { GetNodeByDeltaPathVisitor } from "./visitors/GetNodeByDeltaPathVisitor"
import { SetNodeByDeltaPathVisitor } from "./visitors/SetNodeByDeltaPathVisitor"

const NO_SCRIPT_RUN_ID = "NO_SCRIPT_RUN_ID"

interface LogoMetadata {
  // Associated scriptHash that created the logo
  activeScriptHash: string

  // Associated scriptRunId that created the logo
  scriptRunId: string
}
interface AppLogo extends LogoMetadata {
  logo: Logo
}

type ChildName = "main" | "sidebar" | "event" | "bottom"

/**
 * The root of our data tree. It contains the app's top-level BlockNodes.
 */
export class AppRoot {
  readonly root: Record<ChildName, AppNode>

  static readonly childOrder: ChildName[] = [
    "main",
    "sidebar",
    "event",
    "bottom",
  ]

  /* The hash of the main script that creates this AppRoot. */
  readonly mainScriptHash: string

  /* The app logo, if it exists. */
  private appLogo: AppLogo | null

  /**
   * Create an empty AppRoot with a placeholder "skeleton" element.
   */
  public static empty(
    mainScriptHash = "",
    isInitialRender = true,
    logo?: Logo | null
  ): AppRoot {
    const mainNodes: AppNode[] = []

    let waitElement: Element | undefined

    switch (getLoadingScreenType()) {
      case LoadingScreenType.NONE:
        break

      case LoadingScreenType.V1:
        // Only show the v1 loading state when it's the initial render.
        // This is how v1 used to work, and we don't want any backward
        // incompatibility.
        if (isInitialRender) {
          waitElement = makeElementWithInfoText("Please wait...")
        }
        break

      default:
        waitElement = makeAppSkeletonElement()
    }

    if (waitElement) {
      mainNodes.push(
        new ElementNode(
          waitElement,
          ForwardMsgMetadata.create({}),
          NO_SCRIPT_RUN_ID,
          mainScriptHash
        )
      )
    }

    const children = {} as Record<ChildName, AppNode>
    AppRoot.childOrder.forEach(childName => {
      children[childName] = new BlockNode(
        mainScriptHash,
        // Preserve the main nodes for the main block
        childName === "main" ? mainNodes : [],
        new BlockProto({ allowEmpty: true }),
        NO_SCRIPT_RUN_ID
      )
    })

    // Persist logo between pages to avoid flicker (MPA V1 - Issue #8815)
    const appLogo = logo
      ? {
          logo,
          activeScriptHash: mainScriptHash,
          scriptRunId: NO_SCRIPT_RUN_ID,
        }
      : null

    return new AppRoot(mainScriptHash, children, appLogo)
  }

  public constructor(
    mainScriptHash: string,
    root: Record<ChildName, AppNode>,
    appLogo: AppLogo | null = null
  ) {
    this.mainScriptHash = mainScriptHash
    this.root = root
    this.appLogo = appLogo

    // Verify that our root node has exactly 4 children: a 'main' block,
    // a 'sidebar' block, a `bottom` block and an 'event' block.
    if (
      AppRoot.childOrder.some(childName => isNullOrUndefined(root[childName]))
    ) {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions -- TODO: Fix this
      throw new Error(`Invalid root node children! ${root}`)
    }
  }

  public get main(): BlockNode {
    return this.root.main as BlockNode
  }

  public get sidebar(): BlockNode {
    return this.root.sidebar as BlockNode
  }

  public get event(): BlockNode {
    return this.root.event as BlockNode
  }

  public get bottom(): BlockNode {
    return this.root.bottom as BlockNode
  }

  public get logo(): Logo | null {
    return this.appLogo?.logo ?? null
  }

  public appRootWithLogo(logo: Logo, metadata: LogoMetadata): AppRoot {
    return new AppRoot(this.mainScriptHash, this.root, {
      logo,
      ...metadata,
    })
  }

  private runActionOnAllChildren(
    action: (child: AppNode) => AppNode
  ): Record<ChildName, AppNode> {
    const newChildren = {} as Record<ChildName, AppNode>
    AppRoot.childOrder.forEach(childName => {
      newChildren[childName] = action(this.root[childName])
    })
    return newChildren
  }

  private getIndexedChild(index: number): AppNode {
    return this.root[AppRoot.childOrder[index]]
  }

  private runActionOnChild<T extends AppNode>(
    deltaPath: number[],
    action: (child: T, deltaPath: number[]) => T | undefined
  ): T | undefined {
    if (deltaPath.length === 0) {
      return undefined
    }

    return action(this.getIndexedChild(deltaPath[0]) as T, deltaPath.slice(1))
  }

  private runActionByDeltaPath(
    deltaPath: number[],
    action: (child: AppNode, deltaPath: number[]) => AppNode
  ): Record<ChildName, AppNode> {
    const children = {} as Record<ChildName, AppNode>
    AppRoot.childOrder.forEach((childName, index) => {
      if (deltaPath.length === 0 || deltaPath[0] !== index) {
        children[childName] = this[childName]
      } else {
        children[childName] = action(this.root[childName], deltaPath.slice(1))
      }
    })
    return children
  }

  private findNodeByDeltaPath(deltaPath: number[]): AppNode | undefined {
    return this.runActionOnChild(deltaPath, (child, updatedDeltaPath) =>
      GetNodeByDeltaPathVisitor.getNodeAtPath(child, updatedDeltaPath)
    )
  }

  private setNodeByDeltaPathForScriptRun(
    deltaPath: number[],
    node: AppNode,
    scriptRunId: string
  ): Record<ChildName, AppNode> {
    return this.runActionByDeltaPath(deltaPath, (child, updatedDeltaPath) =>
      SetNodeByDeltaPathVisitor.setNodeAtPath(
        child,
        updatedDeltaPath,
        node,
        scriptRunId
      )
    )
  }

  public applyDelta(
    scriptRunId: string,
    delta: Delta,
    metadata: ForwardMsgMetadata
  ): AppRoot {
    // The full path to the AppNode within the element tree.
    // Used to find and update the element node specified by this Delta.
    const { deltaPath, activeScriptHash } = metadata
    switch (delta.type) {
      case "newElement": {
        const element = delta.newElement as Element
        return this.addElement(
          deltaPath,
          scriptRunId,
          element,
          metadata,
          activeScriptHash,
          delta.fragmentId
        )
      }

      case "addBlock": {
        const deltaMsgReceivedAt = Date.now()
        return this.addBlock(
          deltaPath,
          delta.addBlock as BlockProto,
          scriptRunId,
          activeScriptHash,
          delta.fragmentId,
          deltaMsgReceivedAt
        )
      }

      case "arrowAddRows": {
        try {
          return this.arrowAddRows(
            deltaPath,
            delta.arrowAddRows as ArrowNamedDataSet,
            scriptRunId
          )
        } catch (error) {
          const errorElement = makeElementWithErrorText(
            ensureError(error).message
          )
          return this.addElement(
            deltaPath,
            scriptRunId,
            errorElement,
            metadata,
            activeScriptHash
          )
        }
      }

      default: {
        throw new Error(`Unrecognized deltaType: '${delta.type}'`)
      }
    }
  }

  filterMainScriptElements(mainScriptHash: string): AppRoot {
    // clears all nodes that are not associated with the mainScriptHash
    const visitor = new FilterMainScriptElementsVisitor(mainScriptHash)

    const newChildren = this.runActionOnAllChildren(child =>
      this.ensureBlockNode(child.accept(visitor) as BlockNode | undefined)
    )

    const appLogo =
      this.appLogo?.activeScriptHash === mainScriptHash ? this.appLogo : null

    return new AppRoot(mainScriptHash, newChildren, appLogo)
  }

  public clearStaleNodes(
    currentScriptRunId: string,
    fragmentIdsThisRun?: Array<string>
  ): AppRoot {
    const visitor = new ClearStaleNodeVisitor(
      currentScriptRunId,
      fragmentIdsThisRun
    )
    const newChildren = this.runActionOnAllChildren(child =>
      this.ensureBlockNode(child.accept(visitor) as BlockNode | undefined)
    )

    // Check if we're running a fragment, ensure logo isn't cleared as stale (Issue #10350/#10382)
    const isFragmentRun = fragmentIdsThisRun && fragmentIdsThisRun.length > 0
    const appLogo =
      isFragmentRun || this.appLogo?.scriptRunId === currentScriptRunId
        ? this.appLogo
        : null

    return new AppRoot(this.mainScriptHash, newChildren, appLogo)
  }

  /** Return a Set containing all Elements in the tree. */
  public getElements(): Set<Element> {
    const visitor = new ElementsSetVisitor()

    // Visit each major section of the app
    this.main.accept(visitor)
    this.sidebar.accept(visitor)
    this.event.accept(visitor)
    this.bottom.accept(visitor)

    return visitor.elements
  }

  private addElement(
    deltaPath: number[],
    scriptRunId: string,
    element: Element,
    metadata: ForwardMsgMetadata,
    activeScriptHash: string,
    fragmentId?: string
  ): AppRoot {
    const elementNode = new ElementNode(
      element,
      metadata,
      scriptRunId,
      activeScriptHash,
      fragmentId
    )
    return new AppRoot(
      this.mainScriptHash,
      this.setNodeByDeltaPathForScriptRun(deltaPath, elementNode, scriptRunId),
      this.appLogo
    )
  }

  private addBlock(
    deltaPath: number[],
    block: BlockProto,
    scriptRunId: string,
    activeScriptHash: string,
    fragmentId?: string,
    deltaMsgReceivedAt?: number
  ): AppRoot {
    const existingNode = this.findNodeByDeltaPath(deltaPath)

    // If we're replacing an existing Block of the same type, this new Block
    // inherits the existing Block's children. This preserves two things:
    //  1. Widget State
    //  2. React state of all elements
    let children: AppNode[] = []
    if (
      existingNode instanceof BlockNode &&
      existingNode.deltaBlock.type === block.type
    ) {
      children = existingNode.children
    }

    const blockNode = new BlockNode(
      activeScriptHash,
      children,
      block,
      scriptRunId,
      fragmentId,
      deltaMsgReceivedAt
    )
    return new AppRoot(
      this.mainScriptHash,
      this.setNodeByDeltaPathForScriptRun(deltaPath, blockNode, scriptRunId),
      this.appLogo
    )
  }

  private arrowAddRows(
    deltaPath: number[],
    namedDataSet: ArrowNamedDataSet,
    scriptRunId: string
  ): AppRoot {
    const existingNode = this.findNodeByDeltaPath(deltaPath)
    if (
      isNullOrUndefined(existingNode) ||
      !(existingNode instanceof ElementNode)
    ) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`Can't arrowAddRows: invalid deltaPath: ${deltaPath}`)
    }

    const elementNode = existingNode.arrowAddRows(namedDataSet, scriptRunId)
    return new AppRoot(
      this.mainScriptHash,
      this.setNodeByDeltaPathForScriptRun(deltaPath, elementNode, scriptRunId),
      this.appLogo
    )
  }

  private ensureBlockNode(node: BlockNode | undefined): BlockNode {
    return node ?? new BlockNode(this.mainScriptHash)
  }
}
