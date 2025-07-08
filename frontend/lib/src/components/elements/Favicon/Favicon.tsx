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

import * as nodeEmoji from "node-emoji"

import { IGuestToHostMessage } from "~lib/hostComm/types"
import { StreamlitEndpoints } from "~lib/StreamlitEndpoints"

function iconToUrl(icon: string): string {
  const iconRegexp = /^:(.+)\/(.+):$/
  const matchResult = icon.match(iconRegexp)
  if (matchResult === null) {
    // If the icon is invalid, return just an empty string
    return ""
  }

  return `https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsrounded/${matchResult[2]}/default/24px.svg`
}

/**
 * Set the provided url/emoji as the page favicon.
 *
 * @param {string} favicon an image url, or an emoji like 🍕 or :pizza:
 * @param sendMessageToHost a function that posts messages to the app's parent iframe
 * @param endpoints
 */
export function handleFavicon(
  favicon: string,
  sendMessageToHost: (message: IGuestToHostMessage) => void,
  endpoints: StreamlitEndpoints
): void {
  const emoji = extractEmoji(favicon)
  let imageUrl

  if (emoji && !favicon.startsWith(":material")) {
    // Create a favicon data URL as SVG with the emoji embedded.
    imageUrl = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${emoji}</text></svg>`
  } else if (favicon.startsWith(":material")) {
    imageUrl = iconToUrl(favicon)
  } else {
    imageUrl = endpoints.buildMediaURL(favicon)
  }

  overwriteFavicon(imageUrl)

  sendMessageToHost({
    type: "SET_PAGE_FAVICON",
    favicon: imageUrl,
  })
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
export function extractEmoji(maybeEmoji: string): string {
  const EMOJI_PREFIX = "emoji:"
  if (maybeEmoji.startsWith(EMOJI_PREFIX)) {
    // Remove the 'emoji:' prefix
    return maybeEmoji.substring(EMOJI_PREFIX.length)
  }

  // At this point, it must be a shortcode, so we normalize and check if it exists
  const shortcode = maybeEmoji.replace("-", "_")
  const emoji = nodeEmoji.get(shortcode)
  if (emoji !== undefined && nodeEmoji.has(emoji)) {
    // Format: pizza or :pizza:
    // Since has(':pizza:') == true, we must do this check first
    return emoji
  }

  return ""
}
