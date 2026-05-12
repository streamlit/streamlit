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
  Block as BlockProto,
  Delta,
  Element,
  ForwardMsgMetadata,
  Logo,
  Transient as TransientProto,
} from "@streamlit/protobuf"

import {
  getLoadingScreenType,
  isNullOrUndefined,
  LoadingScreenType,
  makeAppSkeletonElement,
  makeElementWithInfoText,
} from "~lib/util/utils"

import { AppNode, NO_SCRIPT_RUN_ID } from "./AppNode.interface"
import { BlockNode } from "./BlockNode"
import { ElementNode } from "./ElementNode"
import { TransientNode } from "./TransientNode"
import { ClearStaleNodeVisitor } from "./visitors/ClearStaleNodeVisitor"
import { ClearTransientNodesVisitor } from "./visitors/ClearTransientNodesVisitor"
import { DebugVisitor } from "./visitors/DebugVisitor"
import { ElementsSetVisitor } from "./visitors/ElementsSetVisitor"
import { FilterMainScriptElementsVisitor } from "./visitors/FilterMainScriptElementsVisitor"
import { GetNodeByDeltaPathVisitor } from "./visitors/GetNodeByDeltaPathVisitor"
import { SetNodeByDeltaPathVisitor } from "./visitors/SetNodeByDeltaPathVisitor"

/**
 * Determine if we can reuse the element payload from an existing node.
 * Returns true only when:
 * - elementHash is non-empty and matches the existing node's hash
 * - The element type matches
 * - The element doesn't have a one-shot effect flag set by the backend
 */
function canReuseElementPayload(
  existingNode: AppNode | undefined,
  elementHash: string | undefined,
  nextElement: Element
): existingNode is ElementNode {
  return (
    Boolean(elementHash) &&
    nextElement.type !== undefined &&
    existingNode instanceof ElementNode &&
    existingNode.elementHash === elementHash &&
    existingNode.element.type === nextElement.type &&
    !nextElement.hasOneShotEffect
  )
}

interface LogoMetadata {
  // Associated scriptHash that created the logo
  activeScriptHash: string

  // Associated scriptRunId that created the logo
  scriptRunId: string
}
interface AppLogo extends LogoMetadata {
  logo: Logo
}

/**
 * The root of our data tree. It contains the app's top-level BlockNodes.
 */
export class AppRoot {
  readonly root: BlockNode

  /* The hash of the main script that creates this AppRoot. */
  readonly mainScriptHash: string

  /* The app logo, if it exists. */
  private readonly appLogo: AppLogo | null

  /**
   * Create an empty AppRoot with a placeholder "skeleton" element.
   * @param mainScriptHash - The hash of the main script that creates this AppRoot.
   * @param isInitialRender - Whether this is the initial render.
   * @param sidebarElements - The elements to add to the sidebar (this was a relic
   * of MPA V1 to maintain the sidebar from flickering, we don't use it anymore).
   * @param logo - The logo to add to the app.
   * @returns A new AppRoot with the given parameters.
   */
  public static empty(
    mainScriptHash = "",
    isInitialRender = true,
    sidebarElements?: BlockNode,
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
        break
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

    const main = new BlockNode(
      mainScriptHash,
      mainNodes,
      new BlockProto({ allowEmpty: true }),
      NO_SCRIPT_RUN_ID
    )

    const sidebar =
      sidebarElements ||
      new BlockNode(
        mainScriptHash,
        [],
        new BlockProto({ allowEmpty: true }),
        NO_SCRIPT_RUN_ID
      )

    const event = new BlockNode(
      mainScriptHash,
      [],
      new BlockProto({ allowEmpty: true }),
      NO_SCRIPT_RUN_ID
    )

    const bottom = new BlockNode(
      mainScriptHash,
      [],
      new BlockProto({ allowEmpty: true }),
      NO_SCRIPT_RUN_ID
    )

    // Persist logo between pages to avoid flicker (MPA V1 - Issue #8815)
    const appLogo = logo
      ? {
          logo,
          activeScriptHash: mainScriptHash,
          scriptRunId: NO_SCRIPT_RUN_ID,
        }
      : null

    return new AppRoot(
      mainScriptHash,
      new BlockNode(mainScriptHash, [main, sidebar, event, bottom]),
      appLogo
    )
  }

