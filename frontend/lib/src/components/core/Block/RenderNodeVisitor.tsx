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

import { BlockNode, ElementNode, TransientNode } from "~lib/AppNode"
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
  /**
   * Keyed blocks rendered so far, by key, with their index in
   * `reactElements`.
   */
  private readonly renderedBlocks = new Map<
    string,
    { node: BlockNode; elementIndex: number }
  >()
  public readonly reactElements: ReactElement[]
  /**
   * IDs of the block's children that the run `scriptRunId` wrote. Built the
   * first time a node that a skeleton waits to replace needs them.
   */
  private idsWrittenByRun?: { scriptRunId: string; ids: Set<string> }
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
    // Render one copy per block id: two siblings with the same React key make
    // React warn and can remount the container. Copies come from writes that
    // stale-node cleanup has not removed yet: a rerun that moves a block leaves
    // the old copy until the run finishes, and a fragment rerun writing to the
    // event container never removes a full run's copy (the same dialog opened
    // from the main script and then from a fragment). Keep the copy written
    // last, in the first copy's slot so React keeps its instance.
    if (blockId) {
      const skeleton = this.renderSkeletonOfMovedNode(key, blockId, node)
      if (skeleton) {
        return skeleton
      }
      const rendered = this.renderedBlocks.get(key)
      if (rendered) {
        if (
          (node.deltaMsgReceivedAt ?? 0) <=
          (rendered.node.deltaMsgReceivedAt ?? 0)
        ) {
          return null
        }
        const renderer = <BlockNodeRenderer key={key} {...childProps} />
        this.reactElements[rendered.elementIndex] = renderer
        rendered.node = node
        return renderer
      }
      this.renderedBlocks.set(key, {
        node,
        elementIndex: this.reactElements.length,
      })
    }

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

    const elementId = getElementId(node.element)
    const key = this.getCurrentKey(elementId)
    this.index += 1
    const skeleton = this.renderSkeletonOfMovedNode(key, elementId, node)
    if (skeleton) {
      return skeleton
    }
    // Avoid rendering the same element twice. We assume the first one is the one we want
    // because the page is rendered top to bottom, so a valid widget would be rendered
    // correctly and we assume the second one is therefore stale (or throw an error).
    // Also, our setIn logic pushes stale widgets down in the list of elements, so the
    // most recent one should always come first.
    if (this.renderedKeySet.has(key)) {
      return null
    }

    this.renderedKeySet.add(key)

    const renderer = <ElementNodeRenderer key={key} {...childProps} />
    this.reactElements.push(renderer)

    return renderer
  }

  /**
   * Render the skeleton that waits to replace `node` if the skeleton's run
   * also wrote the node's ID at another index of this block (the layout
   * shifted). The slot then shows the skeleton under its own key, so the
   * run's copy keeps the React instance, whether it renders before or after
   * this slot.
   */
  private renderSkeletonOfMovedNode(
    key: string,
    id: string | undefined,
    node: BlockNode | ElementNode
  ): ReactElement | undefined {
    const skeleton = node.pendingSkeleton
    if (!skeleton || !id || !this.wasWrittenByRun(id, skeleton.scriptRunId)) {
      return undefined
    }
    const renderer = (
      <ElementNodeRenderer
        key={`${key}-skeleton`}
        {...this.props}
        node={skeleton}
      />
    )
    this.reactElements.push(renderer)
    return renderer
  }

  /** Whether the run `scriptRunId` wrote a child with ID `id` in this block. */
  private wasWrittenByRun(id: string, scriptRunId: string): boolean {
    if (this.idsWrittenByRun?.scriptRunId !== scriptRunId) {
      const ids = new Set<string>()
      for (const child of this.props.node.children) {
        const node = child instanceof TransientNode ? child.anchor : child
        let childId: string | null | undefined
        if (node instanceof ElementNode) {
          childId = getElementId(node.element)
        } else if (node instanceof BlockNode) {
          childId = node.deltaBlock.id
        }
        if (childId && node?.scriptRunId === scriptRunId) {
          ids.add(childId)
        }
      }
      this.idsWrittenByRun = { scriptRunId, ids }
    }
    return this.idsWrittenByRun.ids.has(id)
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
