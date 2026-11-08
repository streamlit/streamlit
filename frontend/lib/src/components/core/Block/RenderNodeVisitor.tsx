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

import type { ReactElement } from "react"

import type { BlockNode, ElementNode, TransientNode } from "~lib/AppNode"
import type { RetainedElement } from "~lib/render-tree/elementRetention"
import type { AppNodeVisitor } from "~lib/render-tree/visitors/AppNodeVisitor.interface"
import { getElementId } from "~lib/util/utils"

import { BlockNodeRenderer, type BlockPropsWithoutWidth } from "./Block"
import ElementNodeRenderer from "./ElementNodeRenderer"

type OptionalReactElements = ReactElement | ReactElement[] | null | undefined

/**
 * A visitor that renders AppNodes as React elements.
 *
 * Unlike other visitors in render-tree/visitors/, this visitor is
 * React-specific and located in components/ to maintain dependency
 * boundaries.
 *
 * This visitor accumulates React elements in a mutable array and tracks
 * rendered element and block IDs so a rerun cannot mount the same widget or
 * keyed container twice.
 *
 * Usage:
 * ```typescript
 * const elements = RenderNodeVisitor.collectReactElements(props, disableFullscreen)
 * return elements
 * ```
 */
export class RenderNodeVisitor implements AppNodeVisitor<OptionalReactElements> {
  private readonly props: BlockPropsWithoutWidth
  private readonly elementKeyOverride?: string
  private readonly renderedKeySet: Set<string>
  public readonly reactElements: ReactElement[]
  /**
   * Rendered previous-run nodes that a skeleton will replace, by React key,
   * with their index in `reactElements`.
   */
  private readonly pendingSkeletonSlots = new Map<
    string,
    { index: number; skeleton: ElementNode }
  >()
  private index: number
  private transientElementCount: number

  constructor(props: BlockPropsWithoutWidth, elementKeyOverride?: string) {
    this.props = props
    this.elementKeyOverride = elementKeyOverride
    this.renderedKeySet = new Set<string>()
    this.reactElements = []
    // Initialize index to 0 as we will use it as a key in the React component
    this.index = 0
    this.transientElementCount = 0
  }

  private getCurrentKey(elementId?: string): string {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- blank key override falls through to the element id
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

    // Use blockId as React key when available so that keyed containers
    // maintain component identity across positional shifts (e.g. when a
    // conditional element above the container causes it to move).
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- blank block id means unset
    const blockId = node.deltaBlock.id || undefined
    const key = this.getCurrentKey(blockId)
    this.index += 1
    // Keep the first sibling with this block id and skip later copies. A rerun
    // writes the updated block at its new index but only clears stale nodes when
    // the run finishes, so the old copy can still sit at a later index. Rendering
    // both would give two siblings the same React key, which makes React warn and
    // can remount the container. visitElementNode dedupes widgets the same way.
    const renderer = <BlockNodeRenderer key={key} {...childProps} />
    if (blockId) {
      return this.addKeyedRenderer(key, node, renderer)
    }
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
    return this.addKeyedRenderer(
      key,
      node,
      <ElementNodeRenderer key={key} {...childProps} />
    )
  }

  /**
   * Add `renderer` unless a sibling with the same key already rendered. A
   * skeleton that waits to replace a previous run's copy changes this when
   * the layout shifted and this run wrote the node at another index:
   * - Shifted down: the kept copy rendered first. Its slot shows the
   *   skeleton, and this run's copy takes over the React instance by key.
   * - Shifted up: this run's copy rendered first, and the kept copy's slot
   *   shows the skeleton.
   */
  private addKeyedRenderer(
    key: string,
    node: BlockNode | ElementNode,
    renderer: ReactElement
  ): ReactElement | null {
    const pendingSlot = this.pendingSkeletonSlots.get(key)
    if (pendingSlot?.skeleton.scriptRunId === node.scriptRunId) {
      this.pendingSkeletonSlots.delete(key)
      this.reactElements[pendingSlot.index] = this.renderSkeleton(
        key,
        pendingSlot.skeleton
      )
    } else if (this.renderedKeySet.has(key)) {
      if (node.pendingSkeleton === undefined) {
        return null
      }
      const skeleton = this.renderSkeleton(key, node.pendingSkeleton)
      this.reactElements.push(skeleton)
      return skeleton
    } else {
      this.renderedKeySet.add(key)
      if (node.pendingSkeleton) {
        this.pendingSkeletonSlots.set(key, {
          index: this.reactElements.length,
          skeleton: node.pendingSkeleton,
        })
      }
    }
    this.reactElements.push(renderer)
    return renderer
  }

  /** Render `skeleton` in the slot of the kept node with `key`. */
  private renderSkeleton(key: string, skeleton: ElementNode): ReactElement {
    return (
      <ElementNodeRenderer
        key={`${key}-skeleton`}
        {...this.props}
        node={skeleton}
      />
    )
  }

  /**
   * Convenience method to render all children of a block as React elements.
   *
   * This is the primary entry point for rendering - it creates a visitor,
   * traverses all children, and returns the accumulated React elements.
   * Retained elements of the block are interleaved in front of
   * `children[before]`.
   *
   * @param props - Block props containing the node to render
   * @param disableFullscreenMode - Whether to disable fullscreen mode for elements
   * @returns Array of React elements ready to render (may include nulls for duplicates)
   *
   * @example
   * const ChildRenderer = (props) => {
   *   return RenderNodeVisitor.collectReactElements(props, false)
   * }
   */
  static collectReactElements(props: BlockPropsWithoutWidth): ReactElement[] {
    const visitor = new RenderNodeVisitor(props)
    const { children, retained } = props.node

    if (retained.length === 0) {
      // Visit all the children nodes and collect the react elements
      children.forEach(childNode => childNode.accept(visitor))
      return visitor.reactElements
    }

    // Each retained element renders right in front of children[before], or
    // after the last child, which keeps it where it rendered before the
    // rerun displaced it.
    let retainedIndex = 0
    for (let index = 0; index <= children.length; index++) {
      while (
        retainedIndex < retained.length &&
        Math.min(retained[retainedIndex].before, children.length) === index
      ) {
        visitor.visitRetainedElement(retained[retainedIndex])
        retainedIndex++
      }
      if (index < children.length) {
        children[index].accept(visitor)
      }
    }

    return visitor.reactElements
  }

  /**
   * Render a retained element under its element ID, unless an element with
   * that ID already rendered. It does not advance the positional index, so
   * the index-based keys of unkeyed siblings stay the same.
   */
  visitRetainedElement({ node, id }: RetainedElement): ReactElement | null {
    if (this.renderedKeySet.has(id)) {
      return null
    }
    this.renderedKeySet.add(id)
    const renderer = (
      <ElementNodeRenderer key={id} {...this.props} node={node} isRetained />
    )
    this.reactElements.push(renderer)
    return renderer
  }
}
