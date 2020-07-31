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

import React, { useState, useEffect, useRef } from "react"
import { Map as ImmutableMap } from "immutable"
import nodeEmoji from "node-emoji"
import { buildMediaUri } from "lib/UriUtil"

// Update the favicon in the DOM with the specified image.
function overwriteFavicon(imageUrl: string): void {
  const faviconElement: HTMLLinkElement | null = document.querySelector(
    "link[rel='shortcut icon']"
  )
  if (faviconElement) {
    faviconElement.href = imageUrl
  }
}

// An SVG for a full-sized emoji, encoded as a data URI
function svgURI(emoji: string | null, scale: number): string {
  return `data:image/svg+xml,
  <svg version="1.2" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <text
      style="transform: translate(50%, 50%) scale(${scale})"
      dominant-baseline="central"
      text-anchor="middle">
      ${emoji}
    </text>
  </svg>`
}

// Return the emoji if it exists, or empty string otherwise
function extractEmoji(maybeEmoji: string): string {
  if (nodeEmoji.hasEmoji(nodeEmoji.get(maybeEmoji))) {
    // Format: pizza or :pizza:
    return nodeEmoji.get(maybeEmoji)
  }
  if (nodeEmoji.hasEmoji(maybeEmoji)) {
    // Format: 🍕
    return maybeEmoji
  }
  return ""
}

export interface Props {
  element: ImmutableMap<string, any>
}

/**
 * Hidden element that overwrites the page's favicon with the provided image
 *
 * This has a complex lifecycle for emoji favicons, since it must first render
 * the emoji on the page to measure its dimensions, then hide it afterwards.
 */
export const Favicon: React.FC<Props> = (props: Props) => {
  const [render, setRender] = useState(true)
  const [emoji, setEmoji] = useState("")
  const [finalUrl, setFinalUrl] = useState("")
  const textNode = useRef<SVGTextElement>(null)

  // Re-render the entire component whenever the props are changed
  // (aka user changed the favicon with st.beta_set_favicon)
  useEffect(() => {
    const url = props.element.get("url")
    const emoji = extractEmoji(url)
    if (emoji) {
      setEmoji(emoji)
      setRender(true)
    } else {
      // Format: http://streamlit.io/favicon.ico or /media/blah.jpeg
      // No need to render SVG
      setFinalUrl(buildMediaUri(url))
      setRender(false)
    }
  }, [props.element])

  // After a new emoji is rendered, measure its dimensions to generate the
  // correctly scaled favicon, then hide the original emoji.
  useEffect(() => {
    if (emoji && textNode.current) {
      const boundingBox = textNode.current.getBBox()
      const scale = Math.min(100 / boundingBox.width, 100 / boundingBox.height)
      setFinalUrl(svgURI(emoji, scale))
      setRender(false)
    }
  }, [emoji])

  // The above two are effects to prevent infinite re-rendering loops.
  // This is an effect because it's a manual DOM manipulation.
  useEffect(() => {
    overwriteFavicon(finalUrl)
  }, [finalUrl])

  return render ? (
    <svg
      version="1.2"
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      <text ref={textNode}>{emoji}</text>
    </svg>
  ) : null
}

export default Favicon
