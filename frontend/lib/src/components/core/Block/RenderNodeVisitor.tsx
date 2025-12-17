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

import { BlockNode, ElementNode, TransientNode } from "~lib/AppNode"
import { AppNodeVisitor } from "~lib/render-tree/visitors/AppNodeVisitor.interface"
import { getElementId } from "~lib/util/utils"

import { BlockNodeRenderer } from "./Block"
import ElementNodeRenderer from "./ElementNodeRenderer"

import { BlockPropsWithoutWidth } from "."

export type OptionalReactElements =
  | ReactElement
  | ReactElement[]
  | null
  | undefined

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
export class RenderNodeVisitor implements AppNodeVisitor<OptionalReactElements> {
  private readonly props: BlockPropsWithoutWidth
  private readonly elementKeyOverride?: string
  private readonly elementKeySet: Set<string>
  public readonly reactElements: ReactElement[]
  private index: number
  private transientElementCount: number

  constructor(props: BlockPropsWithoutWidth, elementKeyOverride?: string) {
    this.props = props
    this.elementKeyOverride = elementKeyOverride
    this.elementKeySet = new Set<string>()
    this.reactElements = []
    // Initialize index to 0 as we will use it as a key in the React component
    this.index = 0
    this.transientElementCount = 0
  }

  private getCurrentKey(elementId?: string): string {
    return this.elementKeyOverride || elementId || this.index.toString()
  }

  private conformToArray(elements: OptionalReactElements): ReactElement[] {
    if (!elements) {
      return []
    }

    if (Array.isArray(elements)) {
      return elements
    }

    return [elements]
  }

  visitBlockNode(node: BlockNode): OptionalReactElements {
    // Put node in childProps instead of passing as a node={node} prop in React to
    // guarantee it doesn't get overwritten by {...childProps}.
    const childProps = {
      ...this.props,
      node,
    }

    const key = this.getCurrentKey()
    this.index += 1
    const renderer = <BlockNodeRenderer key={key} {...childProps} />
    this.reactElements.push(renderer)

    return renderer
  }

  visitTransientNode(node: TransientNode): OptionalReactElements {
    const transientReactElements: OptionalReactElements = []
    node.transientNodes.forEach(element => {
      const keyOverride = this.getCurrentKey(
        `transient-${this.transientElementCount}`
      )
      this.transientElementCount += 1
      const transientReactElement = element.accept(
        new RenderNodeVisitor(this.props, keyOverride)
      )
      transientReactElements.push(
        ...this.conformToArray(transientReactElement)
      )
    })

    // Add the transient elements to the react elements.
    // The anchor element will be added later.
    this.reactElements.push(...transientReactElements)

    const anchorReactElement = node.anchor?.accept(this)
    transientReactElements.push(...this.conformToArray(anchorReactElement))

    return transientReactElements
  }

  visitElementNode(node: ElementNode): OptionalReactElements {
    // Put node in childProps instead of passing as a node={node} prop in React to
    // guarantee it doesn't get overwritten by {...childProps}.
    const childProps = {
      ...this.props,
      node,
    }

    const key = this.getCurrentKey(getElementId(node.element))
    this.index += 1
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
  static collectReactElements(props: BlockPropsWithoutWidth): ReactElement[] {
    if (!props.node.children) {
      return []
    }

    const visitor = new RenderNodeVisitor(props)
    // Visit all the children nodes and collect the react elements
    props.node.children.forEach(childNode => childNode.accept(visitor))

    return visitor.reactElements
  }
}
