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

import nodeEmoji from "node-emoji"
import { buildMediaUri } from "lib/UriUtil"

/**
 * Set the provided url/emoji as the page favicon.
 *
 * @param {string} favicon may be an image url, or an emoji like 🍕 or :pizza:
 */
export function handleFavicon(favicon: string): void {
  const emoji = extractEmoji(favicon)
  if (emoji) {
    // Find the corresponding Twitter emoji on the CDN.
    const codepoint = toCodePoint(emoji)
    const emojiUrl = `https://twemoji.maxcdn.com/2/72x72/${codepoint}.png`
    overwriteFavicon(emojiUrl)
  } else {
    overwriteFavicon(buildMediaUri(favicon))
  }
}

// Update the favicon in the DOM with the specified image.
function overwriteFavicon(imageUrl: string): void {
  const faviconElement: HTMLLinkElement | null = document.querySelector(
    "link[rel='shortcut icon']"
  )
  if (faviconElement) {
    faviconElement.href = imageUrl
  }
}

// Return the emoji if it exists, or empty string otherwise
function extractEmoji(maybeEmoji: string): string {
  if (nodeEmoji.hasEmoji(nodeEmoji.get(maybeEmoji))) {
    // Format: pizza or :pizza:
    return nodeEmoji.get(maybeEmoji)
  } else if (nodeEmoji.hasEmoji(maybeEmoji)) {
    // Format: 🍕
    return maybeEmoji
  }
  return ""
}

// We only need this one function of Twemoji to locate the CDN emoji image,
// so we copy it instead of importing the whole library.
// https://github.com/twitter/twemoji/blob/42f8843cb3aa1f9403d5479d7e3f7e01176ad08e/scripts/build.js#L571
function toCodePoint(unicodeSurrogates: string, sep?: string): string {
  var r = [],
    c = 0,
    p = 0,
    i = 0
  while (i < unicodeSurrogates.length) {
    c = unicodeSurrogates.charCodeAt(i++)
    if (p) {
      r.push((0x10000 + ((p - 0xd800) << 10) + (c - 0xdc00)).toString(16))
      p = 0
    } else if (0xd800 <= c && c <= 0xdbff) {
      p = c
    } else {
      r.push(c.toString(16))
    }
  }
  return r.join(sep || "-")
}
