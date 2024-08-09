/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import nodeEmoji from "node-emoji"

import { grabTheRightIcon } from "@streamlit/lib/src/vendor/twemoji"
import { IGuestToHostMessage } from "@streamlit/lib/src/hostComm/types"
import { StreamlitEndpoints } from "@streamlit/lib/src/StreamlitEndpoints"

function iconToUrl(icon: string): string {
  const iconRegexp = /^:(.+)\/(.+):$/
  const matchResult = icon.match(iconRegexp)
  if (matchResult === null) {
    // If the icon is invalid, return just an empty string
    return ""
  }

  const iconUrl = `https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsrounded/${matchResult[2]}/default/24px.svg`
  return iconUrl
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
    // Find the corresponding Twitter emoji on the CDN.
    const codepoint = grabTheRightIcon(emoji)
    const emojiUrl = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${codepoint}.png`

    imageUrl = emojiUrl
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
function extractEmoji(maybeEmoji: string): string {
  const shortcode = maybeEmoji.replace("-", "_")
  if (nodeEmoji.hasEmoji(nodeEmoji.get(shortcode))) {
    // Format: pizza or :pizza:
    // Since hasEmoji(':pizza:') == true, we must do this check first
    return nodeEmoji.get(shortcode)
  }
  if (nodeEmoji.hasEmoji(maybeEmoji)) {
    // Format: 🍕
    return maybeEmoji
  }
  return ""
}
