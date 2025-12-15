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
  const setFavicon = (imageUrl: string): void => {
    overwriteFavicon(imageUrl)
    sendMessageToHost({
      type: "SET_PAGE_FAVICON",
      favicon: imageUrl,
    })
  }

  // Check for material icon first (synchronous, no emoji extraction needed)
  if (favicon.startsWith(":material")) {
    setFavicon(iconToUrl(favicon))
    return
  }

  // Check for direct emoji (synchronous, no library loading needed)
  const EMOJI_PREFIX = "emoji:"
  if (favicon.startsWith(EMOJI_PREFIX)) {
    const emoji = favicon.substring(EMOJI_PREFIX.length)
    const imageUrl = createEmojiDataUrl(emoji)
    setFavicon(imageUrl)
    return
  }

  // Check if it looks like a shortcode pattern before attempting conversion
  // This avoids unnecessarily lazy-loading node-emoji for regular URLs
  const shortcodePattern = /^:[a-zA-Z0-9_+-]+:$/
  if (shortcodePattern.test(favicon)) {
    // Check for emoji shortcode (asynchronous, may need to lazy-load node-emoji)
    void convertShortcodeToEmoji(favicon)
      .then(emoji => {
        if (emoji) {
          setFavicon(createEmojiDataUrl(emoji))
        } else {
          // Not a valid shortcode, treat as URL
          setFavicon(endpoints.buildMediaURL(favicon))
        }
      })
      .catch(() => {
        // Error loading node-emoji, treat as URL
        setFavicon(endpoints.buildMediaURL(favicon))
      })
  } else {
    // Not a shortcode pattern, treat as URL
    setFavicon(endpoints.buildMediaURL(favicon))
  }
}

/**
 * Create a data URL for an emoji to use as a favicon.
 *
 * @param emoji - The emoji character(s) to embed in the SVG
 * @returns A data URL containing an SVG with the emoji
 */
function createEmojiDataUrl(emoji: string): string {
  return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${emoji}</text></svg>`
}

/**
 * Update the favicon in the DOM with the specified image URL.
 *
 * @param imageUrl - The URL to set as the favicon
 */
function overwriteFavicon(imageUrl: string): void {
  const faviconElement: HTMLLinkElement | null = document.querySelector(
    "link[rel='shortcut icon']"
  )

  if (faviconElement) {
    faviconElement.href = imageUrl
  }
}

/**
 * Convert an emoji shortcode to the actual emoji character.
 * Lazy-loads node-emoji library only when needed.
 *
 * @param shortcode - An emoji shortcode like ":pizza:" or "pizza"
 * @returns Promise that resolves to the emoji string or empty string if not found
 *
 * @example
 * await convertShortcodeToEmoji(":pizza:") // Returns "🍕"
 * await convertShortcodeToEmoji(":crescent-moon:") // Returns "🌙" (handles dashes)
 * await convertShortcodeToEmoji(":invalid:") // Returns ""
 */
async function convertShortcodeToEmoji(shortcode: string): Promise<string> {
  // Lazy-load node-emoji only when we need shortcode conversion
  const nodeEmoji = await import("node-emoji")

  // Normalize dashes to underscores (node-emoji uses underscores)
  const normalizedShortcode = shortcode.replace(/-/g, "_")

  // Get the emoji for this shortcode
  const emoji = nodeEmoji.get(normalizedShortcode)

  // Verify it's a valid emoji (not just the shortcode string returned)
  if (emoji && emoji !== normalizedShortcode && nodeEmoji.has(emoji)) {
    return emoji
  }

  return ""
}