  public constructor(
    mainScriptHash: string,
    root: BlockNode,
    appLogo: AppLogo | null = null
  ) {
    this.mainScriptHash = mainScriptHash
    this.root = root
    this.appLogo = appLogo

    // Verify that our root node has exactly 4 children: a 'main' block,
    // a 'sidebar' block, a `bottom` block and an 'event' block.
    if (
      this.root.children.length !== 4 ||
      isNullOrUndefined(this.main) ||
      isNullOrUndefined(this.sidebar) ||
      isNullOrUndefined(this.event) ||
      isNullOrUndefined(this.bottom)
    ) {
      throw new Error(`Invalid root node children! ${root.debug()}`)
    }
  }

  public get main(): BlockNode {
    const [main] = this.root.children
    return main as BlockNode
  }

  public get sidebar(): BlockNode {
    const [, sidebar] = this.root.children
    return sidebar as BlockNode
  }

  public get event(): BlockNode {
    const [, , event] = this.root.children
    return event as BlockNode
  }

  public get bottom(): BlockNode {
    const [, , , bottom] = this.root.children
    return bottom as BlockNode
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

  public applyDelta(
    scriptRunId: string,
    delta: Delta,
    metadata: ForwardMsgMetadata,
    elementHash?: string
  ): AppRoot {
    // The full path to the AppNode within the element tree.
    // Used to find and update the element node specified by this Delta.
    const { deltaPath, activeScriptHash } = metadata
    switch (delta.type) {
      case "newElement": {
        const nextElement = delta.newElement as Element
        const existingNode = GetNodeByDeltaPathVisitor.getNodeAtPath(
          this.root,
          deltaPath
        )

        // Check if we can reuse the payload from an existing node
        const canReuse = canReuseElementPayload(
          existingNode,
          elementHash,
          nextElement
        )

        return this.addElement(
          deltaPath,
          scriptRunId,
          canReuse ? existingNode.element : nextElement,
          metadata,
          activeScriptHash,
          delta.fragmentId,
          elementHash
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

      case "newTransient": {
        const transient = delta.newTransient as TransientProto
        return this.addTransient(
          deltaPath,
          scriptRunId,
          transient,
          metadata,
          activeScriptHash,
          delta.fragmentId
        )
      }

      default: {
        throw new Error(`Unrecognized deltaType: '${delta.type}'`)
      }
    }
  }

  private ensureBlockNode(
    node: AppNode | undefined,
    mainScriptHash: string = this.mainScriptHash
  ): BlockNode {
    return (node as BlockNode) ?? new BlockNode(mainScriptHash)
  }

  /**
   * Clears all nodes that are not associated with the mainScriptHash.
   * @param mainScriptHash - The hash of the main script.
   * @returns A new AppRoot with the filtered nodes.
   */
  filterMainScriptElements(mainScriptHash: string): AppRoot {
    const currentScriptRunId = this.main.scriptRunId
    const visitor = new FilterMainScriptElementsVisitor(mainScriptHash)
    const newChildren = this.root.children.map(child =>
      this.ensureBlockNode(
        child.accept(visitor) as BlockNode | undefined,
        mainScriptHash
      )
    )

    const appLogo =
      this.appLogo?.activeScriptHash === mainScriptHash ? this.appLogo : null

    return new AppRoot(
      mainScriptHash,
      new BlockNode(
        mainScriptHash,
        newChildren,
        new BlockProto({ allowEmpty: true }),
        currentScriptRunId
      ),
      appLogo
    )
  }

  public clearStaleNodes(
    currentScriptRunId: string,
    fragmentIdsThisRun?: Array<string>
  ): AppRoot {
    const visitor = new ClearStaleNodeVisitor(
      currentScriptRunId,
      fragmentIdsThisRun
    )
    const newChildren = this.root.children.map(node =>
      this.ensureBlockNode(node.accept(visitor))
    )

    // Check if we're running a fragment, ensure logo isn't cleared as stale (Issue #10350/#10382)
    const isFragmentRun = fragmentIdsThisRun && fragmentIdsThisRun.length > 0
    const appLogo =
      isFragmentRun || this.appLogo?.scriptRunId === currentScriptRunId
        ? this.appLogo
        : null

    return new AppRoot(
      this.mainScriptHash,
      new BlockNode(
        this.mainScriptHash,
        newChildren,
        new BlockProto({ allowEmpty: true }),
        currentScriptRunId
      ),
      appLogo
    )
  }

  public clearTransientNodes(fragmentIdsThisRun?: Array<string>): AppRoot {
    const visitor = new ClearTransientNodesVisitor(fragmentIdsThisRun)
    const newChildren = this.root.children.map(node =>
      this.ensureBlockNode(node.accept(visitor))
    )

    return new AppRoot(
      this.mainScriptHash,
      new BlockNode(
        this.mainScriptHash,
        newChildren,
        new BlockProto({ allowEmpty: true }),
        this.main.scriptRunId
      ),
      this.appLogo
    )
  }

  /** Return a Set containing all Elements in the tree. */
  public getElements(): Set<Element> {
    return this.getActiveIds().elements
  }

  /**
   * Return all active element IDs and block IDs in the tree.
   * Block IDs are collected from blocks that have a stable identity
   * (e.g. keyed layout containers), and are needed to prevent
   * elementStates entries from being garbage-collected.
   */
  public getActiveIds(): {
    elements: Set<Element>
    blockIds: Set<string>
  } {
    const visitor = new ElementsSetVisitor()

    this.main.accept(visitor)
    this.sidebar.accept(visitor)
    this.event.accept(visitor)
    this.bottom.accept(visitor)

    return { elements: visitor.elements, blockIds: visitor.blockIds }
  }

  private addElement(
    deltaPath: number[],
    scriptRunId: string,
    element: Element,
    metadata: ForwardMsgMetadata,
    activeScriptHash: string,
    fragmentId?: string,
    elementHash?: string
  ): AppRoot {
    const elementNode = new ElementNode(
      element,
      metadata,
      scriptRunId,
      activeScriptHash,
      fragmentId,
      elementHash
    )
    return new AppRoot(
      this.mainScriptHash,
      SetNodeByDeltaPathVisitor.setNodeAtPath(
        this.root,
        deltaPath,
        elementNode,
        scriptRunId
      ) as BlockNode,
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
    const existingNodeAtPath = GetNodeByDeltaPathVisitor.getNodeAtPath(
      this.root,
      deltaPath
    )
    // Transient nodes are transport wrappers. For child inheritance, operate on
    // the underlying anchor node when available.
    const existingNode =
      existingNodeAtPath instanceof TransientNode
        ? (existingNodeAtPath.anchor ?? existingNodeAtPath)
        : existingNodeAtPath

    // If we're replacing an existing Block of the same type, this new Block
    // inherits the existing Block's children. This preserves two things:
    //  1. Widget State
    //  2. React state of all elements
    let children: AppNode[] = []
    if (
      existingNode instanceof BlockNode &&
      existingNode.deltaBlock.type === block.type
    ) {
      // For dialog blocks, don't inherit children if the dialog identity is different.
      // The identity is computed from the dialog's attributes.
      // This prevents showing stale elements from a previous
      // dialog when switching between different dialogs (see issue #10907).
      const isDialogWithDifferentIdentity =
        block.dialog &&
        existingNode.deltaBlock.dialog &&
        block.id !== existingNode.deltaBlock.id

      if (!isDialogWithDifferentIdentity) {
        children = existingNode.children
      }
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
      SetNodeByDeltaPathVisitor.setNodeAtPath(
        this.root,
        deltaPath,
        blockNode,
        scriptRunId
      ) as BlockNode,
      this.appLogo
    )
  }

  addTransient(
    deltaPath: number[],
    scriptRunId: string,
    transient: TransientProto,
    metadata: ForwardMsgMetadata,
    activeScriptHash: string,
    fragmentId?: string,
    deltaMsgReceivedAt?: number
  ): AppRoot {
    const transientNode = new TransientNode(
      scriptRunId,
      undefined, // We do not have an anchor yet
      transient.elements.map(
        element =>
          new ElementNode(
            element as Element,
            metadata,
            scriptRunId,
            activeScriptHash,
            fragmentId
          )
      ),
      deltaMsgReceivedAt
    )

    return new AppRoot(
      this.mainScriptHash,
      SetNodeByDeltaPathVisitor.setNodeAtPath(
        this.root,
        deltaPath,
        transientNode,
        scriptRunId
      ) as BlockNode,
      this.appLogo
    )
  }

  private getChildName(child: AppNode): string {
    switch (child) {
      case this.main:
        return "main"
      case this.sidebar:
        return "sidebar"
      case this.event:
        return "event"
      case this.bottom:
        return "bottom"
      default:
        return "unknown"
    }
  }

  /**
   * Returns a string representation of the AppRoot structure for debugging purposes.
   * This method traverses the AppRoot tree and outputs a formatted string
   * showing the hierarchy of its child nodes.
   *
   * @returns {string} A formatted string representing the AppRoot structure.
   */
  public debug(): string {
    let result = "AppRoot\n"
    this.root.children.forEach((child, index) => {
      const isLast = index === this.root.children.length - 1
      const childName = this.getChildName(child)
      const connector = isLast ? "└── " : "├── "
      const childPrefix = isLast ? "    " : "│   "

      result += `${connector}${childName}:\n`
      const visitor = new DebugVisitor(childPrefix, true)
      result += child.accept(visitor)
    })

    return result
  }
}
