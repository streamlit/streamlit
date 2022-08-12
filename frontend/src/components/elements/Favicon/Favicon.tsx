import nodeEmoji from "node-emoji"
import { BaseUriParts, buildMediaUri } from "src/lib/UriUtil"
import { grabTheRightIcon } from "src/vendor/twemoji"
import { sendS4AMessage } from "src/hocs/withS4ACommunication/withS4ACommunication"

/**
 * Set the provided url/emoji as the page favicon.
 *
 * @param {string} favicon may be an image url, or an emoji like 🍕 or :pizza:
 * @param {function} callback
 */
export function handleFavicon(
  favicon: string,
  baseUriParts?: BaseUriParts
): void {
  const emoji = extractEmoji(favicon)
  let imageUrl

  if (emoji) {
    // Find the corresponding Twitter emoji on the CDN.
    const codepoint = grabTheRightIcon(emoji)
    const emojiUrl = `https://twemoji.maxcdn.com/2/72x72/${codepoint}.png`

    imageUrl = emojiUrl
  } else {
    imageUrl = buildMediaUri(favicon, baseUriParts)
  }

  overwriteFavicon(imageUrl)

  sendS4AMessage({
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
