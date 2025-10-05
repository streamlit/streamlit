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

import {
  BlockNode,
  ElementNode,
  StandaloneNode,
  TransientNode,
} from "~lib/render-tree"
import { AppNodeVisitor } from "~lib/render-tree/visitors/AppNodeVisitor.interface"
import { getElementId } from "~lib/util/utils"

import { BlockNodeRenderer } from "./Block"
import ElementNodeRenderer from "./ElementNodeRenderer"

import { BlockPropsWithoutWidth } from "."

export type OptionalReactElement = ReactElement | null

export class RenderNodeVisitor
  implements AppNodeVisitor<OptionalReactElement>
{
  private readonly props: BlockPropsWithoutWidth
  private readonly disableFullscreenMode: boolean
  private elementKeyOverride?: string
  private readonly elementKeySet: Set<string>
  public readonly reactElements: OptionalReactElement[]
  private index: number
  private transientElementCount: number

  constructor(
    props: BlockPropsWithoutWidth,
    disableFullscreenMode: boolean,
    elementKeyOverride?: string
  ) {
    this.props = props
    this.disableFullscreenMode = disableFullscreenMode
    this.elementKeyOverride = elementKeyOverride
    this.elementKeySet = new Set<string>()
    this.reactElements = [] as OptionalReactElement[]
    // Initialize index to 0 as we will use it as a key in the React component
    this.index = 0
    this.transientElementCount = 0
  }

  visitBlockNode(node: BlockNode): OptionalReactElement {
    // Put node in childProps instead of passing as a node={node} prop in React to
    // guarantee it doesn't get overwritten by {...childProps}.
    const childProps = {
      ...this.props,
      disableFullscreenMode: this.disableFullscreenMode,
      node,
    }

    const key = this.elementKeyOverride || this.index.toString()
    this.index += 1

    const renderer = <BlockNodeRenderer key={key} {...childProps} />
    this.reactElements.push(renderer)

    return renderer
  }

  visitStandaloneNode<S>(_node: StandaloneNode<S>): OptionalReactElement {
    // Standalone nodes are rendered outside of the context this visitor is used in
    return null
  }

  visitTransientNode(node: TransientNode): OptionalReactElement {
    const transientReactElements: OptionalReactElement[] = []
    node.transientNodes.forEach(element => {
      const keyOverride =
        this.elementKeyOverride || `transient-${this.transientElementCount}`

      this.transientElementCount += 1
      const transientReactElement = element.accept(
        new RenderNodeVisitor(
          this.props,
          this.disableFullscreenMode,
          keyOverride
        )
      )
      transientReactElements.push(transientReactElement)
    })

    this.reactElements.push(...transientReactElements)

    const anchorReactElement = node.anchor?.accept(this)
    if (anchorReactElement) {
      transientReactElements.push(anchorReactElement)
    }

    return <>{transientReactElements}</>
  }

  visitElementNode(node: ElementNode): OptionalReactElement {
    // Put node in childProps instead of passing as a node={node} prop in React to
    // guarantee it doesn't get overwritten by {...childProps}.
    const childProps = {
      ...this.props,
      disableFullscreenMode: this.disableFullscreenMode,
      node,
    }

    const key =
      this.elementKeyOverride ||
      getElementId(node.element) ||
      this.index.toString()
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

  static collectReactElements(
    props: BlockPropsWithoutWidth,
    disableFullscreenMode: boolean
  ): OptionalReactElement[] {
    if (!props.node.children) {
      return []
    }

    const visitor = new RenderNodeVisitor(props, disableFullscreenMode)
    // Visit all the children nodes and collect the react elements
    props.node.children.forEach(childNode => childNode.accept(visitor))

    return visitor.reactElements
  }
}
