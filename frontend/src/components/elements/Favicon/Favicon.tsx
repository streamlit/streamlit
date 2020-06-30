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

import React, { Component, ReactNode } from "react"
import ReactDOM from "react-dom"
import { Map as ImmutableMap } from "immutable"
import { getImageURI } from "../ImageList/ImageList"
import nodeEmoji from "node-emoji"

export interface Props {
  element: ImmutableMap<string, any>
}

/**
 * Hidden element that overwrites the page's favicon with the provided image
 */
export class Favicon extends Component<Props> {
  private emoji = ""
  private shouldRender = true

  public render(): ReactNode {
    const { element } = this.props

    const maybeEmoji = element.get("url")
    if (nodeEmoji.hasEmoji(nodeEmoji.get(maybeEmoji))) {
      // Format: :pizza:
      this.emoji = nodeEmoji.get(maybeEmoji)
    } else if (nodeEmoji.hasEmoji(maybeEmoji)) {
      // Format: 🍕
      this.emoji = maybeEmoji
    } else {
      // Format: http://streamlit.io/favicon.ico or /media/blah.jpeg
      // No need to render SVG
      this.setFavicon(getImageURI(element))
      this.shouldRender = false
    }

    return this.shouldRender ? (
      <svg
        version="1.2"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
      >
        <text>{this.emoji}</text>
      </svg>
    ) : null
  }

  private setFavicon(imageUrl: string) {
    const faviconElement: HTMLLinkElement | null = document.querySelector(
      "link[rel='shortcut icon']"
    )
    if (faviconElement) {
      faviconElement.href = imageUrl
    }
  }

  // An SVG for an full-sized emoji, encoded as a data URI
  private svgURI(emoji: string, scale: number) {
    return `data:image/svg+xml,
    <svg version="1.2" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" >
      <text
        style="transform: translate(50%, 50%) scale(${scale})"
        dominant-baseline="central"
        text-anchor="middle">
        ${emoji}
      </text>
    </svg>`
  }

  public componentDidMount() {
    const svgElement = ReactDOM.findDOMNode(this) as Element
    if (svgElement) {
      // Measure the scaling factor with the React node, then hide the node.
      const textNode = svgElement.firstChild as SVGGraphicsElement
      const boundingBox = textNode.getBBox()
      const scale = Math.min(100 / boundingBox.width, 100 / boundingBox.height)

      this.setFavicon(this.svgURI(this.emoji, scale))
      this.shouldRender = false
    }
  }
}

export default Favicon
