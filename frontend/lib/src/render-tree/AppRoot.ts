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

import { AppNode, NO_SCRIPT_RUN_ID } from "./AppNode.interface"
import { BlockNode } from "./BlockNode"
import { ElementNode } from "./ElementNode"
import { DebugVisitor } from "./visitors/DebugVisitor"
import { ElementsSetVisitor } from "./visitors/ElementsSetVisitor"
import { GetNodeByDeltaPathVisitor } from "./visitors/GetNodeByDeltaPathVisitor"

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
  private appLogo: AppLogo | null

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
      // eslint-disable-next-line @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions -- TODO: Fix this
      throw new Error(`Invalid root node children! ${root}`)
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
    // Get the current script run id from one of the children
    const currentScriptRunId = this.main.scriptRunId
    const main =
      this.main.filterMainScriptElements(mainScriptHash) ||
      new BlockNode(mainScriptHash)
    const sidebar =
      this.sidebar.filterMainScriptElements(mainScriptHash) ||
      new BlockNode(mainScriptHash)
    const event =
      this.event.filterMainScriptElements(mainScriptHash) ||
      new BlockNode(mainScriptHash)
    const bottom =
      this.bottom.filterMainScriptElements(mainScriptHash) ||
      new BlockNode(mainScriptHash)
    const appLogo =
      this.appLogo?.activeScriptHash === mainScriptHash ? this.appLogo : null

    return new AppRoot(
      mainScriptHash,
      new BlockNode(
        mainScriptHash,
        [main, sidebar, event, bottom],
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
    const main =
      this.main.clearStaleNodes(currentScriptRunId, fragmentIdsThisRun) ||
      new BlockNode(this.mainScriptHash)
    const sidebar =
      this.sidebar.clearStaleNodes(currentScriptRunId, fragmentIdsThisRun) ||
      new BlockNode(this.mainScriptHash)
    const event =
      this.event.clearStaleNodes(currentScriptRunId, fragmentIdsThisRun) ||
      new BlockNode(this.mainScriptHash)
    const bottom =
      this.bottom.clearStaleNodes(currentScriptRunId, fragmentIdsThisRun) ||
      new BlockNode(this.mainScriptHash)

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
        [main, sidebar, event, bottom],
        new BlockProto({ allowEmpty: true }),
        currentScriptRunId
      ),
      appLogo
    )
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
      this.root.setIn(deltaPath, elementNode, scriptRunId),
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
    const existingNode = GetNodeByDeltaPathVisitor.getNodeAtPath(
      this.root,
      deltaPath
    )

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
      this.root.setIn(deltaPath, blockNode, scriptRunId),
      this.appLogo
    )
  }

  private arrowAddRows(
    deltaPath: number[],
    namedDataSet: ArrowNamedDataSet,
    scriptRunId: string
  ): AppRoot {
    const existingNode = GetNodeByDeltaPathVisitor.getNodeAtPath(
      this.root,
      deltaPath
    )
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
      this.root.setIn(deltaPath, elementNode, scriptRunId),
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
