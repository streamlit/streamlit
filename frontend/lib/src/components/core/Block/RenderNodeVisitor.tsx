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

import { ReactElement } from "react"

import { BlockNode, ElementNode } from "~lib/AppNode"
import { AppNodeVisitor } from "~lib/render-tree/visitors/AppNodeVisitor.interface"
import { getElementId } from "~lib/util/utils"

import { BlockNodeRenderer } from "./Block"
import ElementNodeRenderer from "./ElementNodeRenderer"

import { BlockPropsWithoutWidth } from "."

export type OptionalReactElement = ReactElement | null

/**
 * A visitor that renders AppNodes as React elements.
 *
 * Unlike other visitors in render-tree/visitors/, this visitor is
 * React-specific and located in components/ to maintain dependency
 * boundaries.
 *
 * This visitor accumulates React elements in a mutable array and tracks
 * rendered element IDs to prevent duplicate rendering of widgets.
 *
 * Usage:
 * ```typescript
 * const elements = RenderNodeVisitor.collectReactElements(props, disableFullscreen)
 * return <>{elements}</>
 * ```
 */
export class RenderNodeVisitor
  implements AppNodeVisitor<OptionalReactElement>
{
  private readonly props: BlockPropsWithoutWidth
  private readonly elementKeySet: Set<string>
  public readonly reactElements: OptionalReactElement[]
  private index: number

  constructor(props: BlockPropsWithoutWidth) {
    this.props = props
    this.elementKeySet = new Set<string>()
    this.reactElements = [] as OptionalReactElement[]
    // Initialize index to 0 as we will use it as a key in the React component
    this.index = 0
  }

  private getCurrentKey(elementId?: string): string {
    const key = elementId || this.index.toString()
    // Increment this.index to be used for the next key
    this.index += 1

    return key
  }

  visitBlockNode(node: BlockNode): OptionalReactElement {
    // Put node in childProps instead of passing as a node={node} prop in React to
    // guarantee it doesn't get overwritten by {...childProps}.
    const childProps = {
      ...this.props,
      node,
    }

    const key = this.getCurrentKey()
    const renderer = <BlockNodeRenderer key={key} {...childProps} />
    this.reactElements.push(renderer)

    return renderer
  }

  visitElementNode(node: ElementNode): OptionalReactElement {
    // Put node in childProps instead of passing as a node={node} prop in React to
    // guarantee it doesn't get overwritten by {...childProps}.
    const childProps = {
      ...this.props,
      node,
    }

    const key = this.getCurrentKey(getElementId(node.element))
    // Avoid rendering the same element twice. We assume the first one is the one we want
    // because the page is rendered top to bottom, so a valid widget would be rendered
    // correctly and we assume the second one is therefore stale (or throw an error).
    // Also, our setIn logic pushes stale widgets down in the list of elements, so the
    // most recent one should always come first.
    if (this.elementKeySet.has(key)) {
      return null
    }

    this.elementKeySet.add(key)

    const renderer = <ElementNodeRenderer key={key} {...childProps} />
    this.reactElements.push(renderer)

    return renderer
  }

  /**
   * Convenience method to render all children of a block as React elements.
   *
   * This is the primary entry point for rendering - it creates a visitor,
   * traverses all children, and returns the accumulated React elements.
   *
   * @param props - Block props containing the node to render
   * @param disableFullscreenMode - Whether to disable fullscreen mode for elements
   * @returns Array of React elements ready to render (may include nulls for duplicates)
   *
   * @example
   * const ChildRenderer = (props) => {
   *   return <>{RenderNodeVisitor.collectReactElements(props, false)}</>
   * }
   */
  static collectReactElements(
    props: BlockPropsWithoutWidth
  ): OptionalReactElement[] {
    if (!props.node.children) {
      return []
    }

    const visitor = new RenderNodeVisitor(props)
    // Visit all the children nodes and collect the react elements
    props.node.children.forEach(childNode => childNode.accept(visitor))

    return visitor.reactElements
  }
}
